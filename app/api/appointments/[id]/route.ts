import { z } from 'zod'

import {
  getAppointmentWithDetails,
  getSeriesNotificationAppointment,
} from '@/lib/api/appointments'
import { badRequest, forbidden, getSessionAndRole, notFound, serverError } from '@/lib/api/auth'
import { notifyAppointmentCancelled, notifyAppointmentUpdated } from '@/lib/email/notifications'
import { createClient } from '@/lib/supabase/server'
import type { ClientHome, Database } from '@/types'

const statusSchema = z.enum(['scheduled', 'completed', 'cancelled'])

const updateAppointmentSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    client_id: z.string().uuid().nullable().optional(),
    home_id: z.string().uuid().nullable().optional(),
    job_id: z.string().uuid().nullable().optional(),
    start_time: z.string().datetime({ offset: true }).optional(),
    end_time: z.string().datetime({ offset: true }).optional(),
    notes: z.string().trim().min(1).nullable().optional(),
    status: statusSchema.optional(),
    employee_ids: z.array(z.string().uuid()).optional(),
    edit_scope: z.enum(['single', 'series']).optional(),
    invoice: z
      .object({
        amount_charged: z.number().positive(),
        discount_amount: z.number().min(0).optional().default(0),
        discount_reason: z.string().trim().optional(),
        is_paid: z.boolean().optional().default(false),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.start_time && value.end_time) {
      if (new Date(value.end_time).getTime() <= new Date(value.start_time).getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'end_time must be after start_time',
          path: ['end_time'],
        })
      }
    }

    if (
      value.invoice &&
      (value.invoice.discount_amount ?? 0) > 0 &&
      !value.invoice.discount_reason?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'discount_reason is required when discount_amount is greater than 0',
        path: ['invoice', 'discount_reason'],
      })
    }
  })

type RouteContext = {
  params: {
    id: string
  }
}

type AppointmentDetail = Database['public']['Tables']['appointments']['Row'] & {
  clients: {
    id: string
    full_name: string
    email: string | null
    phone: string | null
    address: string | null
    notes: string | null
    created_at: string
    updated_at: string
  } | null
  client_homes: ClientHome | null
  jobs: {
    id: string
    name: string
    description: string | null
    default_price_per_hour: number
    is_active: boolean
    created_at: string
    updated_at: string
  } | null
}

type AssignmentRow = {
  appointment_id: string
  employee_id: string
  profiles: {
    id: string
    full_name: string
  } | null
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

async function getAssignments(appointmentIds: string[]): Promise<Map<string, AssignmentRow[]>> {
  if (appointmentIds.length === 0) {
    return new Map<string, AssignmentRow[]>()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appointment_employees')
    .select('appointment_id, employee_id, profiles!appointment_employees_employee_id_fkey(id, full_name)')
    .in('appointment_id', appointmentIds)

  if (error) {
    throw error
  }

  const result = new Map<string, AssignmentRow[]>()

  for (const row of (data ?? []) as AssignmentRow[]) {
    const list = result.get(row.appointment_id) ?? []
    list.push(row)
    result.set(row.appointment_id, list)
  }

  return result
}

function mapAppointment(
  appointment: AppointmentDetail,
  assignmentsMap: Map<string, AssignmentRow[]>,
): AppointmentDetail & { appointment_employees: Array<{ employee_id: string; profiles: AssignmentRow['profiles'] }> } {
  const assignments = assignmentsMap.get(appointment.id) ?? []

  return {
    ...appointment,
    appointment_employees: assignments.map((assignment) => ({
      employee_id: assignment.employee_id,
      profiles: assignment.profiles,
    })),
  }
}

export async function GET(request: Request, { params }: RouteContext) {
  const session = await getSessionAndRole(request)

  if (!session) {
    return forbidden()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appointments')
    .select('*, clients(*), client_homes!home_id(*), jobs!job_id(*)')
    .eq('id', params.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return notFound()
    }

    console.error('Failed to fetch appointment', error)
    return serverError()
  }

  try {
    const appointmentData = data as unknown as AppointmentDetail
    const assignments = await getAssignments([appointmentData.id])
    const mappedAppointment = mapAppointment(appointmentData, assignments)

    if (session.role === 'admin') {
      const { data: invoice, error: invoiceError } = await supabase
        .from('appointment_invoices')
        .select('*')
        .eq('appointment_id', params.id)
        .maybeSingle()

      if (invoiceError) {
        console.error('Failed to fetch appointment invoice', invoiceError)
        return serverError()
      }

      return jsonResponse({ ...mappedAppointment, invoice }, 200)
    }

    return jsonResponse(mappedAppointment, 200)
  } catch (assignmentError) {
    console.error('Failed to fetch appointment assignments', assignmentError)
    return serverError()
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSessionAndRole(request)

  if (!session || session.role !== 'admin') {
    return forbidden()
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = updateAppointmentSchema.safeParse(body)

  if (!parsed.success) {
    return jsonResponse(parsed.error.flatten(), 400)
  }

  const { employee_ids: employeeIds, edit_scope: editScope, invoice: invoiceInput, ...fields } = parsed.data
  const hasMeaningfulUpdate = Object.keys(fields).length > 0 || employeeIds !== undefined

  if (!hasMeaningfulUpdate) {
    return badRequest('No fields to update')
  }

  const supabase = await createClient()

  const { data: baseAppointment, error: baseError } = await supabase
    .from('appointments')
    .select('id, recurrence_series_id, start_time, end_time')
    .eq('id', params.id)
    .single()

  if (baseError || !baseAppointment) {
    if (baseError?.code === 'PGRST116') {
      return notFound()
    }

    console.error('Failed to find appointment to update', baseError)
    return serverError()
  }

  const base = baseAppointment as unknown as { id: string; recurrence_series_id: string | null; start_time: string; end_time: string }

  const scope = editScope ?? 'single'

  const homeId = (fields as Record<string, unknown>).home_id as string | undefined
  const clientIdForCheck = (fields as Record<string, unknown>).client_id as string | undefined

  if (homeId && clientIdForCheck) {
    const { data: homeCheck, error: homeCheckError } = await supabase
      .from('client_homes')
      .select('client_id')
      .eq('id', homeId)
      .single()

    if (homeCheckError || !homeCheck || (homeCheck as unknown as { client_id: string }).client_id !== clientIdForCheck) {
      return badRequest('home_id does not belong to the selected client')
    }
  }

  try {
    if (scope === 'series' && base.recurrence_series_id) {
      const {
        start_time: ignoredStart,
        end_time: ignoredEnd,
        ...seriesUpdatableFields
      } = fields

      void ignoredStart
      void ignoredEnd

      if (Object.keys(seriesUpdatableFields).length > 0) {
        const { error: updateError } = await (supabase.from('appointments') as any)
          .update(seriesUpdatableFields)
          .eq('recurrence_series_id', base.recurrence_series_id)

        if (updateError) {
          console.error('Failed to update appointment series', updateError)
          return serverError()
        }
      }

      const { data: seriesAppointments, error: seriesError } = await supabase
        .from('appointments')
        .select('id')
        .eq('recurrence_series_id', base.recurrence_series_id)

      if (seriesError) {
        console.error('Failed to fetch series appointments after update', seriesError)
        return serverError()
      }

      const seriesIds = ((seriesAppointments ?? []) as unknown as Array<{ id: string }>).map((row) => row.id)

      if (employeeIds) {
        const { error: deleteAssignmentsError } = await supabase
          .from('appointment_employees')
          .delete()
          .in('appointment_id', seriesIds)

        if (deleteAssignmentsError) {
          console.error('Failed to clear series assignments', deleteAssignmentsError)
          return serverError()
        }

        if (employeeIds.length > 0) {
          const assignmentRows = seriesIds.flatMap((appointmentId) =>
            employeeIds.map((employeeId) => ({
              appointment_id: appointmentId,
              employee_id: employeeId,
            })),
          )

          const { error: insertAssignmentsError } = await supabase
            .from('appointment_employees')
            .insert(assignmentRows as any)

          if (insertAssignmentsError) {
            console.error('Failed to insert series assignments', insertAssignmentsError)
            return serverError()
          }
        }
      }

      const { data: refreshed, error: refreshedError } = await supabase
        .from('appointments')
        .select('*, clients(*), client_homes!home_id(*), jobs!job_id(*)')
        .eq('recurrence_series_id', base.recurrence_series_id)
        .order('start_time', { ascending: true })

      if (refreshedError) {
        console.error('Failed to fetch updated series', refreshedError)
        return serverError()
      }

      const refreshedSeries = (refreshed ?? []) as unknown as AppointmentDetail[]
      const assignments = await getAssignments(refreshedSeries.map((appointment) => appointment.id))

      if (hasMeaningfulUpdate) {
        const seriesNotificationAppointment = await getSeriesNotificationAppointment(
          supabase,
          base.recurrence_series_id,
        )

        if (seriesNotificationAppointment) {
          if (seriesNotificationAppointment.status === 'cancelled') {
            notifyAppointmentCancelled(seriesNotificationAppointment).catch(console.error)
          } else {
            notifyAppointmentUpdated(seriesNotificationAppointment).catch(console.error)
          }
        }
      }

      return jsonResponse(
        refreshedSeries.map((appointment) => mapAppointment(appointment, assignments)),
        200,
      )
    }

    if (fields.start_time && !fields.end_time) {
      if (new Date(base.end_time).getTime() <= new Date(fields.start_time).getTime()) {
        return badRequest('end_time must be after start_time')
      }
    }

    if (!fields.start_time && fields.end_time) {
      if (new Date(fields.end_time).getTime() <= new Date(base.start_time).getTime()) {
        return badRequest('end_time must be after start_time')
      }
    }

    if (Object.keys(fields).length > 0) {
      const { error: updateError } = await (supabase.from('appointments') as any).update(fields).eq('id', params.id)

      if (updateError) {
        console.error('Failed to update appointment', updateError)
        return serverError()
      }
    }

    if (invoiceInput) {
      const { error: invoiceError } = await (supabase.from('appointment_invoices') as any).upsert(
        {
          appointment_id: params.id,
          amount_charged: invoiceInput.amount_charged,
          discount_amount: invoiceInput.discount_amount ?? 0,
          discount_reason: invoiceInput.discount_reason ?? null,
          is_paid: invoiceInput.is_paid ?? false,
        },
        { onConflict: 'appointment_id' },
      )

      if (invoiceError) {
        console.error('Failed to upsert appointment invoice', invoiceError)
        return serverError()
      }
    }

    if (employeeIds) {
      const { error: deleteAssignmentsError } = await supabase
        .from('appointment_employees')
        .delete()
        .eq('appointment_id', params.id)

      if (deleteAssignmentsError) {
        console.error('Failed to clear appointment assignments', deleteAssignmentsError)
        return serverError()
      }

      if (employeeIds.length > 0) {
        const { error: insertAssignmentsError } = await supabase.from('appointment_employees').insert(
          employeeIds.map((employeeId) => ({
            appointment_id: params.id,
            employee_id: employeeId,
          })) as any,
        )

        if (insertAssignmentsError) {
          console.error('Failed to insert appointment assignments', insertAssignmentsError)
          return serverError()
        }
      }
    }

    const { data: refreshed, error: refreshedError } = await supabase
      .from('appointments')
      .select('*, clients(*), client_homes!home_id(*), jobs!job_id(*)')
      .eq('id', params.id)
      .single()

    if (refreshedError) {
      if (refreshedError.code === 'PGRST116') {
        return notFound()
      }

      console.error('Failed to fetch updated appointment', refreshedError)
      return serverError()
    }

    const assignments = await getAssignments([params.id])

    if (hasMeaningfulUpdate) {
      const appointmentWithDetails = await getAppointmentWithDetails(supabase, params.id)

      if (appointmentWithDetails) {
        if (appointmentWithDetails.status === 'cancelled') {
          notifyAppointmentCancelled(appointmentWithDetails).catch(console.error)
        } else {
          notifyAppointmentUpdated(appointmentWithDetails).catch(console.error)
        }
      }
    }

    return jsonResponse(mapAppointment(refreshed as unknown as AppointmentDetail, assignments), 200)
  } catch (error) {
    console.error('Failed to update appointment', error)
    return serverError()
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const session = await getSessionAndRole(request)

  if (!session || session.role !== 'admin') {
    return forbidden()
  }

  const requestUrl = new URL(request.url)
  const scope = requestUrl.searchParams.get('scope')

  const supabase = await createClient()

  const { data: baseAppointment, error: baseError } = await supabase
    .from('appointments')
    .select('id, recurrence_series_id')
    .eq('id', params.id)
    .single()

  if (baseError || !baseAppointment) {
    if (baseError?.code === 'PGRST116') {
      return notFound()
    }

    console.error('Failed to find appointment to delete', baseError)
    return serverError()
  }

  const deleteBase = baseAppointment as unknown as { id: string; recurrence_series_id: string | null }

  try {
    if (scope === 'series' && deleteBase.recurrence_series_id) {
      const seriesNotificationAppointment = await getSeriesNotificationAppointment(
        supabase,
        deleteBase.recurrence_series_id,
      )

      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('recurrence_series_id', deleteBase.recurrence_series_id)

      if (error) {
        console.error('Failed to delete appointment series', error)
        return serverError()
      }

      if (seriesNotificationAppointment) {
        notifyAppointmentCancelled(seriesNotificationAppointment).catch(console.error)
      }

      return jsonResponse({ success: true, scope: 'series' }, 200)
    }

    const appointmentWithDetails = await getAppointmentWithDetails(supabase, params.id)

    const { error } = await supabase.from('appointments').delete().eq('id', params.id)

    if (error) {
      console.error('Failed to delete appointment', error)
      return serverError()
    }

    if (appointmentWithDetails) {
      notifyAppointmentCancelled(appointmentWithDetails).catch(console.error)
    }

    return jsonResponse({ success: true, scope: 'single' }, 200)
  } catch (error) {
    console.error('Failed to delete appointment', error)
    return serverError()
  }
}
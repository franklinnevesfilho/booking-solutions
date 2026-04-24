import { z } from 'zod'

import {
  getAppointmentWithDetails,
  getSeriesNotificationAppointment,
} from '@/lib/api/appointments'
import { badRequest, forbidden, getSessionAndRole, notFound, serverError } from '@/lib/api/auth'
import { getFutureOccurrencesFrom, isValidRRule } from '@/lib/calendar/recurrence'
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
    recurrence_rule: z.string().trim().min(1).optional(),
    recurrence_end_condition: z.enum(['until', 'count', 'infinite']).optional(),
    recurrence_end_date: z.string().datetime({ offset: true }).optional().nullable(),
    recurrence_max_count: z.number().int().min(1).optional().nullable(),
    invoice: z
      .object({
        amount_charged: z.number().positive(),
        discount_amount: z.number().min(0).optional().default(0),
        discount_reason: z.string().trim().nullable().optional().transform(val => (!val ? null : val)),
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

    if (value.recurrence_rule && !isValidRRule(value.recurrence_rule)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid recurrence rule',
        path: ['recurrence_rule'],
      })
    }
    if (value.recurrence_rule && value.edit_scope !== 'series') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'recurrence_rule can only be updated with edit_scope "series"',
        path: ['recurrence_rule'],
      })
    }
  })

type RouteContext = {
  params: Promise<{
    id: string
  }>
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
  homes: ClientHome | null
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
    headers: { 'Content-Type': 'application/json' },
  })
}

function validationError(parsed: z.SafeParseError<unknown>): Response {
  const flattened = parsed.error.flatten()
  console.error('Validation failed:', JSON.stringify(flattened, null, 2))
  return jsonResponse(
    {
      error: 'Validation failed',
      fieldErrors: flattened.fieldErrors,
      formErrors: flattened.formErrors,
    },
    400
  )
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
    console.error('Failed to load assignments:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      appointmentIds,
    })
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
  const { id } = await params
  console.log('GET /api/appointments/:id — id:', id)

  const session = await getSessionAndRole(request)
  console.log('Session:', session)

  if (!session) {
    console.warn('Forbidden — no session')
    return forbidden()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appointments')
    .select('*, clients(*), homes!home_id(*), jobs!job_id(*)')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      console.warn('Appointment not found — id:', id)
      return notFound()
    }

    console.error('Failed to fetch appointment:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      appointmentId: id,
    })
    return serverError()
  }

  try {
    const appointmentData = data as unknown as AppointmentDetail
    const assignments = await getAssignments([appointmentData.id])
    const mappedAppointment = mapAppointment(appointmentData, assignments)

    if (session.role === 'admin') {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('appointment_id', id)
        .maybeSingle()

      if (invoiceError) {
        console.error('Failed to fetch appointment invoice:', {
          message: invoiceError.message,
          code: invoiceError.code,
          details: invoiceError.details,
          hint: invoiceError.hint,
          appointmentId: id,
        })
        return serverError()
      }

      return jsonResponse({ ...mappedAppointment, invoice }, 200)
    }

    return jsonResponse(mappedAppointment, 200)
  } catch (assignmentError) {
    console.error('Failed to fetch appointment assignments:', assignmentError)
    return serverError()
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params
  console.log('PATCH /api/appointments/:id — id:', id)

  const session = await getSessionAndRole(request)
  console.log('Session:', session)

  if (!session || session.role !== 'admin') {
    console.warn('Forbidden — session:', session)
    return forbidden()
  }

  let body: unknown

  try {
    body = await request.json()
  } catch (err) {
    console.error('Failed to parse JSON body:', err)
    return badRequest('Invalid JSON body')
  }

  console.log('Request body:', JSON.stringify(body, null, 2))

  const parsed = updateAppointmentSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed)
  }

  const {
    employee_ids: employeeIds,
    edit_scope: editScope,
    invoice: invoiceInput,
    recurrence_rule: newRRule,
    recurrence_end_condition: newEndCondition,
    recurrence_end_date: newEndDate,
    recurrence_max_count: newMaxCount,
    ...fields
  } = parsed.data
  const hasMeaningfulUpdate = Object.keys(fields).length > 0 || employeeIds !== undefined || Boolean(newRRule)

  if (!hasMeaningfulUpdate) {
    console.warn('No fields to update — id:', id)
    return badRequest('No fields to update')
  }

  console.log('Parsed fields:', JSON.stringify(fields, null, 2))
  console.log('Employee IDs:', employeeIds)
  console.log('Edit scope:', editScope)
  console.log('Invoice input:', invoiceInput)

  const supabase = await createClient()

  const { data: baseAppointment, error: baseError } = await supabase
    .from('appointments')
    .select('id, recurrence_series_id, start_time, end_time')
    .eq('id', id)
    .single()

  if (baseError || !baseAppointment) {
    if (baseError?.code === 'PGRST116') {
      console.warn('Appointment not found — id:', id)
      return notFound()
    }

    console.error('Failed to find appointment to update:', {
      message: baseError?.message,
      code: baseError?.code,
      details: baseError?.details,
      hint: baseError?.hint,
      appointmentId: id,
    })
    return serverError()
  }

  const base = baseAppointment as unknown as { id: string; recurrence_series_id: string | null; start_time: string; end_time: string }
  const scope = editScope ?? 'single'

  console.log('Base appointment:', { id: base.id, seriesId: base.recurrence_series_id, scope })

  const homeId = (fields as Record<string, unknown>).home_id as string | undefined
  const clientIdForCheck = (fields as Record<string, unknown>).client_id as string | undefined

  if (homeId && clientIdForCheck) {
    console.log('Verifying home belongs to client:', { homeId, clientId: clientIdForCheck })

    const { data: homeCheck, error: homeCheckError } = await supabase
      .from('homes')
      .select('client_id')
      .eq('id', homeId)
      .single()

    if (homeCheckError) {
      console.error('Failed to verify home ownership:', {
        message: homeCheckError.message,
        code: homeCheckError.code,
        details: homeCheckError.details,
        hint: homeCheckError.hint,
        homeId,
        clientId: clientIdForCheck,
      })
    }

    if (homeCheckError || !homeCheck || (homeCheck as unknown as { client_id: string }).client_id !== clientIdForCheck) {
      console.warn('home_id does not belong to client:', {
        homeId,
        clientId: clientIdForCheck,
        actualClientId: (homeCheck as unknown as { client_id: string } | null)?.client_id,
      })
      return badRequest('home_id does not belong to the selected client')
    }
  }

  try {
    if (scope === 'series' && base.recurrence_series_id) {
      console.log('Updating appointment series — seriesId:', base.recurrence_series_id)

      // Handle rule mutation: delete future instances and rematerialize
      if (newRRule) {
        console.log('Rule mutation requested — new RRULE:', newRRule)

        // Load current series metadata
        const { data: seriesData, error: seriesLoadError } = await supabase
          .from('recurrence_series')
          .select('*')
          .eq('id', base.recurrence_series_id)
          .single()

        if (seriesLoadError || !seriesData) {
          console.error('Failed to load recurrence_series for mutation:', seriesLoadError)
          return serverError()
        }

        // Determine new time slot
        const newDtstart = fields.start_time ?? seriesData.dtstart
        const newDurationMs = fields.start_time && fields.end_time
          ? new Date(fields.end_time).getTime() - new Date(fields.start_time).getTime()
          : Number(seriesData.duration_ms)

        // Validate: ensure new rule produces at least one future occurrence
        const now = new Date()
        const futureOccurrences = getFutureOccurrencesFrom(
          newRRule,
          new Date(newDtstart),
          newDurationMs,
          now,
          8,
        )

        if (futureOccurrences.length === 0) {
          return badRequest('The new recurrence rule produces no future occurrences')
        }

        // Update recurrence_series
        const seriesUpdate: Record<string, unknown> = { rrule: newRRule }
        if (fields.start_time) seriesUpdate.dtstart = fields.start_time
        if (newDurationMs !== Number(seriesData.duration_ms)) seriesUpdate.duration_ms = newDurationMs
        if (newEndCondition) seriesUpdate.end_condition = newEndCondition
        if (newEndDate !== undefined) seriesUpdate.end_date = newEndDate
        if (newMaxCount !== undefined) seriesUpdate.max_count = newMaxCount

        const { error: seriesUpdateError } = await supabase
          .from('recurrence_series')
          .update(seriesUpdate as any)
          .eq('id', base.recurrence_series_id)

        if (seriesUpdateError) {
          console.error('Failed to update recurrence_series:', seriesUpdateError)
          return serverError()
        }

        // Delete all future non-master instances
        const { error: deleteFutureError } = await supabase
          .from('appointments')
          .delete()
          .eq('recurrence_series_id', base.recurrence_series_id)
          .eq('is_master', false)
          .gte('start_time', now.toISOString())

        if (deleteFutureError) {
          console.error('Failed to delete future instances for rule mutation:', deleteFutureError)
          return serverError()
        }

        // Rematerialize from now using new rule
        const newInstances = getFutureOccurrencesFrom(
          newRRule,
          new Date(newDtstart),
          newDurationMs,
          now,
          52,
        )

        // Get master appointment for metadata
        const { data: masterRows } = await supabase
          .from('appointments')
          .select('id, title, client_id, home_id, job_id, notes, status')
          .eq('recurrence_series_id', base.recurrence_series_id)
          .eq('is_master', true)
          .limit(1)

        const masterAppt = masterRows?.[0]

        if (masterAppt && newInstances.length > 0) {
          // Get master employee assignments
          const { data: masterAssignments } = await supabase
            .from('appointment_employees')
            .select('employee_id')
            .eq('appointment_id', masterAppt.id)

          const masterEmployeeIds = (masterAssignments ?? []).map((row: { employee_id: string }) => row.employee_id)

          // Also apply any employee_ids override from this request
          const effectiveEmployeeIds = employeeIds !== undefined ? employeeIds : masterEmployeeIds

          const newApptRows = newInstances.map((instance) => ({
            title: (fields as Record<string, unknown>).title as string ?? masterAppt.title,
            client_id: (fields as Record<string, unknown>).client_id as string | null ?? masterAppt.client_id,
            home_id: (fields as Record<string, unknown>).home_id as string | null ?? masterAppt.home_id,
            job_id: (fields as Record<string, unknown>).job_id as string | null ?? masterAppt.job_id,
            notes: (fields as Record<string, unknown>).notes as string | null ?? masterAppt.notes,
            status: 'scheduled' as const,
            start_time: instance.start_time.toISOString(),
            end_time: instance.end_time.toISOString(),
            recurrence_series_id: base.recurrence_series_id,
            is_master: false,
          }))

          const { data: insertedNewRows, error: insertNewError } = await supabase
            .from('appointments')
            .insert(newApptRows as any)
            .select('id')

          if (insertNewError) {
            console.error('Failed to insert rematerialized instances:', insertNewError)
            return serverError()
          }

          if (effectiveEmployeeIds.length > 0 && insertedNewRows && insertedNewRows.length > 0) {
            const newAssignmentRows = insertedNewRows.flatMap((row: { id: string }) =>
              effectiveEmployeeIds.map((empId: string) => ({
                appointment_id: row.id,
                employee_id: empId,
              }))
            )
            const { error: assignError } = await supabase
              .from('appointment_employees')
              .insert(newAssignmentRows as any)
            if (assignError) {
              console.error('Failed to assign employees to rematerialized instances:', assignError)
            }
          }

          // Update horizon_date
          const lastInstance = newInstances[newInstances.length - 1]
          if (lastInstance) {
            await supabase
              .from('recurrence_series')
              .update({ horizon_date: lastInstance.start_time.toISOString() } as any)
              .eq('id', base.recurrence_series_id)
          }
        }

        // Also update the master appointment with any non-time field changes and employee override
        const masterFieldUpdate: Record<string, unknown> = {}
        const { start_time: _st, end_time: _et, ...nonTimeFields } = fields as Record<string, unknown>
        void _st
        void _et
        Object.assign(masterFieldUpdate, nonTimeFields)

        if (Object.keys(masterFieldUpdate).length > 0 && masterAppt) {
          await supabase.from('appointments').update(masterFieldUpdate as any).eq('id', masterAppt.id)
        }

        if (employeeIds !== undefined && masterAppt) {
          await supabase.from('appointment_employees').delete().eq('appointment_id', masterAppt.id)
          if (employeeIds.length > 0) {
            await supabase.from('appointment_employees').insert(
              employeeIds.map((empId: string) => ({ appointment_id: masterAppt.id, employee_id: empId })) as any
            )
          }
        }
      } else {
        // Non-rule series edit: existing behavior (ignore start_time/end_time, update other fields)
        const {
          start_time: _ignoredStart,
          end_time: _ignoredEnd,
          ...seriesUpdatableFields
        } = fields as Record<string, unknown>
        void _ignoredStart
        void _ignoredEnd

        if (Object.keys(seriesUpdatableFields).length > 0) {
          console.log('Applying series field updates:', seriesUpdatableFields)

          const { error: updateError } = await (supabase.from('appointments') as any)
            .update(seriesUpdatableFields)
            .eq('recurrence_series_id', base.recurrence_series_id)

          if (updateError) {
            console.error('Failed to update appointment series:', {
              message: updateError.message,
              code: updateError.code,
              details: updateError.details,
              hint: updateError.hint,
              seriesId: base.recurrence_series_id,
              fields: seriesUpdatableFields,
            })
            return serverError()
          }
        }

        const { data: seriesAppointments, error: seriesError } = await supabase
          .from('appointments')
          .select('id')
          .eq('recurrence_series_id', base.recurrence_series_id)

        if (seriesError) {
          console.error('Failed to fetch series appointments after update:', {
            message: seriesError.message,
            code: seriesError.code,
            details: seriesError.details,
            hint: seriesError.hint,
            seriesId: base.recurrence_series_id,
          })
          return serverError()
        }

        const seriesIds = ((seriesAppointments ?? []) as unknown as Array<{ id: string }>).map((row) => row.id)
        console.log('Series appointment IDs:', seriesIds.length)

        if (employeeIds) {
          console.log('Updating employee assignments for series:', { seriesId: base.recurrence_series_id, employeeIds })

          const { error: deleteAssignmentsError } = await supabase
            .from('appointment_employees')
            .delete()
            .in('appointment_id', seriesIds)

          if (deleteAssignmentsError) {
            console.error('Failed to clear series assignments:', {
              message: deleteAssignmentsError.message,
              code: deleteAssignmentsError.code,
              details: deleteAssignmentsError.details,
              hint: deleteAssignmentsError.hint,
              seriesId: base.recurrence_series_id,
            })
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
              console.error('Failed to insert series assignments:', {
                message: insertAssignmentsError.message,
                code: insertAssignmentsError.code,
                details: insertAssignmentsError.details,
                hint: insertAssignmentsError.hint,
                seriesId: base.recurrence_series_id,
                employeeIds,
              })
              return serverError()
            }
          }
        }
      }

      const { data: refreshed, error: refreshedError } = await supabase
        .from('appointments')
        .select('*, clients(*), homes!home_id(*), jobs!job_id(*)')
        .eq('recurrence_series_id', base.recurrence_series_id)
        .order('start_time', { ascending: true })

      if (refreshedError) {
        console.error('Failed to fetch updated series:', {
          message: refreshedError.message,
          code: refreshedError.code,
          details: refreshedError.details,
          hint: refreshedError.hint,
          seriesId: base.recurrence_series_id,
        })
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
          const notifyAction = seriesNotificationAppointment.status === 'cancelled'
            ? 'cancelled'
            : 'updated'
          console.log('Sending series notification:', { action: notifyAction, seriesId: base.recurrence_series_id })

          if (seriesNotificationAppointment.status === 'cancelled') {
            notifyAppointmentCancelled(seriesNotificationAppointment).catch(console.error)
          } else {
            notifyAppointmentUpdated(seriesNotificationAppointment).catch(console.error)
          }
        }
      }

      console.log('Successfully updated series — count:', refreshedSeries.length)
      return jsonResponse(
        refreshedSeries.map((appointment) => mapAppointment(appointment, assignments)),
        200,
      )
    }

    if (fields.start_time && !fields.end_time) {
      if (new Date(base.end_time).getTime() <= new Date(fields.start_time).getTime()) {
        console.warn('end_time would precede new start_time:', { start: fields.start_time, end: base.end_time })
        return badRequest('end_time must be after start_time')
      }
    }

    if (!fields.start_time && fields.end_time) {
      if (new Date(fields.end_time).getTime() <= new Date(base.start_time).getTime()) {
        console.warn('New end_time precedes existing start_time:', { start: base.start_time, end: fields.end_time })
        return badRequest('end_time must be after start_time')
      }
    }

    if (Object.keys(fields).length > 0) {
      console.log('Updating single appointment fields:', fields)

      const { error: updateError } = await (supabase.from('appointments') as any).update(fields).eq('id', id)

      if (updateError) {
        console.error('Failed to update appointment:', {
          message: updateError.message,
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
          appointmentId: id,
          fields,
        })
        return serverError()
      }
    }

    if (invoiceInput) {
      console.log('Upserting invoice for appointment:', id)

      const { error: invoiceError } = await (supabase.from('invoices') as any).upsert(
        {
          appointment_id: id,
          amount_charged: invoiceInput.amount_charged,
          discount_amount: invoiceInput.discount_amount ?? 0,
          discount_reason: invoiceInput.discount_reason ?? null,
          is_paid: invoiceInput.is_paid ?? false,
        },
        { onConflict: 'appointment_id' },
      )

      if (invoiceError) {
        console.error('Failed to upsert appointment invoice:', {
          message: invoiceError.message,
          code: invoiceError.code,
          details: invoiceError.details,
          hint: invoiceError.hint,
          appointmentId: id,
        })
        return serverError()
      }
    }

    if (employeeIds) {
      console.log('Updating employee assignments for appointment:', { appointmentId: id, employeeIds })

      const { error: deleteAssignmentsError } = await supabase
        .from('appointment_employees')
        .delete()
        .eq('appointment_id', id)

      if (deleteAssignmentsError) {
        console.error('Failed to clear appointment assignments:', {
          message: deleteAssignmentsError.message,
          code: deleteAssignmentsError.code,
          details: deleteAssignmentsError.details,
          hint: deleteAssignmentsError.hint,
          appointmentId: id,
        })
        return serverError()
      }

      if (employeeIds.length > 0) {
        // Assignment accepts any valid profiles.id (admin or employee).
        const { error: insertAssignmentsError } = await supabase.from('appointment_employees').insert(
          employeeIds.map((employeeId) => ({
            appointment_id: id,
            employee_id: employeeId,
          })) as any,
        )

        if (insertAssignmentsError) {
          console.error('Failed to insert appointment assignments:', {
            message: insertAssignmentsError.message,
            code: insertAssignmentsError.code,
            details: insertAssignmentsError.details,
            hint: insertAssignmentsError.hint,
            appointmentId: id,
            employeeIds,
          })
          return serverError()
        }
      }
    }

    const { data: refreshed, error: refreshedError } = await supabase
      .from('appointments')
      .select('*, clients(*), homes!home_id(*), jobs!job_id(*)')
      .eq('id', id)
      .single()

    if (refreshedError) {
      if (refreshedError.code === 'PGRST116') {
        console.warn('Appointment not found after update — id:', id)
        return notFound()
      }

      console.error('Failed to fetch updated appointment:', {
        message: refreshedError.message,
        code: refreshedError.code,
        details: refreshedError.details,
        hint: refreshedError.hint,
        appointmentId: id,
      })
      return serverError()
    }

    const assignments = await getAssignments([id])

    if (hasMeaningfulUpdate) {
      const appointmentWithDetails = await getAppointmentWithDetails(supabase, id)

      if (appointmentWithDetails) {
        const notifyAction = appointmentWithDetails.status === 'cancelled' ? 'cancelled' : 'updated'
        console.log('Sending appointment notification:', { action: notifyAction, appointmentId: id })

        if (appointmentWithDetails.status === 'cancelled') {
          notifyAppointmentCancelled(appointmentWithDetails).catch(console.error)
        } else {
          notifyAppointmentUpdated(appointmentWithDetails).catch(console.error)
        }
      }
    }

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('appointment_id', id)
      .maybeSingle()

    console.log('Successfully updated appointment:', id)
    return jsonResponse({ ...mapAppointment(refreshed as unknown as AppointmentDetail, assignments), invoice: invoice ?? null }, 200)
  } catch (error) {
    console.error('Unexpected error updating appointment:', error)
    return serverError()
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params
  console.log('DELETE /api/appointments/:id — id:', id)

  const session = await getSessionAndRole(request)
  console.log('Session:', session)

  if (!session || session.role !== 'admin') {
    console.warn('Forbidden — session:', session)
    return forbidden()
  }

  const requestUrl = new URL(request.url)
  const scope = requestUrl.searchParams.get('scope')

  console.log('Delete scope:', scope)

  const supabase = await createClient()

  const { data: baseAppointment, error: baseError } = await supabase
    .from('appointments')
    .select('id, recurrence_series_id')
    .eq('id', id)
    .single()

  if (baseError || !baseAppointment) {
    if (baseError?.code === 'PGRST116') {
      console.warn('Appointment not found — id:', id)
      return notFound()
    }

    console.error('Failed to find appointment to delete:', {
      message: baseError?.message,
      code: baseError?.code,
      details: baseError?.details,
      hint: baseError?.hint,
      appointmentId: id,
    })
    return serverError()
  }

  const deleteBase = baseAppointment as unknown as { id: string; recurrence_series_id: string | null }

  try {
    if (scope === 'series' && deleteBase.recurrence_series_id) {
      console.log('Deleting appointment series — seriesId:', deleteBase.recurrence_series_id)

      let seriesNotificationAppointment: Awaited<ReturnType<typeof getSeriesNotificationAppointment>> = null

      try {
        seriesNotificationAppointment = await getSeriesNotificationAppointment(
          supabase,
          deleteBase.recurrence_series_id,
        )
      } catch (error) {
        console.warn('Failed to load series notification appointment; continuing delete:', {
          seriesId: deleteBase.recurrence_series_id,
          error,
        })
      }

      const { error: deleteSeriesError } = await supabase
        .from('recurrence_series')
        .delete()
        .eq('id', deleteBase.recurrence_series_id)

      if (deleteSeriesError) {
        console.warn('Falling back to direct appointment deletion for series:', {
          seriesId: deleteBase.recurrence_series_id,
          deleteSeriesError: deleteSeriesError
            ? {
                message: deleteSeriesError.message,
                code: deleteSeriesError.code,
                details: deleteSeriesError.details,
                hint: deleteSeriesError.hint,
              }
            : null,
        })

        const { data: deletedAppointments, error: deleteAppointmentsError } = await supabase
          .from('appointments')
          .delete()
          .eq('recurrence_series_id', deleteBase.recurrence_series_id)
          .select('id')

        if (deleteAppointmentsError) {
          console.error('Failed to delete appointment series:', {
            recurrenceSeriesError: deleteSeriesError
              ? {
                  message: deleteSeriesError.message,
                  code: deleteSeriesError.code,
                  details: deleteSeriesError.details,
                  hint: deleteSeriesError.hint,
                }
              : null,
            appointmentsError: {
              message: deleteAppointmentsError.message,
              code: deleteAppointmentsError.code,
              details: deleteAppointmentsError.details,
              hint: deleteAppointmentsError.hint,
            },
            seriesId: deleteBase.recurrence_series_id,
          })
          return serverError()
        }

        if ((deletedAppointments?.length ?? 0) === 0) {
          console.warn('No appointment rows deleted for recurrence series:', {
            seriesId: deleteBase.recurrence_series_id,
          })
          return notFound()
        }
      }

      if (seriesNotificationAppointment) {
        console.log('Sending cancellation notification for series:', deleteBase.recurrence_series_id)
        notifyAppointmentCancelled(seriesNotificationAppointment).catch(console.error)
      }

      console.log('Successfully deleted series:', deleteBase.recurrence_series_id)
      return jsonResponse({ success: true, scope: 'series' }, 200)
    }

    console.log('Deleting single appointment:', id)

    let appointmentWithDetails: Awaited<ReturnType<typeof getAppointmentWithDetails>> = null

    try {
      appointmentWithDetails = await getAppointmentWithDetails(supabase, id)
    } catch (error) {
      console.warn('Failed to load appointment details; continuing delete:', {
        appointmentId: id,
        error,
      })
    }

    const { error } = await supabase.from('appointments').delete().eq('id', id)

    if (error) {
      console.error('Failed to delete appointment:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        appointmentId: id,
      })
      return serverError()
    }

    if (appointmentWithDetails) {
      console.log('Sending cancellation notification for appointment:', id)
      notifyAppointmentCancelled(appointmentWithDetails).catch(console.error)
    }

    console.log('Successfully deleted appointment:', id)
    return jsonResponse({ success: true, scope: 'single' }, 200)
  } catch (error) {
    console.error('Unexpected error deleting appointment:', error)
    return serverError()
  }
}
import { z } from 'zod'

import { getAppointmentWithDetails } from '@/lib/api/appointments'
import { badRequest, forbidden, getSessionAndRole, serverError } from '@/lib/api/auth'
import { isValidRRule, materializeRecurrence } from '@/lib/calendar/recurrence'
import { notifyAppointmentCreated } from '@/lib/email/notifications'
import { createClient } from '@/lib/supabase/server'
import { AppointmentEmployee, ClientHome, Database } from '@/types'

const statusSchema = z.enum(['scheduled', 'completed', 'cancelled'])

const createAppointmentSchema = z
  .object({
    title: z.string().trim().min(1),
    client_id: z.string().uuid().optional(),
    home_id: z.string().uuid().optional(),
    job_id: z.string().uuid().optional(),
    start_time: z.string().datetime({ offset: true }),
    end_time: z.string().datetime({ offset: true }),
    notes: z.string().trim().min(1).optional(),
    employee_ids: z.array(z.string().uuid()).optional(),
    recurrence_rule: z.string().trim().min(1).optional(),
    status: statusSchema.optional(),
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
    if (new Date(value.end_time).getTime() <= new Date(value.start_time).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'end_time must be after start_time',
        path: ['end_time'],
      })
    }

    if (value.recurrence_rule && !isValidRRule(value.recurrence_rule)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid recurrence rule',
        path: ['recurrence_rule'],
      })
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

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

type AppointmentListRow = Database['public']['Tables']['appointments']['Row'] & {
  home_id: string | null
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

async function loadAssignmentsByAppointmentIds(appointmentIds: string[]) {
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

  const map = new Map<string, AssignmentRow[]>()

  for (const row of (data ?? []) as AssignmentRow[]) {
    const existing = map.get(row.appointment_id) ?? []
    existing.push(row)
    map.set(row.appointment_id, existing)
  }

  return map
}

function withDetails(
  appointments: AppointmentListRow[],
  assignmentsMap: Map<string, AssignmentRow[]>,
  role: 'admin' | 'employee',
) {
  return appointments.map((appointment) => {
    const assignments = assignmentsMap.get(appointment.id) ?? []
    const includeJobs = role === 'admin' || role === 'employee'

    return {
      ...appointment,
      clients: appointment.clients,
      jobs: includeJobs ? appointment.jobs : null,
      appointment_employees: assignments.map((assignment) => ({
        employee_id: assignment.employee_id,
        profiles: assignment.profiles,
      })),
    }
  })
}

export async function GET(request: Request) {
  const session = await getSessionAndRole(request)

  if (!session) {
    return forbidden()
  }

  const requestUrl = new URL(request.url)
  const start = requestUrl.searchParams.get('start')
  const end = requestUrl.searchParams.get('end')
  const employeeId = requestUrl.searchParams.get('employeeId')

  if ((start && Number.isNaN(Date.parse(start))) || (end && Number.isNaN(Date.parse(end)))) {
    return badRequest('Invalid start or end date')
  }

  if (employeeId && session.role !== 'admin') {
    return forbidden()
  }

  const supabase = await createClient()

  try {
    let appointmentIdsFilter: string[] | null = null

    if (employeeId && session.role === 'admin') {
      const { data: assignedRows, error: assignedError } = await supabase
        .from('appointment_employees')
        .select('appointment_id')
        .eq('employee_id', employeeId)

      if (assignedError) {
        console.error('Failed to resolve employee assignment filter', assignedError)
        return serverError()
      }


      appointmentIdsFilter = (assignedRows as AppointmentEmployee[] ?? []).map((row) => row.appointment_id)
      if (appointmentIdsFilter.length === 0) {
        return jsonResponse([], 200)
      }
    }

    let query = supabase
      .from('appointments')
      .select('*, clients(*), client_homes!home_id(*), jobs!job_id(*)')
      .order('start_time', { ascending: true })

    if (start) {
      query = query.gte('start_time', start)
    }

    if (end) {
      query = query.lte('start_time', end)
    }

    if (appointmentIdsFilter) {
      query = query.in('id', appointmentIdsFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch appointments', error)
      return serverError()
    }

    const appointments = (data ?? []) as AppointmentListRow[]
    const assignmentsMap = await loadAssignmentsByAppointmentIds(appointments.map((item) => item.id))

    return jsonResponse(withDetails(appointments, assignmentsMap, session.role), 200)
  } catch (error) {
    console.error('Failed to load appointments', error)
    return serverError()
  }
}

export async function POST(request: Request) {
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

  const parsed = createAppointmentSchema.safeParse(body)

  if (!parsed.success) {
    return jsonResponse(parsed.error.flatten(), 400)
  }

  const input = parsed.data
  const employeeIds = input.employee_ids ?? []

  const supabase = await createClient()

  if (input.home_id && input.client_id) {
    const { data: homeCheck, error: homeCheckError } = await supabase
      .from('client_homes')
      .select('client_id')
      .eq('id', input.home_id)
      .single()

    if (homeCheckError || !homeCheck || homeCheck.client_id !== input.client_id) {
      return badRequest('home_id does not belong to the selected client')
    }
  }

  try {
    if (!input.recurrence_rule) {
      const { data: appointment, error: insertError } = await supabase
        .from('appointments')
        .insert({
          title: input.title,
          client_id: input.client_id,
          home_id: input.home_id,
          job_id: input.job_id,
          start_time: input.start_time,
          end_time: input.end_time,
          notes: input.notes,
          status: input.status,
        })
        .select('*')
        .single()

      if (insertError || !appointment) {
        console.error('Failed to create appointment', insertError)
        return serverError()
      }

      if (input.invoice) {
        const { error: invoiceError } = await supabase.from('appointment_invoices').insert({
          appointment_id: appointment.id,
          amount_charged: input.invoice.amount_charged,
          discount_amount: input.invoice.discount_amount ?? 0,
          discount_reason: input.invoice.discount_reason ?? null,
          is_paid: input.invoice.is_paid ?? false,
        })

        if (invoiceError) {
          console.error('Failed to create appointment invoice', invoiceError)
          return serverError()
        }
      }

      if (employeeIds.length > 0) {
        const { error: assignmentError } = await supabase.from('appointment_employees').insert(
          employeeIds.map((employeeId) => ({
            appointment_id: appointment.id,
            employee_id: employeeId,
          })),
        )

        if (assignmentError) {
          console.error('Failed to assign employees to appointment', assignmentError)
          return serverError()
        }
      }

      void (async () => {
        const appointmentWithDetails = await getAppointmentWithDetails(supabase, appointment.id)

        if (appointmentWithDetails) {
          await notifyAppointmentCreated(appointmentWithDetails)
        }
      })().catch((error) => {
        console.error('Failed to send appointment created notification', error)
      })

      return jsonResponse([appointment], 201)
    }

    const seriesId = crypto.randomUUID()

    const { data: master, error: masterError } = await supabase
      .from('appointments')
      .insert({
        title: input.title,
        client_id: input.client_id,
        home_id: input.home_id,
        job_id: input.job_id,
        start_time: input.start_time,
        end_time: input.end_time,
        notes: input.notes,
        status: input.status,
        recurrence_series_id: seriesId,
        recurrence_rule: input.recurrence_rule,
        is_master: true,
      })
      .select('*')
      .single()

    if (masterError || !master) {
      console.error('Failed to create recurrence master appointment', masterError)
      return serverError()
    }

    if (input.invoice) {
      const { error: invoiceError } = await supabase.from('appointment_invoices').insert({
        appointment_id: master.id,
        amount_charged: input.invoice.amount_charged,
        discount_amount: input.invoice.discount_amount ?? 0,
        discount_reason: input.invoice.discount_reason ?? null,
        is_paid: input.invoice.is_paid ?? false,
      })

      if (invoiceError) {
        console.error('Failed to create recurrence master invoice', invoiceError)
        return serverError()
      }
    }

    const instances = materializeRecurrence(
      new Date(input.start_time),
      new Date(input.end_time),
      input.recurrence_rule,
    )

    const nonMasterInstances = instances.filter(
      (instance) => instance.start_time.toISOString() !== new Date(input.start_time).toISOString(),
    )

    let createdInstances: Database['public']['Tables']['appointments']['Row'][] = []

    if (nonMasterInstances.length > 0) {
      const { data: insertedInstances, error: instancesError } = await supabase
        .from('appointments')
        .insert(
          nonMasterInstances.map((instance) => ({
            title: input.title,
            client_id: input.client_id,
            home_id: input.home_id,
            job_id: input.job_id,
            start_time: instance.start_time.toISOString(),
            end_time: instance.end_time.toISOString(),
            notes: input.notes,
            status: input.status,
            recurrence_series_id: seriesId,
            is_master: false,
          })),
        )
        .select('*')

      if (instancesError) {
        console.error('Failed to create recurrence instances', instancesError)
        return serverError()
      }

      createdInstances = insertedInstances ?? []
    }

    if (employeeIds.length > 0 && createdInstances.length > 0) {
      const assignmentRows = createdInstances.flatMap((appointment) =>
        employeeIds.map((employeeId) => ({
          appointment_id: appointment.id,
          employee_id: employeeId,
        })),
      ) as AppointmentEmployee[]

      const { error: assignmentsError } = await supabase.from('appointment_employees').insert(assignmentRows)

      if (assignmentsError) {
        console.error('Failed to assign employees to recurrence instances', assignmentsError)
        return serverError()
      }
    }

    const notificationAppointmentId = createdInstances[0]?.id ?? master.id

    void (async () => {
      const appointmentWithDetails = await getAppointmentWithDetails(supabase, notificationAppointmentId)

      if (appointmentWithDetails) {
        await notifyAppointmentCreated(appointmentWithDetails)
      }
    })().catch((error) => {
      console.error('Failed to send appointment created notification', error)
    })

    return jsonResponse([master, ...createdInstances], 201)
  } catch (error) {
    console.error('Failed to create appointment', error)
    return serverError()
  }
}
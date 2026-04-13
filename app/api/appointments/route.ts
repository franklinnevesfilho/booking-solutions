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
    status: statusSchema.optional().default('scheduled'),
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
    console.error('Failed to load assignments:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      appointmentIds,
    })
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
  console.log('GET /api/appointments — session:', session)

  if (!session) {
    console.warn('Forbidden — no session')
    return forbidden()
  }

  const requestUrl = new URL(request.url)
  const start = requestUrl.searchParams.get('start')
  const end = requestUrl.searchParams.get('end')
  const employeeId = requestUrl.searchParams.get('employeeId')
  const clientId = requestUrl.searchParams.get('clientId')
  const homeId = requestUrl.searchParams.get('homeId')

  console.log('Query params:', { start, end, employeeId, clientId, homeId })

  if ((start && Number.isNaN(Date.parse(start))) || (end && Number.isNaN(Date.parse(end)))) {
    console.warn('Invalid date params:', { start, end })
    return badRequest('Invalid start or end date')
  }

  if (clientId) {
    const parsedClientId = z.string().uuid().safeParse(clientId)
    if (!parsedClientId.success) {
      console.warn('Invalid clientId param:', { clientId })
      return badRequest('Invalid clientId')
    }
  }

  if (homeId) {
    const parsedHomeId = z.string().uuid().safeParse(homeId)
    if (!parsedHomeId.success) {
      console.warn('Invalid homeId param:', { homeId })
      return badRequest('Invalid homeId')
    }
  }

  if (employeeId && session.role !== 'admin') {
    console.warn('Forbidden — non-admin requested employeeId filter:', { employeeId, role: session.role })
    return forbidden()
  }

  if ((clientId || homeId) && session.role !== 'admin') {
    console.warn('Forbidden — non-admin requested client/home filter:', {
      clientId,
      homeId,
      role: session.role,
    })
    return forbidden()
  }

  const supabase = await createClient()

  try {
    let appointmentIdsFilter: string[] | null = null

    if (employeeId && session.role === 'admin') {
      console.log('Resolving appointment IDs for employeeId:', employeeId)

      const { data: assignedRows, error: assignedError } = await supabase
        .from('appointment_employees')
        .select('appointment_id')
        .eq('employee_id', employeeId)

      if (assignedError) {
        console.error('Failed to resolve employee assignment filter:', {
          message: assignedError.message,
          code: assignedError.code,
          details: assignedError.details,
          hint: assignedError.hint,
          employeeId,
        })
        return serverError()
      }

      appointmentIdsFilter = (assignedRows as AppointmentEmployee[] ?? []).map((row) => row.appointment_id)
      console.log('Resolved appointment IDs for employee:', { employeeId, count: appointmentIdsFilter.length })

      if (appointmentIdsFilter.length === 0) {
        return jsonResponse([], 200)
      }
    }

    let query = supabase
      .from('appointments')
      .select('*, clients(*), homes!home_id(*), jobs!job_id(*)')
      .order('start_time', { ascending: true })

    if (start) query = query.gte('start_time', start)
    if (end) query = query.lte('start_time', end)
    
    // With this:
    if (clientId) {
      const { data: homes, error: homesError } = await supabase
        .from('homes')
        .select('id')
        .eq('client_id', clientId)
    
      if (homesError) {
        console.error('Failed to fetch client homes for filter:', homesError)
        return serverError()
      }
    
      const homeIds = (homes ?? []).map((h) => h.id)
    
      if (homeId) {
        // A specific home is selected — homeId filter below handles it, skip the OR
        query = query.eq('home_id', homeId)
      } else if (homeIds.length > 0) {
        query = query.or(`client_id.eq.${clientId},home_id.in.(${homeIds.join(',')})`)
      } else {
        query = query.eq('client_id', clientId)
      }
    }

    if (appointmentIdsFilter) query = query.in('id', appointmentIdsFilter)

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch appointments:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        filters: { start, end, employeeId, clientId, homeId },
      })
      return serverError()
    }

    const appointments = (data ?? []) as AppointmentListRow[]
    console.log('Fetched appointments:', appointments.length)

    const assignmentsMap = await loadAssignmentsByAppointmentIds(appointments.map((item) => item.id))

    return jsonResponse(withDetails(appointments, assignmentsMap, session.role), 200)
  } catch (error) {
    console.error('Unexpected error loading appointments:', error)
    return serverError()
  }
}

export async function POST(request: Request) {
  const session = await getSessionAndRole(request)
  console.log('POST /api/appointments — session:', session)

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

  const parsed = createAppointmentSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed)
  }

  const input = parsed.data
  const employeeIds = input.employee_ids ?? []

  console.log('Parsed input:', JSON.stringify(input, null, 2))

  const supabase = await createClient()

  if (input.home_id && input.client_id) {
    console.log('Verifying home belongs to client:', { homeId: input.home_id, clientId: input.client_id })

    const { data: homeCheck, error: homeCheckError } = await supabase
      .from('homes')
      .select('client_id')
      .eq('id', input.home_id)
      .single()

    if (homeCheckError) {
      console.error('Failed to verify home ownership:', {
        message: homeCheckError.message,
        code: homeCheckError.code,
        details: homeCheckError.details,
        hint: homeCheckError.hint,
        homeId: input.home_id,
        clientId: input.client_id,
      })
    }

    if (homeCheckError || !homeCheck || homeCheck.client_id !== input.client_id) {
      console.warn('home_id does not belong to client:', {
        homeId: input.home_id,
        clientId: input.client_id,
        actualClientId: homeCheck?.client_id,
      })
      return badRequest('home_id does not belong to the selected client')
    }
  }

  try {
    if (!input.recurrence_rule) {
      console.log('Creating single appointment')

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
        console.error('Failed to create appointment:', {
          message: insertError?.message,
          code: insertError?.code,
          details: insertError?.details,
          hint: insertError?.hint,
        })
        return serverError()
      }

      console.log('Created appointment:', appointment.id)

      if (input.invoice) {
        console.log('Creating invoice for appointment:', appointment.id)

        const { error: invoiceError } = await supabase.from('invoices').insert({
          appointment_id: appointment.id,
          amount_charged: input.invoice.amount_charged,
          discount_amount: input.invoice.discount_amount ?? 0,
          discount_reason: input.invoice.discount_reason ?? null,
          is_paid: input.invoice.is_paid ?? false,
        })

        if (invoiceError) {
          console.error('Failed to create appointment invoice:', {
            message: invoiceError.message,
            code: invoiceError.code,
            details: invoiceError.details,
            hint: invoiceError.hint,
            appointmentId: appointment.id,
          })
          return serverError()
        }
      }

      if (employeeIds.length > 0) {
        console.log('Assigning employees to appointment:', { appointmentId: appointment.id, employeeIds })

        // Assignment accepts any valid profiles.id (admin or employee).
        const { error: assignmentError } = await supabase.from('appointment_employees').insert(
          employeeIds.map((employeeId) => ({
            appointment_id: appointment.id,
            employee_id: employeeId,
          })),
        )

        if (assignmentError) {
          console.error('Failed to assign employees to appointment:', {
            message: assignmentError.message,
            code: assignmentError.code,
            details: assignmentError.details,
            hint: assignmentError.hint,
            appointmentId: appointment.id,
            employeeIds,
          })
          return serverError()
        }
      }

      void (async () => {
        const appointmentWithDetails = await getAppointmentWithDetails(supabase, appointment.id)
        if (appointmentWithDetails) {
          await notifyAppointmentCreated(appointmentWithDetails)
        }
      })().catch((error) => {
        console.error('Failed to send appointment created notification:', error)
      })

      return jsonResponse([appointment], 201)
    }

    console.log('Creating recurring appointment series with rule:', input.recurrence_rule)

    const seriesId = crypto.randomUUID()
    console.log('Series ID:', seriesId)

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
      console.error('Failed to create recurrence master appointment:', {
        message: masterError?.message,
        code: masterError?.code,
        details: masterError?.details,
        hint: masterError?.hint,
        seriesId,
      })
      return serverError()
    }

    console.log('Created master appointment:', master.id)

    if (input.invoice) {
      console.log('Creating invoice for master appointment:', master.id)

      const { error: invoiceError } = await supabase.from('invoices').insert({
        appointment_id: master.id,
        amount_charged: input.invoice.amount_charged,
        discount_amount: input.invoice.discount_amount ?? 0,
        discount_reason: input.invoice.discount_reason ?? null,
        is_paid: input.invoice.is_paid ?? false,
      })

      if (invoiceError) {
        console.error('Failed to create recurrence master invoice:', {
          message: invoiceError.message,
          code: invoiceError.code,
          details: invoiceError.details,
          hint: invoiceError.hint,
          appointmentId: master.id,
        })
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

    console.log('Materialized recurrence instances:', {
      total: instances.length,
      nonMaster: nonMasterInstances.length,
      seriesId,
    })

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
        console.error('Failed to create recurrence instances:', {
          message: instancesError.message,
          code: instancesError.code,
          details: instancesError.details,
          hint: instancesError.hint,
          seriesId,
          instanceCount: nonMasterInstances.length,
        })
        return serverError()
      }

      createdInstances = insertedInstances ?? []
      console.log('Created recurrence instances:', createdInstances.length)
    }

    if (employeeIds.length > 0 && createdInstances.length > 0) {
      console.log('Assigning employees to recurrence instances:', {
        employeeIds,
        instanceCount: createdInstances.length,
      })

      // Assignment accepts any valid profiles.id (admin or employee).
      const assignmentRows = createdInstances.flatMap((appointment) =>
        employeeIds.map((employeeId) => ({
          appointment_id: appointment.id,
          employee_id: employeeId,
        })),
      ) as AppointmentEmployee[]

      const { error: assignmentsError } = await supabase.from('appointment_employees').insert(assignmentRows)

      if (assignmentsError) {
        console.error('Failed to assign employees to recurrence instances:', {
          message: assignmentsError.message,
          code: assignmentsError.code,
          details: assignmentsError.details,
          hint: assignmentsError.hint,
          employeeIds,
          seriesId,
        })
        return serverError()
      }
    }

    const notificationAppointmentId = createdInstances[0]?.id ?? master.id
    console.log('Sending notification for appointment:', notificationAppointmentId)

    void (async () => {
      const appointmentWithDetails = await getAppointmentWithDetails(supabase, notificationAppointmentId)
      if (appointmentWithDetails) {
        await notifyAppointmentCreated(appointmentWithDetails)
      }
    })().catch((error) => {
      console.error('Failed to send appointment created notification:', error)
    })

    return jsonResponse([master, ...createdInstances], 201)
  } catch (error) {
    console.error('Unexpected error creating appointment:', error)
    return serverError()
  }
}
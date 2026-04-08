import type { SupabaseClient } from '@supabase/supabase-js'

import type { AppointmentWithDetails, ClientHome, Database, Profile } from '@/types'

type AppointmentRowWithClient = Database['public']['Tables']['appointments']['Row'] & {
  clients: Database['public']['Tables']['clients']['Row'] | null
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

type AssignmentRowWithProfile = {
  employee_id: string
  profiles: Profile | Profile[] | null
}

const logger = {
  info: (msg: string, meta?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: 'info', msg, ...meta, ts: new Date().toISOString() })),
  warn: (msg: string, meta?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ level: 'warn', msg, ...meta, ts: new Date().toISOString() })),
  error: (msg: string, meta?: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: 'error', msg, ...meta, ts: new Date().toISOString() })),
}

/**
 * Fetch a single appointment with client and employee details.
 * Returns null if not found.
 */
export async function getAppointmentWithDetails(
  supabase: SupabaseClient,
  appointmentId: string,
): Promise<AppointmentWithDetails | null> {
  logger.info('Fetching appointment with details', { appointmentId })

  const { data: appointmentRow, error: appointmentError } = await supabase
    .from('appointments')
    .select('*, clients(*), client_homes!home_id(*), jobs!job_id(*)')
    .eq('id', appointmentId)
    .single()

  if (appointmentError) {
    if (appointmentError.code === 'PGRST116') {
      logger.warn('Appointment not found', { appointmentId })
      return null
    }

    logger.error('Failed to fetch appointment', { appointmentId, error: appointmentError.message, code: appointmentError.code })
    throw appointmentError
  }

  logger.info('Fetched appointment row', { appointmentId })

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from('appointment_employees')
    .select('employee_id, profiles!appointment_employees_employee_id_fkey(*)')
    .eq('appointment_id', appointmentId)

  if (assignmentError) {
    logger.error('Failed to fetch appointment employees', { appointmentId, error: assignmentError.message, code: assignmentError.code })
    throw assignmentError
  }

  const appointment = appointmentRow as AppointmentRowWithClient
  const employees = ((assignmentRows ?? []) as AssignmentRowWithProfile[])
    .map((assignment) => (Array.isArray(assignment.profiles) ? assignment.profiles[0] : assignment.profiles))
    .filter((profile): profile is Profile => Boolean(profile))

  logger.info('Resolved employees for appointment', { appointmentId, employeeCount: employees.length })

  const { clients, client_homes, jobs: jobRow, status, ...appointmentFields } = appointment

  const { data: invoiceRow, error: invoiceError } = await supabase
    .from('appointment_invoices')
    .select('*')
    .eq('appointment_id', appointmentId)
    .maybeSingle()

  if (invoiceError) {
    logger.error('Failed to fetch appointment invoice', { appointmentId, error: invoiceError.message, code: invoiceError.code })
    throw invoiceError
  }

  if (!invoiceRow) {
    logger.info('No invoice found for appointment', { appointmentId })
  }

  const invoice = invoiceRow
    ? {
        id: invoiceRow.id,
        appointment_id: invoiceRow.appointment_id,
        amount_charged: invoiceRow.amount_charged,
        discount_amount: invoiceRow.discount_amount,
        discount_reason: invoiceRow.discount_reason,
        is_paid: invoiceRow.is_paid,
        created_at: invoiceRow.created_at,
        updated_at: invoiceRow.updated_at,
      }
    : null

  logger.info('Successfully assembled appointment with details', {
    appointmentId,
    hasClient: Boolean(clients),
    hasHome: Boolean(client_homes),
    hasJob: Boolean(jobRow),
    hasInvoice: Boolean(invoice),
    employeeCount: employees.length,
    status,
  })

  return {
    ...appointmentFields,
    status: status as AppointmentWithDetails['status'],
    client: clients,
    home: client_homes,
    job: jobRow ?? null,
    invoice,
    employees,
  }
}

export async function getSeriesNotificationAppointment(
  supabase: SupabaseClient,
  recurrenceSeriesId: string,
): Promise<AppointmentWithDetails | null> {
  logger.info('Fetching series notification appointment', { recurrenceSeriesId })

  const { data: seriesRows, error: seriesError } = await supabase
    .from('appointments')
    .select('id')
    .eq('recurrence_series_id', recurrenceSeriesId)
    .order('start_time', { ascending: true })

  if (seriesError) {
    logger.error('Failed to fetch series appointment IDs', { recurrenceSeriesId, error: seriesError.message, code: seriesError.code })
    throw seriesError
  }

  const appointmentIds = (seriesRows ?? []).map((row) => row.id)

  if (appointmentIds.length === 0) {
    logger.warn('No appointments found for recurrence series', { recurrenceSeriesId })
    return null
  }

  logger.info('Found appointments in series', { recurrenceSeriesId, count: appointmentIds.length })

  const representative = await getAppointmentWithDetails(supabase, appointmentIds[0])

  if (!representative) {
    logger.warn('Representative appointment not found for series', { recurrenceSeriesId, appointmentId: appointmentIds[0] })
    return null
  }

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from('appointment_employees')
    .select('employee_id, profiles!appointment_employees_employee_id_fkey(*)')
    .in('appointment_id', appointmentIds)

  if (assignmentError) {
    logger.error('Failed to fetch employees across series', { recurrenceSeriesId, error: assignmentError.message, code: assignmentError.code })
    throw assignmentError
  }

  const employeesById = new Map<string, Profile>()

  for (const assignment of (assignmentRows ?? []) as AssignmentRowWithProfile[]) {
    const profile = Array.isArray(assignment.profiles) ? assignment.profiles[0] : assignment.profiles

    if (profile && !employeesById.has(assignment.employee_id)) {
      employeesById.set(assignment.employee_id, profile)
    }
  }

  logger.info('Successfully assembled series notification appointment', {
    recurrenceSeriesId,
    totalAppointments: appointmentIds.length,
    uniqueEmployeeCount: employeesById.size,
  })

  return {
    ...representative,
    employees: Array.from(employeesById.values()),
  }
}
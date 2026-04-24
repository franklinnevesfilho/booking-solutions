import type { SupabaseClient } from '@supabase/supabase-js'

import type { AppointmentWithDetails, ClientHome, Database, Profile } from '@/types'

type AppointmentRowWithClient = Database['public']['Tables']['appointments']['Row'] & {
  clients: Database['public']['Tables']['clients']['Row'] | null
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

type AssignmentRowWithProfile = {
  employee_id: string
  profiles: Profile | Profile[] | null
}

type UserScheduleAppointmentRow = Database['public']['Tables']['appointments']['Row'] & {
  clients: Database['public']['Tables']['clients']['Row'] | null
  homes: ClientHome | null
  jobs: Database['public']['Tables']['jobs']['Row'] | null
}

type UserScheduleAssignmentRow = {
  appointment_id: string
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
    .select('*, clients(*), homes!home_id(*), jobs!job_id(*)')
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

  const { clients, homes, jobs: jobRow, status, ...appointmentFields } = appointment

  let recurrenceSeries = null
  if ((appointmentFields as { recurrence_series_id?: string | null }).recurrence_series_id) {
    const { data: seriesRow } = await supabase
      .from('recurrence_series')
      .select('*')
      .eq('id', (appointmentFields as { recurrence_series_id: string }).recurrence_series_id)
      .maybeSingle()
    recurrenceSeries = seriesRow ?? null
  }

  const { data: invoiceRow, error: invoiceError } = await supabase
    .from('invoices')
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
    hasHome: Boolean(homes),
    hasJob: Boolean(jobRow),
    hasInvoice: Boolean(invoice),
    employeeCount: employees.length,
    status,
  })

  return {
    ...appointmentFields,
    status: status as AppointmentWithDetails['status'],
    recurrence_series: recurrenceSeries,
    client: clients,
    home: homes,
    job: jobRow ?? null,
    invoice,
    employees,
  }
}

/**
 * Returns all appointments where appointment_employees.employee_id = userId.
 * Works for both admin and employee roles.
 */
export async function getAppointmentsForUser(
  supabase: SupabaseClient,
  userId: string,
  start?: string,
  end?: string,
): Promise<AppointmentWithDetails[]> {
  logger.info('Fetching appointments for user schedule', { userId, start, end })

  const { data: assignedRows, error: assignedError } = await supabase
    .from('appointment_employees')
    .select('appointment_id')
    .eq('employee_id', userId)

  if (assignedError) {
    logger.error('Failed to fetch assignment rows for user', { userId, error: assignedError.message, code: assignedError.code })
    throw assignedError
  }

  const appointmentIds = (assignedRows ?? []).map((row) => row.appointment_id)

  if (appointmentIds.length === 0) {
    logger.info('No assigned appointments found for user', { userId })
    return []
  }

  let appointmentsQuery = supabase
    .from('appointments')
    .select('*, clients(*), homes!home_id(*), jobs!job_id(*)')
    .in('id', appointmentIds)
    .order('start_time', { ascending: true })

  if (start) {
    appointmentsQuery = appointmentsQuery.gte('start_time', start)
  }

  if (end) {
    appointmentsQuery = appointmentsQuery.lte('start_time', end)
  }

  const { data: appointmentRows, error: appointmentsError } = await appointmentsQuery

  if (appointmentsError) {
    logger.error('Failed to fetch appointments for user', { userId, error: appointmentsError.message, code: appointmentsError.code })
    throw appointmentsError
  }

  const appointments = (appointmentRows ?? []) as unknown as UserScheduleAppointmentRow[]

  if (appointments.length === 0) {
    logger.info('No appointments found in requested range for user', { userId, start, end })
    return []
  }

  const { data: assignmentRows, error: assignmentsError } = await supabase
    .from('appointment_employees')
    .select('appointment_id, employee_id, profiles!appointment_employees_employee_id_fkey(*)')
    .in('appointment_id', appointments.map((appointment) => appointment.id))

  if (assignmentsError) {
    logger.error('Failed to fetch assignment details for user appointments', {
      userId,
      error: assignmentsError.message,
      code: assignmentsError.code,
    })
    throw assignmentsError
  }

  const assignmentsByAppointment = new Map<string, Profile[]>()

  for (const row of (assignmentRows ?? []) as UserScheduleAssignmentRow[]) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles

    if (!profile) {
      continue
    }

    const existing = assignmentsByAppointment.get(row.appointment_id) ?? []
    existing.push(profile)
    assignmentsByAppointment.set(row.appointment_id, existing)
  }

  logger.info('Successfully assembled appointments for user schedule', {
    userId,
    appointmentCount: appointments.length,
    assignmentCount: (assignmentRows ?? []).length,
  })

  return appointments.map((appointment) => ({
    id: appointment.id,
    client_id: appointment.client_id,
    home_id: appointment.home_id,
    job_id: appointment.job_id,
    title: appointment.title,
    start_time: appointment.start_time,
    end_time: appointment.end_time,
    status: appointment.status as AppointmentWithDetails['status'],
    notes: appointment.notes,
    recurrence_series_id: appointment.recurrence_series_id,
    is_master: appointment.is_master,
    created_at: appointment.created_at,
    updated_at: appointment.updated_at,
    client: appointment.clients,
    home: appointment.homes,
    job: appointment.jobs,
    invoice: null,
    employees: assignmentsByAppointment.get(appointment.id) ?? [],
  }))
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
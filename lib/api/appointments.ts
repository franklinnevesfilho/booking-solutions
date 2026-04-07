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

/**
 * Fetch a single appointment with client and employee details.
 * Returns null if not found.
 */
export async function getAppointmentWithDetails(
  supabase: SupabaseClient,
  appointmentId: string,
): Promise<AppointmentWithDetails | null> {
  const { data: appointmentRow, error: appointmentError } = await supabase
    .from('appointments')
    .select('*, clients(*), client_homes!home_id(*), jobs!job_id(*)')
    .is('id', appointmentId)
    .single()

  if (appointmentError) {
    if (appointmentError.code === 'PGRST116') {
      return null
    }

    throw appointmentError
  }

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from('appointment_employees')
    .select('employee_id, profiles!appointment_employees_employee_id_fkey(*)')
    .is('appointment_id', appointmentId)

  if (assignmentError) {
    throw assignmentError
  }

  const appointment = appointmentRow as AppointmentRowWithClient
  const employees = ((assignmentRows ?? []) as AssignmentRowWithProfile[])
    .map((assignment) => (Array.isArray(assignment.profiles) ? assignment.profiles[0] : assignment.profiles))
    .filter((profile): profile is Profile => Boolean(profile))

  const { clients, client_homes, jobs: jobRow, ...appointmentFields } = appointment

  return {
    ...appointmentFields,
    client: clients,
    home: client_homes,
    job: jobRow ?? null,
    employees,
  }
}

export async function getSeriesNotificationAppointment(
  supabase: SupabaseClient,
  recurrenceSeriesId: string,
): Promise<AppointmentWithDetails | null> {
  const { data: seriesRows, error: seriesError } = await supabase
    .from('appointments')
    .select('id')
    .is('recurrence_series_id', recurrenceSeriesId)
    .order('start_time', { ascending: true })

  if (seriesError) {
    throw seriesError
  }

  const appointmentIds = (seriesRows ?? []).map((row) => row.id)

  if (appointmentIds.length === 0) {
    return null
  }

  const representative = await getAppointmentWithDetails(supabase, appointmentIds[0])

  if (!representative) {
    return null
  }

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from('appointment_employees')
    .select('employee_id, profiles!appointment_employees_employee_id_fkey(*)')
    .in('appointment_id', appointmentIds)

  if (assignmentError) {
    throw assignmentError
  }

  const employeesById = new Map<string, Profile>()

  for (const assignment of (assignmentRows ?? []) as AssignmentRowWithProfile[]) {
    const profile = Array.isArray(assignment.profiles) ? assignment.profiles[0] : assignment.profiles

    if (profile && !employeesById.has(assignment.employee_id)) {
      employeesById.set(assignment.employee_id, profile)
    }
  }

  return {
    ...representative,
    employees: Array.from(employeesById.values()),
  }
}
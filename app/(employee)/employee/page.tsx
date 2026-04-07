import { addWeeks } from 'date-fns'

import { EmployeeCalendar } from '@/components/employee/EmployeeCalendar'
import { createClient } from '@/lib/supabase/server'
import type { AppointmentWithDetails } from '@/types'

type AppointmentRow = {
  id: string
  client_id: string | null
  home_id: string | null
  title: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'completed' | 'cancelled'
  notes: string | null
  recurrence_series_id: string | null
  recurrence_rule: string | null
  is_master: boolean
  job_id: string | null
  created_at: string
  updated_at: string
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
}

type AssignmentRow = {
  appointment_id: string
  employee_id: string
  profiles: {
    id: string
    full_name: string
    phone: string | null
    role: 'admin' | 'employee'
    is_active: boolean
    created_at: string
    updated_at: string
  } | null
}

type EmployeeAppointmentRow = {
  appointment_id: string
}

export default async function EmployeeSchedulePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <EmployeeCalendar initialAppointments={[]} />
  }

  const now = new Date()
  const rangeStart = now.toISOString()
  const rangeEnd = addWeeks(now, 8).toISOString()

  const { data: employeeAppointmentRows, error: employeeAppointmentError } = await supabase
    .from('appointment_employees')
    .select('appointment_id')
    .filter('employee_id', 'eq', user.id)

  if (employeeAppointmentError) {
    throw new Error('Failed to load employee appointments')
  }

  const appointmentIds = ((employeeAppointmentRows ?? []) as EmployeeAppointmentRow[]).map((row) => row.appointment_id)

  if (appointmentIds.length === 0) {
    return <EmployeeCalendar initialAppointments={[]} />
  }

  const { data: appointmentRows, error: appointmentsError } = await supabase
    .from('appointments')
    .select('*, clients(*)')
    .contains('id', appointmentIds)
    .gte('start_time', rangeStart)
    .lte('start_time', rangeEnd)
    .order('start_time', { ascending: true })

  if (appointmentsError) {
    throw new Error('Failed to load employee schedule')
  }

  const filteredAppointments = (appointmentRows ?? []) as unknown as AppointmentRow[]

  if (filteredAppointments.length === 0) {
    return <EmployeeCalendar initialAppointments={[]} />
  }

  const { data: assignmentRows, error: assignmentsError } = await supabase
    .from('appointment_employees')
    .select('appointment_id, employee_id, profiles!appointment_employees_employee_id_fkey(*)')
   .contains('appointment_id', filteredAppointments.map((appt) => appt.id) as any)

  if (assignmentsError) {
    throw new Error('Failed to load employee assignment details')
  }

  const assignmentsByAppointment = ((assignmentRows ?? []) as unknown as AssignmentRow[]).reduce((map, row) => {
    const assignment = row as unknown as AssignmentRow
    const existing = map.get(assignment.appointment_id) ?? []
    existing.push(assignment)
    map.set(assignment.appointment_id, existing)
    return map
  }, new Map<string, AssignmentRow[]>())

  const appointments: AppointmentWithDetails[] = filteredAppointments.map((appointment) => ({
    id: appointment.id,
    client_id: appointment.client_id,
    home_id: appointment.home_id,
    home: null,
    job_id: appointment.job_id ?? null,
    job: null,
    title: appointment.title,
    start_time: appointment.start_time,
    end_time: appointment.end_time,
    status: appointment.status,
    notes: appointment.notes,
    recurrence_series_id: appointment.recurrence_series_id,
    recurrence_rule: appointment.recurrence_rule,
    is_master: appointment.is_master,
    created_at: appointment.created_at,
    updated_at: appointment.updated_at,
    client: appointment.clients,
    employees:
      assignmentsByAppointment
        .get(appointment.id)
        ?.map((assignment) => assignment.profiles)
        .filter(
          (
            profile,
          ): profile is {
            id: string
            full_name: string
            phone: string | null
            role: 'admin' | 'employee'
            is_active: boolean
            created_at: string
            updated_at: string
          } => Boolean(profile),
        ) ?? [],
  }))

  return <EmployeeCalendar initialAppointments={appointments} />
}

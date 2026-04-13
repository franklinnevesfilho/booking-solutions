import { addMonths, endOfMonth, startOfMonth, subMonths } from 'date-fns'

import { AdminCalendar } from '@/components/admin/AdminCalendar'
import { createClient } from '@/lib/supabase/server'
import type { AppointmentWithDetails, ClientWithHomes } from '@/types/composed'
import type { Profile } from '@/types/models'

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

export default async function AdminCalendarPage() {
  const supabase = await createClient()

  const now = new Date()
  const start = startOfMonth(subMonths(now, 1)).toISOString()
  const end = endOfMonth(addMonths(now, 1)).toISOString()

  const { data: appointmentsData, error } = await supabase
    .from('appointments')
    .select('*, clients(*)')
    .gte('start_time', start)
    .lte('start_time', end)
    .order('start_time', { ascending: true })

  if (error) {
    throw new Error('Failed to load appointments')
  }

  const { data: clientsData, error: clientsError } = await supabase
    .from('clients')
    .select('*, homes(*)')
    .order('full_name', { ascending: true })

  if (clientsError) {
    throw new Error('Failed to load clients')
  }

  const { data: employeesData, error: employeesError } = await supabase
    .from('profiles')
    .select('id, full_name, phone, is_active, created_at, updated_at, role')
    .in('role', ['employee', 'admin'])
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (employeesError) {
    throw new Error('Failed to load employees')
  }

  const appointmentRows = (appointmentsData ?? []) as unknown as AppointmentRow[]
  const appointmentIds = appointmentRows.map((appointment) => appointment.id)

  let assignmentsMap = new Map<string, AssignmentRow[]>()

  if (appointmentIds.length > 0) {
    const { data: assignments, error: assignmentsError } = await supabase
      .from('appointment_employees')
      .select('appointment_id, employee_id, profiles!appointment_employees_employee_id_fkey(*)')
      .in('appointment_id', appointmentIds as any)

    if (assignmentsError) {
      throw new Error('Failed to load appointment assignments')
    }

    assignmentsMap = (assignments ?? []).reduce((acc, row) => {
      const assignment = row as unknown as AssignmentRow
      const current = acc.get(assignment.appointment_id) ?? []
      current.push(assignment)
      acc.set(assignment.appointment_id, current)
      return acc
    }, new Map<string, AssignmentRow[]>())
  }

  const appointments: AppointmentWithDetails[] = appointmentRows.map((appointment) => ({
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
    client: appointment.clients ?? null,
    invoice: null,
    employees:
      assignmentsMap
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

  return (
    <div className="space-y-4">
      <AdminCalendar
        initialAppointments={appointments}
        clients={(clientsData ?? []) as ClientWithHomes[]}
        employees={(employeesData ?? []) as Profile[]}
      />
    </div>
  )
}
import { addWeeks } from 'date-fns'
import { redirect } from 'next/navigation'

import { AdminMyScheduleCalendar } from '@/components/admin/AdminMyScheduleCalendar'
import { PageHeader } from '@/components/admin/PageHeader'
import { getAppointmentsForUser } from '@/lib/api/appointments'
import { createClient } from '@/lib/supabase/server'
import type { ClientWithHomes } from '@/types/composed'
import type { Profile } from '@/types/models'

export default async function AdminMySchedulePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profileData || profileData.role !== 'admin') {
    redirect('/employee')
  }

  const now = new Date()
  const rangeStart = now.toISOString()
  const rangeEnd = addWeeks(now, 8).toISOString()
  const appointments = await getAppointmentsForUser(supabase, user.id, rangeStart, rangeEnd)

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

  return (
    <div className="space-y-4">
      <AdminMyScheduleCalendar
        initialAppointments={appointments}
        clients={(clientsData ?? []) as ClientWithHomes[]}
        employees={(employeesData ?? []) as Profile[]}
        currentUserId={user.id}
      />
    </div>
  )
}

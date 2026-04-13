import { addWeeks } from 'date-fns'

import { EmployeeCalendar } from '@/components/employee/EmployeeCalendar'
import { getAppointmentsForUser } from '@/lib/api/appointments'
import { createClient } from '@/lib/supabase/server'

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
  const appointments = await getAppointmentsForUser(supabase, user.id, rangeStart, rangeEnd)

  return <EmployeeCalendar initialAppointments={appointments} />
}

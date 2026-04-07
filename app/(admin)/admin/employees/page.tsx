import { EmployeesTable } from '@/components/admin/EmployeesTable'
import { createClient } from '@/lib/supabase/server'

type EmployeeRow = {
  id: string
  full_name: string
  phone: string | null
  is_active: boolean
  created_at: string
}

export default async function AdminEmployeesPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, is_active, created_at')
    .filter('role', 'eq', 'employee')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error('Failed to load employees')
  }

  const employees = (data ?? []) as EmployeeRow[]

  return <EmployeesTable initialEmployees={employees} />
}

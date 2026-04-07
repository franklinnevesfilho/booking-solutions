import { ClientsTable } from '@/components/admin/ClientsTable'
import { createClient } from '@/lib/supabase/server'
import type { ClientWithHomes } from '@/types'

export default async function AdminClientsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('clients').select('*, client_homes(*)').order('full_name', { ascending: true })

  if (error) {
    throw new Error('Failed to load clients')
  }

  const clients = (data ?? []) as unknown as ClientWithHomes[]

  return <ClientsTable initialClients={clients} />
}

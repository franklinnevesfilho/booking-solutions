import { InvoicesTable } from '@/components/admin/invoice/InvoicesTable'
import { PageHeader } from '@/components/admin/PageHeader'
import { getInvoicesWithDetails } from '@/lib/api/invoices'
import { createClient } from '@/lib/supabase/server'
import type { InvoiceWithDetails } from '@/types'

export default async function AdminInvoicesPage() {
  const supabase = await createClient()

  let invoices: InvoiceWithDetails[] = []

  try {
    invoices = await getInvoicesWithDetails(supabase, 'all')
  } catch (error) {
    console.error('Failed to load invoices for admin page', error)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Invoices" />
      <InvoicesTable initialInvoices={invoices} />
    </div>
  )
}

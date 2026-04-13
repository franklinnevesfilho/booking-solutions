import { format, parseISO } from 'date-fns'

import { PageHeader } from '@/components/admin/PageHeader'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/server'

type InvoiceSummaryRow = {
  amount_charged: number
  discount_amount: number
  is_paid: boolean
}

type UpcomingAppointmentRow = {
  id: string
  start_time: string
  status: 'scheduled' | 'completed' | 'cancelled'
  clients: {
    full_name: string
  } | null
  jobs: {
    name: string
  } | null
  invoices:
    | {
        is_paid: boolean
      }[]
    | null
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function getStatusBadgeClass(status: 'scheduled' | 'completed' | 'cancelled') {
  if (status === 'completed') {
    return 'bg-emerald-100 text-emerald-700 ring-emerald-200'
  }

  if (status === 'cancelled') {
    return 'bg-rose-100 text-rose-700 ring-rose-200'
  }

  return 'bg-sky-100 text-sky-700 ring-sky-200'
}

export default async function AdminPage() {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()

  const { data: invoiceSummaryData, error: invoiceSummaryError } = await supabase
    .from('invoices')
    .select('amount_charged, discount_amount, is_paid')

  if (invoiceSummaryError) {
    throw new Error('Failed to load invoice summary')
  }

  const invoiceSummaryRows = (invoiceSummaryData ?? []) as InvoiceSummaryRow[]

  const totalIncome = invoiceSummaryRows
    .filter((invoice) => invoice.is_paid)
    .reduce((sum, invoice) => sum + (invoice.amount_charged - invoice.discount_amount), 0)

  const pendingInvoices = invoiceSummaryRows.filter((invoice) => !invoice.is_paid)
  const pendingInvoiceCount = pendingInvoices.length
  const pendingInvoiceAmount = pendingInvoices.reduce((sum, invoice) => sum + (invoice.amount_charged - invoice.discount_amount), 0)

  const { count: upcomingCount, error: upcomingCountError } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'scheduled')
    .gt('start_time', nowIso)

  if (upcomingCountError) {
    throw new Error('Failed to load upcoming appointments count')
  }

  const { data: upcomingData, error: upcomingError } = await supabase
    .from('appointments')
    .select('id, start_time, status, clients(full_name), jobs(name), invoices(is_paid)')
    .eq('status', 'scheduled')
    .gt('start_time', nowIso)
    .order('start_time', { ascending: true })
    .limit(20)

  if (upcomingError) {
    throw new Error('Failed to load upcoming appointments')
  }

  const upcomingAppointments = (upcomingData ?? []) as unknown as UpcomingAppointmentRow[]
  const upcomingAppointmentsCount = upcomingCount ?? 0

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" />

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="space-y-2">
          <p className="text-sm font-medium text-slate-600">Total Income</p>
          <p className="text-2xl font-semibold tracking-tight text-slate-900">{formatCurrency(totalIncome)}</p>
        </Card>

        <Card className="space-y-2">
          <p className="text-sm font-medium text-slate-600">Pending Invoices</p>
          <p className="text-2xl font-semibold tracking-tight text-slate-900">{formatCurrency(pendingInvoiceAmount)}</p>
          <p className="text-sm text-slate-600">{pendingInvoiceCount} {pendingInvoiceCount === 1 ? 'invoice' : 'invoices'} pending</p>
        </Card>

        <Card className="space-y-2">
          <p className="text-sm font-medium text-slate-600">Upcoming Appointments</p>
          <p className="text-2xl font-semibold tracking-tight text-slate-900">{upcomingAppointmentsCount}</p>
        </Card>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-slate-900">Upcoming Appointments</h2>
        </div>

        {upcomingAppointments.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-600 sm:px-6">No upcoming appointments.</div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {upcomingAppointments.map((appointment) => {
              const appointmentInvoice = appointment.invoices?.[0] ?? null
              const invoiceLabel = appointmentInvoice ? (appointmentInvoice.is_paid ? 'Paid' : 'Pending') : 'No Invoice'

              return (
                <li key={appointment.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-center sm:px-6">
                  <p className="text-sm font-medium text-slate-800">
                    {format(parseISO(appointment.start_time), "MMM d, yyyy '·' h:mm a")}
                  </p>
                  <p className="text-sm text-slate-700">{appointment.clients?.full_name ?? 'No Client'}</p>
                  <p className="text-sm text-slate-700">{appointment.jobs?.name ?? 'No Job'}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${getStatusBadgeClass(appointment.status)}`}>
                      {appointment.status === 'scheduled'
                        ? 'Scheduled'
                        : appointment.status === 'completed'
                          ? 'Completed'
                          : 'Cancelled'}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                      {invoiceLabel}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

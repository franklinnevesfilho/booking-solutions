'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

import type { InvoiceWithDetails } from '@/types'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { cn } from '@/lib/utils'

type InvoiceStatusFilter = 'all' | 'pending' | 'paid'

type InvoicesTableProps = {
  initialInvoices: InvoiceWithDetails[]
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function formatAppointmentDate(invoice: InvoiceWithDetails, locale: string) {
  const startTime = invoice.appointment?.start_time

  if (!startTime) {
    return '—'
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(startTime))
  } catch {
    return '—'
  }
}

export function InvoicesTable({ initialInvoices }: InvoicesTableProps) {
  const t = useTranslations('invoices')
  const locale = useLocale()
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>(initialInvoices)
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>('all')
  const [clientFilter, setClientFilter] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const filters: Array<{ value: InvoiceStatusFilter; label: string }> = [
    { value: 'all', label: t('all') },
    { value: 'pending', label: t('unpaid') },
    { value: 'paid', label: t('paid') },
  ]

  const uniqueClients = useMemo(() => {
    const seen = new Set<string>()
    const result: Array<{ id: string; full_name: string }> = []
    for (const inv of invoices) {
      if (inv.client && !seen.has(inv.client.id)) {
        seen.add(inv.client.id)
        result.push(inv.client)
      }
    }
    return result.sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [invoices])

  const filteredInvoices = useMemo(() => {
    if (clientFilter === '') return invoices
    return invoices.filter((inv) => inv.client?.id === clientFilter)
  }, [invoices, clientFilter])

  async function fetchInvoices(status: InvoiceStatusFilter) {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/invoices?status=${status}`)

      if (!response.ok) {
        throw new Error('Failed to load invoices')
      }

      const data = (await response.json()) as InvoiceWithDetails[]
      setInvoices(data)
      setClientFilter('')
    } catch (fetchError) {
      console.error('Failed to fetch invoices', fetchError)
      setError(t('failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(status: InvoiceStatusFilter) {
    setStatusFilter(status)
    await fetchInvoices(status)
  }

  async function toggleInvoicePaid(invoice: InvoiceWithDetails) {
    try {
      setUpdatingId(invoice.id)
      setError(null)

      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_paid: !invoice.is_paid }),
      })

      if (!response.ok) {
        throw new Error('Failed to update invoice status')
      }

      const updatedInvoice = (await response.json()) as Partial<InvoiceWithDetails> & { id: string }

      setInvoices((current) =>
        current.map((item) =>
          item.id === updatedInvoice.id
            ? {
                ...item,
                ...updatedInvoice,
              }
            : item,
        ),
      )
    } catch (updateError) {
      console.error('Failed to update invoice', updateError)
      setError(t('failedToMarkPaid'))
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 items-center sm:items-end justify-center w-full">
          <div className='w-full '>
            <SearchableSelect
              label={t('client')}
              options={uniqueClients.map((c) => ({ id: c.id, label: c.full_name }))}
              value={clientFilter}
              onChange={(id) => setClientFilter(id)}
              placeholder={t('allClients')}
              disabled={loading || uniqueClients.length === 0}
            />
          </div>
          <div className="inline-flex w-full rounded-lg bg-slate-100 p-1 sm:w-auto">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => void handleStatusChange(filter.value)}
                  className={cn(
                    'flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors sm:flex-none',
                    statusFilter === filter.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                  )}
                  disabled={loading}
                >
                  {filter.label}
                </button>
              ))}
            </div>
        </div>
      </Card>
      <p className={`mt-4 m-0 text-sm text-slate-500 ${loading ? 'opacity-100' : 'opacity-0'}`}>{t('loadingInvoices')}</p>

      {error ? (
        <Card>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-rose-700">{error}</p>
            <Button variant="secondary" onClick={() => void fetchInvoices(statusFilter)}>
              {t('retry')}
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="space-y-3 lg:hidden">
        {filteredInvoices.map((invoice) => {
          const discount = invoice.discount_amount
          const net = invoice.amount_charged - discount

          return (
            <Card key={invoice.id} className="space-y-3">
              <div className="space-y-1">
                <p className="text-base font-semibold text-slate-900">{invoice.client?.full_name ?? '—'}</p>
                <p className="text-sm text-slate-600">{formatAppointmentDate(invoice, locale)}</p>
                <p className="text-sm text-slate-600">{t('job')}: {invoice.job?.name ?? '—'}</p>
                <p className="text-sm text-slate-600">{t('amount')}: {formatCurrency(invoice.amount_charged)}</p>
                <p className="text-sm text-slate-600">{t('discount')}: {discount > 0 ? formatCurrency(discount) : '—'}</p>
                <p className="text-sm font-medium text-slate-900">{t('net')}: {formatCurrency(net)}</p>
                <span
                  className={cn(
                    'mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                    invoice.is_paid
                      ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                      : 'bg-amber-100 text-amber-800 ring-amber-200',
                  )}
                >
                  {invoice.is_paid ? t('paid') : t('unpaid')}
                </span>
              </div>

              <Button
                variant="secondary"
                isLoading={updatingId === invoice.id}
                disabled={updatingId === invoice.id}
                onClick={() => void toggleInvoicePaid(invoice)}
                className="w-full"
              >
                {updatingId === invoice.id ? t('markingPaid') : invoice.is_paid ? t('markAsUnpaid') : t('markPaid')}
              </Button>
            </Card>
          )
        })}

        {!loading && filteredInvoices.length === 0 ? (
          <Card>
            <p className="py-2 text-center text-sm text-slate-600">{t('noInvoicesFound')}</p>
          </Card>
        ) : null}
      </div>

      <Card className="hidden p-0 lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t('client')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t('date')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t('job')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t('amount')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t('discount')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t('net')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t('status')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredInvoices.map((invoice) => {
                const discount = invoice.discount_amount
                const net = invoice.amount_charged - discount

                return (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{invoice.client?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatAppointmentDate(invoice, locale)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{invoice.job?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatCurrency(invoice.amount_charged)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{discount > 0 ? formatCurrency(discount) : '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{formatCurrency(net)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                          invoice.is_paid
                            ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                            : 'bg-amber-100 text-amber-800 ring-amber-200',
                        )}
                      >
                        {invoice.is_paid ? t('paid') : t('unpaid')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        isLoading={updatingId === invoice.id}
                        disabled={updatingId === invoice.id}
                        onClick={() => void toggleInvoicePaid(invoice)}
                      >
                        {updatingId === invoice.id ? t('markingPaid') : invoice.is_paid ? t('markAsUnpaid') : t('markPaid')}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {!loading && filteredInvoices.length === 0 ? <p className="px-4 py-5 text-center text-sm text-slate-600">{t('noInvoicesFound')}</p> : null}
        </div>
      </Card>
    </div>
  )
}

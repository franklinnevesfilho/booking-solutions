import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, InvoiceWithDetails } from '@/types'

type InvoiceStatus = 'pending' | 'paid' | 'all'

type InvoiceRowWithDetails = Database['public']['Tables']['invoices']['Row'] & {
  appointments:
    | (Pick<Database['public']['Tables']['appointments']['Row'], 'id' | 'title' | 'start_time' | 'end_time'> & {
        clients: Pick<Database['public']['Tables']['clients']['Row'], 'id' | 'full_name'> | null
        jobs: Pick<Database['public']['Tables']['jobs']['Row'], 'id' | 'name'> | null
      })
    | null
}

const logger = {
  info: (msg: string, meta?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: 'info', msg, ...meta, ts: new Date().toISOString() })),
  error: (msg: string, meta?: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: 'error', msg, ...meta, ts: new Date().toISOString() })),
}

export async function getInvoicesWithDetails(
  supabase: SupabaseClient,
  status: InvoiceStatus = 'all',
): Promise<InvoiceWithDetails[]> {
  logger.info('Fetching invoices with details', { status })

  let query = supabase
    .from('invoices')
    .select(
      '*, appointments!invoices_appointment_id_fkey(id, title, start_time, end_time, clients(id, full_name), jobs(id, name))',
    )
    .order('created_at', { ascending: false })

  if (status === 'pending') {
    query = query.eq('is_paid', false)
  }

  if (status === 'paid') {
    query = query.eq('is_paid', true)
  }

  const { data, error } = await query

  if (error) {
    logger.error('Failed to fetch invoices', { error: error.message, code: error.code, status })
    throw error
  }

  const rows = (data ?? []) as InvoiceRowWithDetails[]

  logger.info('Fetched invoice rows', { count: rows.length, status })

  return rows.map((row) => ({
    id: row.id,
    appointment_id: row.appointment_id,
    amount_charged: row.amount_charged,
    discount_amount: row.discount_amount,
    discount_reason: row.discount_reason,
    is_paid: row.is_paid,
    created_at: row.created_at,
    updated_at: row.updated_at,
    appointment: row.appointments
      ? {
          id: row.appointments.id,
          title: row.appointments.title,
          start_time: row.appointments.start_time,
          end_time: row.appointments.end_time,
        }
      : null,
    client: row.appointments?.clients
      ? {
          id: row.appointments.clients.id,
          full_name: row.appointments.clients.full_name,
        }
      : null,
    job: row.appointments?.jobs
      ? {
          id: row.appointments.jobs.id,
          name: row.appointments.jobs.name,
        }
      : null,
  }))
}

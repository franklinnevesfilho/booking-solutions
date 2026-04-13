import { NextResponse } from 'next/server'

import { getInvoicesWithDetails } from '@/lib/api/invoices'
import { badRequest, forbidden, getSessionAndRole, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

type InvoiceStatus = 'pending' | 'paid' | 'all'

function parseStatus(value: string | null): InvoiceStatus | null {
  if (!value || value === 'all') {
    return 'all'
  }

  if (value === 'pending' || value === 'paid') {
    return value
  }

  return null
}

export async function GET(request: Request) {
  const session = await getSessionAndRole(request)

  if (!session || session.role !== 'admin') {
    return forbidden()
  }

  const requestUrl = new URL(request.url)
  const status = parseStatus(requestUrl.searchParams.get('status'))

  if (!status) {
    return badRequest('Invalid status filter')
  }

  const supabase = await createClient()

  try {
    const invoices = await getInvoicesWithDetails(supabase, status)
    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Failed to fetch invoices:', error)
    return serverError()
  }
}

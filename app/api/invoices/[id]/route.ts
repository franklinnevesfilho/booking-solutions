import { NextResponse } from 'next/server'
import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

const updateInvoiceSchema = z.object({
  is_paid: z.boolean(),
})

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSessionAndRole(request)

  if (!session || session.role !== 'admin') {
    return forbidden()
  }

  const { id } = await params

  let body: unknown

  try {
    body = await request.json()
  } catch (error) {
    console.error('Failed to parse invoice update body:', error)
    return badRequest('Invalid JSON body')
  }

  const parsed = updateInvoiceSchema.safeParse(body)

  if (!parsed.success) {
    return badRequest('Invalid request body')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .update({
      is_paid: parsed.data.is_paid,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to update invoice payment status:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      invoiceId: id,
    })
    return serverError()
  }

  return NextResponse.json(data)
}

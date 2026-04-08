import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, notFound, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

const updateClientSchema = z
  .object({
    full_name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
    notes: z.string().trim().min(1).optional(),
  })
  .strict()

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function validationError(parsed: z.SafeParseError<unknown>): Response {
  const flattened = parsed.error.flatten()
  console.error('Validation failed:', JSON.stringify(flattened, null, 2))
  return jsonResponse(
    {
      error: 'Validation failed',
      fieldErrors: flattened.fieldErrors,
      formErrors: flattened.formErrors,
    },
    400
  )
}

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params
  console.log('GET /api/clients/:id — id:', id)

  const session = await getSessionAndRole(request)
  console.log('Session:', session)

  if (!session || session.role !== 'admin') {
    console.warn('Forbidden — session:', session)
    return forbidden()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*, client_homes(*)')
    .eq('id', id)
    .order('created_at', { ascending: true, foreignTable: 'client_homes' })
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      console.warn('Client not found — id:', id)
      return notFound()
    }

    console.error('Failed to fetch client:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      clientId: id,
    })
    return serverError()
  }

  return jsonResponse(data, 200)
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params
  console.log('PATCH /api/clients/:id — id:', id)

  const session = await getSessionAndRole(request)
  console.log('Session:', session)

  if (!session || session.role !== 'admin') {
    console.warn('Forbidden — session:', session)
    return forbidden()
  }

  let body: unknown

  try {
    body = await request.json()
  } catch (err) {
    console.error('Failed to parse JSON body:', err)
    return badRequest('Invalid JSON body')
  }

  console.log('Request body:', JSON.stringify(body, null, 2))

  const parsed = updateClientSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed)
  }

  if (Object.keys(parsed.data).length === 0) {
    console.warn('No fields to update')
    return badRequest('No fields to update')
  }

  console.log('Parsed data:', parsed.data)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .update(parsed.data)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      console.warn('Client not found — id:', id)
      return notFound()
    }

    console.error('Failed to update client:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      clientId: id,
      updateData: parsed.data,
    })
    return jsonResponse(
      { error: 'Database error', message: error.message, code: error.code, hint: error.hint ?? null },
      500
    )
  }

  console.log('Successfully updated client:', data)
  return jsonResponse(data, 200)
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params
  console.log('DELETE /api/clients/:id — id:', id)

  const session = await getSessionAndRole(request)
  console.log('Session:', session)

  if (!session || session.role !== 'admin') {
    console.warn('Forbidden — session:', session)
    return forbidden()
  }

  const supabase = await createClient()
  const { error } = await supabase.from('clients').delete().eq('id', id)

  if (error) {
    console.error('Failed to delete client:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      clientId: id,
    })
    return jsonResponse(
      { error: 'Database error', message: error.message, code: error.code, hint: error.hint ?? null },
      500
    )
  }

  console.log('Successfully deleted client:', id)
  return jsonResponse({ success: true }, 200)
}
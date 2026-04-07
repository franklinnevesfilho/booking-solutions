import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, notFound, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

const createHomeSchema = z.object({
  label: z.string().trim().min(1).optional(),
  street: z.string().trim().min(1, 'Street address is required'),
  city: z.string().trim().optional().default(''),
  state: z.string().trim().optional().default(''),
  postal_code: z.string().trim().optional().default(''),
  country: z.string().trim().optional().default(''),
  is_primary: z.boolean().optional().default(false),
})

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params
  const session = await getSessionAndRole(request)

  if (!session || session.role !== 'admin') {
    return forbidden()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_homes')
    .select('*')
    .eq('client_id', id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch client homes', error)
    return serverError()
  }

  return jsonResponse(data, 200)
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params
  const session = await getSessionAndRole(request)

  if (!session || session.role !== 'admin') {
    return forbidden()
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = createHomeSchema.safeParse(body)

  if (!parsed.success) {
    return jsonResponse(parsed.error.flatten(), 400)
  }

  const supabase = await createClient()

  const { error: clientError } = await supabase
    .from('clients')
    .select('id')
    .eq('id', id)
    .single()

  if (clientError) {
    if (clientError.code === 'PGRST116') {
      return notFound()
    }

    console.error('Failed to verify client before creating home', clientError)
    return serverError()
  }

  if (parsed.data.is_primary) {
    const { error: unsetPrimaryError } = await supabase
      .from('client_homes')
      .update({ is_primary: false })
      .eq('client_id', id)
      .eq('is_primary', true)

    if (unsetPrimaryError) {
      console.error('Failed to unset existing primary homes', unsetPrimaryError)
      return serverError()
    }
  }

  const { data, error } = await supabase
    .from('client_homes')
    .insert({
      client_id: id,
      ...parsed.data,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Failed to create client home', error)
    return serverError()
  }

  return jsonResponse(data, 201)
}
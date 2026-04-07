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
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

type RouteContext = {
  params: {
    id: string
  }
}

export async function GET(request: Request, { params }: RouteContext) {
  const session = await getSessionAndRole(request)

  if (!session || session.role !== 'admin') {
    return forbidden()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*, client_homes(*)')
    .eq('id', params.id)
    .order('created_at', { ascending: true, foreignTable: 'client_homes' })
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return notFound()
    }

    console.error('Failed to fetch client', error)
    return serverError()
  }

  return jsonResponse(data, 200)
}

export async function PATCH(request: Request, { params }: RouteContext) {
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

  const parsed = updateClientSchema.safeParse(body)

  if (!parsed.success) {
    return jsonResponse(parsed.error.flatten(), 400)
  }

  if (Object.keys(parsed.data).length === 0) {
    return badRequest('No fields to update')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .update(parsed.data)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return notFound()
    }

    console.error('Failed to update client', error)
    return serverError()
  }

  return jsonResponse(data, 200)
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const session = await getSessionAndRole(request)

  if (!session || session.role !== 'admin') {
    return forbidden()
  }

  const supabase = await createClient()
  const { error } = await supabase.from('clients').delete().eq('id', params.id)

  if (error) {
    console.error('Failed to delete client', error)
    return serverError()
  }

  return jsonResponse({ success: true }, 200)
}
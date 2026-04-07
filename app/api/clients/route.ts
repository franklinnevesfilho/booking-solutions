import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

const createClientSchema = z.object({
  full_name: z.string().trim().min(1),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
})

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export async function GET(request: Request) {
  const session = await getSessionAndRole(request)

  if (!session || session.role !== 'admin') {
    return forbidden()
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('clients').select('*, client_homes(*)').order('full_name', { ascending: true })

  if (error) {
    console.error('Failed to fetch clients', error)
    return serverError()
  }

  return jsonResponse(data, 200)
}

export async function POST(request: Request) {
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

  const parsed = createClientSchema.safeParse(body)

  if (!parsed.success) {
    return jsonResponse(parsed.error.flatten(), 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('clients').insert(parsed.data).select('*').single()

  if (error) {
    console.error('Failed to create client', error)
    return serverError()
  }

  return jsonResponse(data, 201)
}
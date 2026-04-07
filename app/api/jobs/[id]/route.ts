import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, notFound, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

const updateJobSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  default_price_per_hour: z.number().positive().optional(),
  is_active: z.boolean().optional(),
})

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params
  const session = await getSessionAndRole(request)

  if (!session) {
    return forbidden()
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return notFound()
    }
    console.error('Failed to fetch job', error)
    return serverError()
  }

  return jsonResponse(data)
}

export async function PUT(request: Request, { params }: RouteContext) {
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

  const parsed = updateJobSchema.safeParse(body)

  if (!parsed.success) {
    return jsonResponse(parsed.error.flatten(), 400)
  }

  if (Object.keys(parsed.data).length === 0) {
    return badRequest('At least one field is required')
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('jobs')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return notFound()
    }
    console.error('Failed to update job', error)
    return serverError()
  }

  return jsonResponse(data)
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params
  const session = await getSessionAndRole(request)

  if (!session || session.role !== 'admin') {
    return forbidden()
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('jobs')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return notFound()
    }
    console.error('Failed to soft-delete job', error)
    return serverError()
  }

  return jsonResponse(data)
}

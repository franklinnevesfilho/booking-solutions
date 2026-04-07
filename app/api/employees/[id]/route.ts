import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, notFound, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

const updateEmployeeSchema = z
  .object({
    full_name: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).nullable().optional(),
    is_active: z.boolean().optional(),
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

  const parsed = updateEmployeeSchema.safeParse(body)

  if (!parsed.success) {
    return jsonResponse(parsed.error.flatten(), 400)
  }

  if (Object.keys(parsed.data).length === 0) {
    return badRequest('No fields to update')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(parsed.data)
    .eq('id', params.id)
    .eq('role', 'employee')
    .select('id, full_name, phone, is_active, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return notFound()
    }

    console.error('Failed to update employee', error)
    return serverError()
  }

  return jsonResponse(data, 200)
}
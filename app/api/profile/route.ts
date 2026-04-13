import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

const updateProfileSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required'),
})

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export async function PATCH(request: Request) {
  const session = await getSessionAndRole(request)

  if (!session) {
    return forbidden()
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = updateProfileSchema.safeParse(body)

  if (!parsed.success) {
    return jsonResponse(parsed.error.flatten(), 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.userId)
    .select('id, full_name, updated_at')
    .single()

  if (error) {
    console.error('Failed to update profile', error)
    return serverError()
  }

  return jsonResponse(data, 200)
}
import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

const SUPPORTED_LOCALES = ['en', 'es', 'pt-BR'] as const

const updateProfileSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').optional(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
}).refine(
  (data) => data.full_name !== undefined || data.locale !== undefined,
  { message: 'At least one field must be provided' }
)

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
  const updatePayload: {
    updated_at: string
    full_name?: string
    locale?: string
  } = {
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.full_name !== undefined) {
    updatePayload.full_name = parsed.data.full_name
  }

  if (parsed.data.locale !== undefined) {
    updatePayload.locale = parsed.data.locale
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', session.userId)
    .select('id, full_name, locale, updated_at')
    .single()

  if (error) {
    console.error('Failed to update profile', error)
    return serverError()
  }

  return jsonResponse(data, 200)
}
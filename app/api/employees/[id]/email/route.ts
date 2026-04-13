import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, notFound, serverError } from '@/lib/api/auth'
import type { Database } from '@/types'

const updateEmployeeEmailSchema = z
  .object({
    email: z.string().trim().email(),
  })
  .strict()

type RouteContext = { params: Promise<{ id: string }> }

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables')
  }

  return createSupabaseAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function PATCH(request: Request, { params }: RouteContext) {
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

  const parsed = updateEmployeeEmailSchema.safeParse(body)

  if (!parsed.success) {
    return jsonResponse(parsed.error.flatten(), 400)
  }

  let adminClient

  try {
    adminClient = createAdminClient()
  } catch (error) {
    console.error('Failed to initialize admin client', error)
    return serverError()
  }

  const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(id)

  if (userError || !userData.user) {
    return notFound()
  }

  const { error } = await adminClient.auth.admin.updateUserById(id, { email: parsed.data.email })

  if (error) {
    const message = error.message.toLowerCase()

    if (error.code === 'email_exists' || message.includes('already registered')) {
      return jsonResponse({ error: 'email_already_in_use' }, 409)
    }

    console.error('Failed to update employee email', error)
    return serverError()
  }

  return jsonResponse({ success: true }, 200)
}
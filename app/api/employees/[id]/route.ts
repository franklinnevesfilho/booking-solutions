import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, notFound, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types'

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

type RouteContext = { params: Promise<{ id: string }> }

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
    .eq('id', id)
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

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params
  const session = await getSessionAndRole(request)

  if (!session || session.role !== 'admin') {
    return forbidden()
  }

  let adminClient

  try {
    adminClient = createAdminClient()
  } catch (error) {
    console.error('Failed to initialize admin client', error)
    return serverError()
  }

  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(id)

  if (deleteAuthError) {
    const status = typeof deleteAuthError.status === 'number' ? deleteAuthError.status : null
    const code = typeof deleteAuthError.code === 'string' ? deleteAuthError.code : ''
    const message = deleteAuthError.message.toLowerCase()
    const isNotFoundError = status === 404 || code === 'user_not_found' || message.includes('not found')

    if (!isNotFoundError) {
      console.error('Failed to delete employee auth user', deleteAuthError)
      return serverError()
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: false })
    .eq('id', id)
    .eq('role', 'employee')

  if (error) {
    console.error('Failed to soft-delete employee profile', error)
    return serverError()
  }

  return jsonResponse({ success: true }, 200)
}
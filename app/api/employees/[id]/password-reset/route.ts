import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

import { badRequest, forbidden, getSessionAndRole, notFound, serverError } from '@/lib/api/auth'
import type { Database } from '@/types'

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

export async function POST(request: Request, { params }: RouteContext) {
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

  const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(id)

  if (userError || !userData.user) {
    return notFound()
  }

  if (!userData.user.email) {
    return badRequest('Employee has no email address')
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/set-password`

  try {
    const { error } = await adminClient.auth.resetPasswordForEmail(userData.user.email, { redirectTo })

    if (error) {
      throw error
    }

    return jsonResponse({ success: true }, 200)
  } catch (error) {
    console.error('Failed to send password reset email', error)
    return serverError('Failed to send password reset email')
  }
}
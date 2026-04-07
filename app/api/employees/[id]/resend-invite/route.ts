import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

import { forbidden, getSessionAndRole, notFound, serverError } from '@/lib/api/auth'
import type { Database } from '@/types'

type RouteContext = {
  params: { id: string }
}

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

  const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(params.id)

  if (userError || !userData.user || !userData.user.email) {
    return notFound()
  }

  const email = userData.user.email

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/accept-invite`

  try {
    const { error } = await adminClient.auth.resetPasswordForEmail(email, { redirectTo })

    if (error) {
      throw error
    }

    return jsonResponse({ success: true }, 200)
  } catch (error) {
    console.error('Failed to resend invite', error)
    return serverError('Failed to resend invite')
  }
}

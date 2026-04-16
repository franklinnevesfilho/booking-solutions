// auth.ts is missing this import
import type { Database, Role, Profile } from '@/types'
import { createServerClient } from '@supabase/ssr'


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL')
}

if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
}

type SessionRole = {
  userId: string
  role: Role
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function parseCookies(request: Request): Array<{ name: string; value: string }> {
  const cookieHeader = request.headers.get('cookie')

  if (!cookieHeader) {
    return []
  }

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...valueParts] = part.split('=')

      return {
        name,
        value: decodeURIComponent(valueParts.join('=')),
      }
    })
}

/**
 * Get the current user + their profile role from a Next.js request.
 * Returns null if unauthenticated or profile missing.
 */
export async function getSessionAndRole(request: Request): Promise<SessionRole | null> {
  const requestCookies = parseCookies(request)

  const supabase = createServerClient<Database>(
    supabaseUrl!, 
    supabaseAnonKey!, {
    cookies: {
      getAll() {
        return requestCookies
      },
      setAll() {
        // Route handlers in this project only need read access for session checks.
      },
    },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single()

  if (profileError || !profile) {
    return null
  }

  return {
    userId: user.id,
    role: profile.role,
  } as SessionRole
}

/**
 * Returns a NextResponse 403 JSON response.
 */
export function forbidden(): Response {
  return jsonResponse({ error: 'Forbidden' }, 403)
}

/**
 * Returns a NextResponse 400 JSON response with a message.
 */
export function badRequest(message: string): Response {
  return jsonResponse({ error: message }, 400)
}

/**
 * Returns a NextResponse 404 JSON response.
 */
export function notFound(): Response {
  return jsonResponse({ error: 'Not found' }, 404)
}

/**
 * Returns a NextResponse 500 JSON response.
 */
export function serverError(message?: string): Response {
  return jsonResponse({ error: message ?? 'Internal server error' }, 500)
}
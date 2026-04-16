import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const _supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const _supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!_supabaseUrl || !_supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabaseUrl: string = _supabaseUrl
const supabaseAnonKey: string = _supabaseAnonKey

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'invite' | 'recovery' | 'signup' | 'magiclink' | null
  const code = searchParams.get('code')

  if (token_hash && (type === 'invite' || type === 'recovery')) {
    const response = NextResponse.redirect(new URL('/set-password', origin))

    // Create client that writes cookies directly onto the redirect response
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return response
    }
  } else if (code) {
    const response = NextResponse.redirect(new URL('/', origin))

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return response
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
}

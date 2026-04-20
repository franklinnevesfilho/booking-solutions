'use server'

import { cookies } from 'next/headers'

import { createClient } from '@/lib/supabase/server'

const SUPPORTED_LOCALES = ['en', 'es', 'pt-BR'] as const

type Locale = (typeof SUPPORTED_LOCALES)[number]

function isValidLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export async function setLocale(locale: string): Promise<void> {
  if (!isValidLocale(locale)) return

  const cookieStore = await cookies()
  cookieStore.set('APP_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  })

  // Best-effort: save to profile if user is authenticated
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await supabase
        .from('profiles')
        .update({ locale, updated_at: new Date().toISOString() })
        .eq('id', user.id)
    }
  } catch {
    // silently ignore - cookie is the source of truth for the current request
  }
}

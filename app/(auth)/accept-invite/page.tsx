'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'

export default function AcceptInvitePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const t = useTranslations('auth')

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.substring(1) : ''
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken || !refreshToken) {
      router.replace('/login?error=invalid_invite')
      return
    }

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          router.replace('/login?error=invalid_invite')
        } else {
          router.replace('/set-password')
        }
      })
  }, [router, supabase])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-slate-500">{t('settingUpAccount')}</p>
    </div>
  )
}

'use client'

import { useEffect, useRef } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'

import { setLocale } from '@/lib/actions/locale'

export function LocaleSync({ profileLocale }: { profileLocale: string }) {
  const currentLocale = useLocale()
  const router = useRouter()
  const synced = useRef(false)

  useEffect(() => {
    if (!synced.current && profileLocale && profileLocale !== currentLocale) {
      synced.current = true
      setLocale(profileLocale).then(() => router.refresh())
    }
  }, [profileLocale, currentLocale, router])

  return null
}

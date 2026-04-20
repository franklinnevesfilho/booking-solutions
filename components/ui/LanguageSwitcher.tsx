'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { setLocale } from '@/lib/actions/locale'

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const t = useTranslations('language')

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value

    startTransition(async () => {
      await setLocale(next)
      router.refresh()
    })
  }

  return (
    <select
      value={locale}
      onChange={handleChange}
      disabled={isPending}
      aria-label={t('selectLanguage')}
      className={`h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:opacity-50 ${className ?? ''}`}
    >
      <option value="en">{t('en')}</option>
      <option value="es">{t('es')}</option>
      <option value="pt-BR">{t('pt-BR')}</option>
    </select>
  )
}

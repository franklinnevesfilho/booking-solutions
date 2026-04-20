'use client'

import { useTranslations } from 'next-intl'
import { useFormStatus } from 'react-dom'
import { useActionState } from 'react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { signIn, type SignInState } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  const t = useTranslations('auth')
  return (
    <Button type="submit" isLoading={pending} className="h-11 w-full text-base">
      {t('signInButton')}
    </Button>
  )
}

const initialState: SignInState = { error: null }

export default function LoginPage() {
  const [state, formAction] = useActionState(signIn, initialState)
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')

  return (
    <Card className="w-full">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">{tCommon('appName')}</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{t('signIn')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('signInSubtitle')}</p>
      </div>

      <form action={formAction} className="space-y-4">
        <Input
          label={t('emailLabel')}
          type="email"
          name="email"
          autoComplete="email"
          placeholder={t('emailPlaceholder')}
          required
        />
        <PasswordInput
          label={t('passwordLabel')}
          name="password"
          autoComplete="current-password"
          required
        />
        {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
        <SubmitButton />
      </form>
    </Card>
  )
}

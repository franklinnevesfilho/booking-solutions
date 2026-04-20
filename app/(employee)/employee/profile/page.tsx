import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { ProfileNameForm } from '@/components/profile/ProfileNameForm'
import { ProfilePasswordForm } from '@/components/profile/ProfilePasswordForm'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/server'

export default async function EmployeeProfilePage() {
  const t = await getTranslations('profile')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  if (error || !data) {
    throw new Error('Failed to load profile')
  }

  const profile = data

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/employee"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
              clipRule="evenodd"
            />
          </svg>
          {t('backToSchedule')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('myProfile')}</h1>
      </div>

      <Card>
        <div className="mb-5 space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">{t('accountDetails')}</h2>
          <p className="text-sm text-slate-600">{t('accountDetailsDesc')}</p>
        </div>
        <ProfileNameForm defaultFullName={profile.full_name ?? ''} />
      </Card>

      <Card>
        <div className="mb-5 space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">{t('changePassword')}</h2>
          <p className="text-sm text-slate-600">{t('changePasswordDesc')}</p>
        </div>
        <ProfilePasswordForm />
      </Card>
    </div>
  )
}
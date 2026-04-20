import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { ProfileNameForm } from '@/components/profile/ProfileNameForm'
import { ProfilePasswordForm } from '@/components/profile/ProfilePasswordForm'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/server'

export default async function AdminProfilePage() {
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
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('myProfile')}</h1>

      <Card>
        <div className="mb-5 space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">{t('accountDetails')}</h2>
          <p className="text-sm text-slate-600">{t('accountDetailsDescAdmin')}</p>
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
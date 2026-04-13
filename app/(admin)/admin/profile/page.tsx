import { redirect } from 'next/navigation'

import { ProfileNameForm } from '@/components/profile/ProfileNameForm'
import { ProfilePasswordForm } from '@/components/profile/ProfilePasswordForm'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/server'

export default async function AdminProfilePage() {
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
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">My Profile</h1>

      <Card>
        <div className="mb-5 space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Account Details</h2>
          <p className="text-sm text-slate-600">Update how your name appears in the admin portal.</p>
        </div>
        <ProfileNameForm defaultFullName={profile.full_name ?? ''} />
      </Card>

      <Card>
        <div className="mb-5 space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Change Password</h2>
          <p className="text-sm text-slate-600">Choose a new password with at least 8 characters.</p>
        </div>
        <ProfilePasswordForm />
      </Card>
    </div>
  )
}
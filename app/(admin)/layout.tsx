import { redirect } from 'next/navigation'

import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { MobileHeader } from '@/components/admin/MobileHeader'
import { LocaleSync } from '@/components/ui/LocaleSync'
import { createClient } from '@/lib/supabase/server'

type AdminLayoutProps = {
  children: React.ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, role, locale')
    .filter('id', 'eq', user.id)
    .maybeSingle()

  const profile = profileData as { full_name: string; role: string; locale: string } | null

  if (!profile || profile.role !== 'admin') {
    redirect('/employee')
  }

  const fullName = profile.full_name ?? 'Admin User'

  return (
    <div className="h-screen overflow-hidden bg-slate-100 lg:grid lg:grid-cols-[260px_1fr]">
      <LocaleSync profileLocale={profile.locale} />
      <aside className="hidden border-r border-slate-200 bg-white p-4 lg:block">
        <AdminSidebar fullName={fullName} />
      </aside>

      <div className="flex h-screen flex-col">
        <MobileHeader fullName={fullName} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { EmployeeMobileNav } from '@/components/employee/EmployeeMobileNav'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/server'

type EmployeeLayoutProps = {
  children: ReactNode
}

export default async function EmployeeLayout({ children }: EmployeeLayoutProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, role')
    .filter('id', 'eq', user.id)
    .maybeSingle()

  const profile = profileData as { full_name: string; role: string } | null

  if (!profile || profile.role !== 'employee') {
    redirect('/admin')
  }

  async function handleSignOut() {
    'use server'

    const serverClient = await createClient()
    await serverClient.auth.signOut()
    redirect('/login')
  }

  function getInitials(name: string): string {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-lg font-bold tracking-tight text-brand-700">CleanSchedule</p>
          <div className="flex items-center gap-3">
            <Link
              href="/employee/profile"
              aria-label="My profile"
              title={profile.full_name || 'Employee'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              {getInitials(profile.full_name || 'Employee')}
            </Link>
            <p className="max-w-[10rem] truncate text-sm font-medium text-slate-700 sm:max-w-none">{profile.full_name || 'Employee'}</p>
            <form action={handleSignOut}>
              <Button type="submit" variant="secondary" className="min-h-11 px-4 text-sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:px-8">{children}</main>

      <EmployeeMobileNav />
    </div>
  )
}

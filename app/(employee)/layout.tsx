import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/server'

type EmployeeLayoutProps = {
  children: ReactNode
}

const mobileTabs = [
  {
    label: 'My Schedule',
    href: '/employee',
  },
]

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

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-lg font-bold tracking-tight text-brand-700">CleanSchedule</p>
          <div className="flex items-center gap-3">
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

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden" aria-label="Employee navigation">
        <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-1 gap-2 px-4">
          {mobileTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-50 px-4 text-sm font-semibold text-brand-800 ring-1 ring-brand-200"
              aria-current="page"
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}

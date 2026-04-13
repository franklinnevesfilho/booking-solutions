import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/server'

function UserCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19a7 7 0 0 1 14 0" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

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

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-lg font-bold tracking-tight text-brand-700">CleanSchedule</p>
          <div className="flex items-center gap-3">
            <Link
              href="/employee/profile"
              aria-label="View profile"
              className="inline-flex min-w-0 min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-transparent px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              <UserCircleIcon className="h-4 w-4 shrink-0" />
              <span className="max-w-[10rem] truncate sm:max-w-[16rem]">{profile.full_name || 'Employee'}</span>
            </Link>
            <form action={handleSignOut} className="shrink-0">
              <Button 
                type="submit" 
                variant="danger" 
                className="w-auto min-h-11 px-4 text-sm whitespace-nowrap"
              >
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-6 pt-4 sm:px-6 sm:pt-6 lg:px-8">{children}</main>
    </div>
  )
}

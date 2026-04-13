'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, type ReactElement } from 'react'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/Button'

type AdminSidebarProps = {
  fullName: string
  onClose?: () => void
}

type NavItem = {
  label: string
  href: string
  icon: (props: { className?: string }) => ReactElement
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M8 3v3M16 3v3M3 9.5h18" />
    </svg>
  )
}

function MyScheduleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M8 3v3M16 3v3M3 9.5h18" />
      <circle cx="12" cy="15" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16.5 19.5a4.5 4.5 0 0 0-9 0" />
      <circle cx="12" cy="9" r="3.2" />
      <path d="M19.5 18a3.8 3.8 0 0 0-3.1-3.7" />
      <circle cx="18" cy="8.2" r="2.2" />
    </svg>
  )
}

function TeamIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="9" r="2.7" />
      <circle cx="16" cy="9" r="2.7" />
      <path d="M3.5 19a4.5 4.5 0 0 1 9 0M11.5 19a4.5 4.5 0 0 1 9 0" />
    </svg>
  )
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  )
}

function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3.5h10v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3v-17Z" />
      <path d="M9 8.5h6M9 12h6M9 15.5h4" />
    </svg>
  )
}

function UserCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19a7 7 0 0 1 14 0" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: CalendarIcon,
  },
  {
    label: 'Calendar',
    href: '/admin/calendar',
    icon: CalendarIcon,
  },
  {
    label: 'My Schedule',
    href: '/admin/my-schedule',
    icon: MyScheduleIcon,
  },
  {
    label: 'Clients',
    href: '/admin/clients',
    icon: UsersIcon,
  },
  {
    label: 'Invoices',
    href: '/admin/invoices',
    icon: ReceiptIcon,
  },
  {
    label: 'Employees',
    href: '/admin/employees',
    icon: TeamIcon,
  },
  {
    label: 'Jobs',
    href: '/admin/jobs',
    icon: BriefcaseIcon,
  },
  {
    label: 'Profile',
    href: '/admin/profile',
    icon: UserCircleIcon,
  },
]

export function AdminSidebar({ fullName, onClose }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    try {
      setIsSigningOut(true)
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
      onClose?.()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-white lg:bg-transparent">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 lg:hidden">
        <p className="text-base font-semibold text-slate-900">Menu</p>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Close navigation"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="px-4 pb-3 pt-4 lg:px-0 lg:pt-0">
        <p className="text-xl font-bold tracking-tight text-brand-700">CleanSchedule</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 lg:px-0" aria-label="Admin navigation">
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-100 text-brand-800 ring-1 ring-brand-200'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <item.icon className={isActive ? 'text-brand-700' : 'text-slate-500'} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 lg:px-0 lg:pt-4">
        <p className="mb-3 truncate px-1 text-sm font-medium text-slate-600">{fullName || 'Admin User'}</p>
        <Button
          variant="secondary"
          className="w-full lg:w-full"
          isLoading={isSigningOut}
          onClick={handleSignOut}
          aria-label="Sign out"
        >
          Sign out
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

import { AdminSidebar } from '@/components/admin/AdminSidebar'

type MobileHeaderProps = {
  fullName: string
}

export function MobileHeader({ fullName }: MobileHeaderProps) {
  const pathname = usePathname()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)


  useEffect(() => {
    setIsDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isDrawerOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isDrawerOpen])

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">CleanSchedule</p>
          </div>
          <button
            type="button"
            aria-label="Open navigation menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            onClick={() => setIsDrawerOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </header>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" aria-hidden={!isDrawerOpen}>
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Close navigation drawer"
          />
          <aside
            role="dialog"
            aria-modal="true"
            className="relative h-full w-[86%] max-w-xs border-r border-slate-200 bg-white shadow-xl"
          >
            <AdminSidebar fullName={fullName} onClose={() => setIsDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}
    </>
  )
}

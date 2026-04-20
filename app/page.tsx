'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function HomePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        if (window.location.hash.includes('type=invite')) {
          router.replace('/accept-invite' + window.location.hash)
          return
        }
        router.replace('/login')
        return
      }
      supabase.from('profiles').select('role').eq('id', user.id).single().then(({ data }) => {
        if (data?.role === 'admin') {
          router.replace('/admin')
        } else {
          router.replace('/employee')
        }
      })
    })
  }, [router, supabase])

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-lg text-slate-500">Loading...</p>
    </div>
  )
}

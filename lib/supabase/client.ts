import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL')
}

if (!supabasePublishableKey) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
}

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
        supabaseUrl as string, 
        supabasePublishableKey as string
    )
  }

  return browserClient
}

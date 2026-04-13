import { JobsTable } from '@/components/admin/job/JobsTable'
import { createClient } from '@/lib/supabase/server'
import type { Job } from '@/types'

export default async function AdminJobsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('jobs').select('*').order('name', { ascending: true })

  if (error) {
    throw new Error('Failed to load jobs')
  }

  const jobs = (data ?? []) as unknown as Job[]

  return <JobsTable initialJobs={jobs} />
}

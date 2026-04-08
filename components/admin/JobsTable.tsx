'use client'

import { useState } from 'react'

import type { Job } from '@/types'

import { JobModal } from '@/components/admin/JobModal'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

type JobsTableProps = {
  initialJobs: Job[]
}

export function JobsTable({ initialJobs }: JobsTableProps) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs)
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  function openCreateModal() {
    setActiveJob(null)
    setIsModalOpen(true)
  }

  function openEditModal(job: Job) {
    setActiveJob(job)
    setIsModalOpen(true)
  }

  function upsertJob(job: Job) {
    setJobs((current) => {
      const exists = current.some((item) => item.id === job.id)
      const next = exists ? current.map((item) => (item.id === job.id ? job : item)) : [job, ...current]
      return next.sort((a, b) => a.name.localeCompare(b.name))
    })
  }

  async function handleArchiveToggle(job: Job) {
    try {
      setTogglingId(job.id)
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !job.is_active }),
      })

      if (!response.ok) {
        throw new Error('Failed to update job status')
      }

      const updatedJob = (await response.json()) as Job
      upsertJob(updatedJob)
    } catch (error) {
      console.error('Failed to toggle job status', error)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Jobs"
        action={
          <Button onClick={openCreateModal} className="w-full sm:w-auto">
            Add Job
          </Button>
        }
      />

      {/* Mobile cards */}
      <div className="space-y-3 lg:hidden">
        {jobs.map((job) => (
          <Card key={job.id} className="space-y-3">
            <div>
              <p className="text-base font-semibold text-slate-900">{job.name}</p>
              <p className="text-sm text-slate-600">{job.description ?? '—'}</p>
              <p className="text-sm text-slate-600">${job.default_price_per_hour.toFixed(2)}/hr</p>
              <span
                className={cn(
                  'mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                  job.is_active
                    ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                    : 'bg-slate-100 text-slate-600 ring-slate-200',
                )}
              >
                {job.is_active ? 'Active' : 'Archived'}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => openEditModal(job)} className="w-full">
                Edit
              </Button>
              <Button
                variant="ghost"
                isLoading={togglingId === job.id}
                onClick={() => void handleArchiveToggle(job)}
                className={cn('w-full', job.is_active ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700' : undefined)}
              >
                {job.is_active ? 'Archive' : 'Activate'}
              </Button>
            </div>
          </Card>
        ))}

        {jobs.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-600">No jobs found.</p>
          </Card>
        ) : null}
      </div>

      {/* Desktop table */}
      <Card className="hidden p-0 lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Rate</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{job.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{job.description ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">${job.default_price_per_hour.toFixed(2)}/hr</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                        job.is_active
                          ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                          : 'bg-slate-100 text-slate-600 ring-slate-200',
                      )}
                    >
                      {job.is_active ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="secondary" onClick={() => openEditModal(job)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        isLoading={togglingId === job.id}
                        onClick={() => void handleArchiveToggle(job)}
                        className={job.is_active ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700' : undefined}
                      >
                        {job.is_active ? 'Archive' : 'Activate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {jobs.length === 0 ? <p className="px-4 py-5 text-sm text-slate-600">No jobs found.</p> : null}
        </div>
      </Card>

      <JobModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={(savedJob: Job) => {
          upsertJob(savedJob)
          setIsModalOpen(false)
        }}
        job={activeJob}
      />
    </div>
  )
}

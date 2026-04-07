import type { AppointmentStatus } from '@/types'

import { cn } from '@/lib/utils'

type BadgeProps = {
  status: AppointmentStatus
  className?: string
}

const statusClasses: Record<AppointmentStatus, string> = {
  scheduled: 'bg-sky-100 text-sky-800 ring-sky-200',
  completed: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-rose-100 text-rose-800 ring-rose-200',
}

export function Badge({ status, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset',
        statusClasses[status],
        className,
      )}
    >
      {status}
    </span>
  )
}

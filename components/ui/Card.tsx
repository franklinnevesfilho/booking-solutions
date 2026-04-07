import { type HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

type CardProps = HTMLAttributes<HTMLDivElement>

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('w-full rounded-2xl bg-white p-5 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200 sm:p-6', className)}
      {...props}
    />
  )
}

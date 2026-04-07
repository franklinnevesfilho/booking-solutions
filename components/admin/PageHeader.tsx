import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  action?: ReactNode
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {action ? <div className="w-full sm:w-auto">{action}</div> : null}
    </header>
  )
}

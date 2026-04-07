import { forwardRef, type InputHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className, ...props },
  ref,
) {
  const inputId = id ?? props.name

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={inputId}
        ref={ref}
        className={cn(
          'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200',
          error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-200' : undefined,
          className,
        )}
        {...props}
      />
      {error ? <p className="mt-1.5 text-sm text-rose-600">{error}</p> : null}
    </div>
  )
})

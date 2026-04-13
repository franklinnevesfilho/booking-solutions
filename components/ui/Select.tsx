'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

type SelectOption<T extends string> = {
  value: T
  label: string
}

type SelectProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  label?: string
  className?: string
}

export function Select<T extends string>({ value, onChange, options, label, className }: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const selectedLabel = options.find((o) => o.value === value)?.label ?? ''

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (!(event.target instanceof Node)) return
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') setIsOpen(false)
    if (event.key === 'Enter' || event.key === ' ') setIsOpen((o) => !o)
  }

  function handleSelect(val: T) {
    onChange(val)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {label ? <p className="mb-1 text-xs font-medium text-slate-600">{label}</p> : null}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
      >
        <span>{selectedLabel}</span>
        <svg
          viewBox="0 0 24 24"
          className={cn('h-4 w-4 shrink-0 text-slate-500 transition-transform duration-150', isOpen && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen ? (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full min-w-[8rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                onClick={() => handleSelect(option.value)}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50',
                  option.value === value ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-800',
                )}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

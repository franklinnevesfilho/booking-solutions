'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface SearchableSelectProps {
  label?: string
  options: Array<{ id: string; label: string }>
  value: string
  onChange: (id: string) => void
  placeholder?: string
  disabled?: boolean
}

export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'All',
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)

  const selectedOption = useMemo(() => options.find((option) => option.id === value), [options, value])
  const filteredOptions = useMemo(
    () => options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  )

  useEffect(() => {
    function handleDocumentMouseDown(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      if (!containerRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
    }
  }, [isOpen])

  useEffect(() => {
    if (disabled) {
      setIsOpen(false)
    }
  }, [disabled])

  function handleToggleOpen() {
    if (disabled) {
      return
    }
    setIsOpen((current) => !current)
  }

  function handleSelect(nextId: string) {
    onChange(nextId)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {label ? <div className="mb-1 text-xs font-medium text-slate-600">{label}</div> : null}
      <button
        type="button"
        onClick={handleToggleOpen}
        disabled={disabled}
        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 flex items-center justify-between disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <span className="truncate">{selectedOption?.label ?? placeholder}</span>
        <span className="ml-2 text-slate-500">{isOpen ? '▴' : '▾'}</span>
      </button>

      {isOpen ? (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            className="w-full border-b border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-400"
          />

          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 ${
                value === '' ? 'bg-slate-100 font-medium' : ''
              }`}
            >
              {placeholder}
            </button>

            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  className={`w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 ${
                    value === option.id ? 'bg-slate-100 font-medium' : ''
                  }`}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-slate-400">No matches found</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
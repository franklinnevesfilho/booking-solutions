'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/Button'

type Employee = {
  id: string
  full_name: string
  phone: string | null
  is_active: boolean
  created_at: string
}

type EmployeeDeleteModalProps = {
  isOpen: boolean
  employee: Employee | null
  onClose: () => void
  onDeleted: (employeeId: string) => void
}

export function EmployeeDeleteModal({ isOpen, employee, onClose, onDeleted }: EmployeeDeleteModalProps) {
  const t = useTranslations('employees')
  const tCommon = useTranslations('common')
  const modalRef = useRef<HTMLDivElement>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !employee) {
      return
    }

    setErrorMessage(null)
  }, [employee, isOpen])

  useEffect(() => {
    if (!isOpen || !modalRef.current) {
      return
    }

    const node = modalRef.current
    const focusables = node.querySelectorAll<HTMLElement>('button, input, textarea, select, [href], [tabindex]:not([tabindex="-1"])')

    if (focusables.length > 0) {
      focusables[0].focus()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const items = Array.from(
        node.querySelectorAll<HTMLElement>('button, input, textarea, select, [href], [tabindex]:not([tabindex="-1"])'),
      ).filter((item) => !item.hasAttribute('disabled'))

      if (items.length === 0) {
        event.preventDefault()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', handleKeyDown)
    return () => node.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !employee) {
    return null
  }

  async function deleteEmployee() {
    const currentEmployee = employee

    if (!currentEmployee) {
      return
    }

    try {
      setIsDeleting(true)
      setErrorMessage(null)

      const response = await fetch(`/api/employees/${currentEmployee.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete employee')
      }

      onDeleted(currentEmployee.id)
      onClose()
    } catch (error) {
      console.error('Failed to delete employee', error)
      setErrorMessage(t('failedToDelete'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45"
        onClick={onClose}
        aria-label="Close delete employee modal"
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Delete employee"
        className="relative ml-auto flex h-full w-full flex-col bg-white shadow-xl sm:mx-auto sm:my-10 sm:h-auto sm:w-[min(560px,95vw)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">{t('deleteTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            {errorMessage ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</div>
            ) : null}

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              {t('deleteConfirm', { name: employee.full_name })}
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
                {tCommon('cancel')}
              </Button>
              <Button variant="danger" isLoading={isDeleting} onClick={() => void deleteEmployee()}>
                {isDeleting ? t('deleting') : t('deleteAccount')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { EmployeeDeleteModal } from './EmployeeDeleteModal'
import { EmployeeEditModal } from './EmployeeEditModal'
import { EmployeeEmailModal } from './EmployeeEmailModal'
import { EmployeeInviteModal } from './EmployeeInviteModal'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Spinner } from '@/components/ui/Spinner'

type Employee = {
  id: string
  full_name: string
  phone: string | null
  is_active: boolean
  created_at: string
}

type EmployeesTableProps = {
  initialEmployees: Employee[]
}

type EmployeeActionsMenuProps = {
  employee: Employee
  isUpdatingActive: boolean
  isResending: boolean
  isResettingPassword: boolean
  onEdit: () => void
  onChangeEmail: () => void
  onToggleActive: () => void
  onResendInvite: () => void
  onPasswordReset: () => void
  onDelete: () => void
}

function EmployeeActionsMenu({
  employee,
  isUpdatingActive,
  isResending,
  isResettingPassword,
  onEdit,
  onChangeEmail,
  onToggleActive,
  onResendInvite,
  onPasswordReset,
  onDelete,
}: EmployeeActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    function handleScroll() {
      setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen])

  function handleAction(action: () => void) {
    setIsOpen(false)
    action()
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Employee actions"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation()
          if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
          }
          setIsOpen((prev) => !prev)
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {isOpen ? (
        <div
          style={menuPos ? { top: menuPos.top, right: menuPos.right } : undefined}
          className="fixed z-50 min-w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            onClick={() => handleAction(onEdit)}
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit Details
          </button>

          <button
            type="button"
            onClick={() => handleAction(onChangeEmail)}
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            Change Email
          </button>

          <div className="my-1 h-px bg-slate-100" />

          <button
            type="button"
            disabled={isResending}
            onClick={() => handleAction(onResendInvite)}
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isResending ? (
              <Spinner className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m22 2-7 20-4-9-9-4 20-7z" />
                <path d="M22 2 11 13" />
              </svg>
            )}
            Resend Invite
          </button>

          <button
            type="button"
            disabled={isResettingPassword}
            onClick={() => handleAction(onPasswordReset)}
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isResettingPassword ? (
              <Spinner className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="16" r="1" />
                <rect x="3" y="10" width="18" height="12" rx="2" />
                <path d="M7 10V7a5 5 0 0 1 10 0v3" />
              </svg>
            )}
            Reset Password
          </button>

          <button
            type="button"
            disabled={isUpdatingActive}
            onClick={() => handleAction(onToggleActive)}
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUpdatingActive ? (
              <Spinner className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
            )}
            {employee.is_active ? 'Set Inactive' : 'Set Active'}
          </button>

          <div className="my-1 h-px bg-slate-100" />

          <button
            type="button"
            onClick={() => handleAction(onDelete)}
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Delete Account
          </button>
        </div>
      ) : null}
    </div>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={active ? 'inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200' : 'inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300'}
    >
      {active ? 'active' : 'inactive'}
    </span>
  )
}

export function EmployeesTable({ initialEmployees }: EmployeesTableProps) {
  const [employees, setEmployees] = useState(initialEmployees)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null)
  const [isResendingId, setIsResendingId] = useState<string | null>(null)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [emailEmployee, setEmailEmployee] = useState<Employee | null>(null)
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null)
  const [isResettingPasswordId, setIsResettingPasswordId] = useState<string | null>(null)
  const [nameFilter, setNameFilter] = useState('')

  const filteredEmployees = useMemo(() => {
    if (!nameFilter) return employees
    return employees.filter((e) => e.id === nameFilter)
  }, [employees, nameFilter])

  function upsertEmployee(employee: Employee) {
    setEmployees((current) => {
      const exists = current.some((item) => item.id === employee.id)

      if (exists) {
        return current.map((item) => (item.id === employee.id ? employee : item))
      }

      return [employee, ...current]
    })
  }

  function removeEmployee(employeeId: string) {
    setEmployees((current) => current.filter((e) => e.id !== employeeId))
  }

  async function refreshEmployees() {
    const response = await fetch('/api/employees')

    if (!response.ok) {
      return
    }

    const data = (await response.json()) as Employee[]
    setEmployees(data)
  }

  async function toggleActive(employee: Employee) {
    const desiredState = !employee.is_active
    const allowed = window.confirm(
      desiredState
        ? `Set ${employee.full_name} as active?`
        : `Set ${employee.full_name} as inactive?`,
    )

    if (!allowed) {
      return
    }

    try {
      setIsUpdatingId(employee.id)

      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: desiredState,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update employee status')
      }

      const updated = (await response.json()) as Employee
      upsertEmployee(updated)
    } catch (error) {
      console.error('Failed to update employee status', error)
    } finally {
      setIsUpdatingId(null)
    }
  }

  async function resendInvite(employee: Employee) {
    const allowed = window.confirm(
      `Resend invite email to ${employee.full_name}?`,
    )

    if (!allowed) {
      return
    }

    try {
      setIsResendingId(employee.id)

      const response = await fetch(`/api/employees/${employee.id}/resend-invite`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to resend invite')
      }

      window.alert(`Invite resent to ${employee.full_name}.`)
    } catch (error) {
      console.error('Failed to resend invite', error)
      window.alert('Failed to resend invite. Please try again.')
    } finally {
      setIsResendingId(null)
    }
  }

  async function sendPasswordReset(employee: Employee) {
    const allowed = window.confirm(`Send a password reset email to ${employee.full_name}?`)

    if (!allowed) {
      return
    }

    try {
      setIsResettingPasswordId(employee.id)

      const response = await fetch(`/api/employees/${employee.id}/password-reset`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to send password reset')
      }

      window.alert(`Password reset email sent to ${employee.full_name}.`)
    } catch (error) {
      console.error('Failed to send password reset', error)
      window.alert('Failed to send password reset email. Please try again.')
    } finally {
      setIsResettingPasswordId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        action={
          <Button className="w-full sm:w-auto" onClick={() => setIsModalOpen(true)}>
            Invite Employee
          </Button>
        }
      />

      <Card className="mb-4">
        <SearchableSelect
          label="Search employee"
          options={employees.map((e) => ({ id: e.id, label: e.full_name }))}
          value={nameFilter}
          onChange={(id) => setNameFilter(id)}
          placeholder="All employees"
        />
      </Card>

      <div className="space-y-3 lg:hidden">
        {filteredEmployees.map((employee) => (
          <Card key={employee.id}>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
                onClick={() => setEditEmployee(employee)}
              >
                <span className="text-base font-semibold text-slate-900">{employee.full_name}</span>
                <span className="text-sm text-slate-500">{employee.phone || 'No phone'}</span>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge active={employee.is_active} />
                <EmployeeActionsMenu
                  employee={employee}
                  isUpdatingActive={isUpdatingId === employee.id}
                  isResending={isResendingId === employee.id}
                  isResettingPassword={isResettingPasswordId === employee.id}
                  onEdit={() => setEditEmployee(employee)}
                  onChangeEmail={() => setEmailEmployee(employee)}
                  onToggleActive={() => void toggleActive(employee)}
                  onResendInvite={() => void resendInvite(employee)}
                  onPasswordReset={() => void sendPasswordReset(employee)}
                  onDelete={() => setDeleteEmployee(employee)}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {!filteredEmployees.length ? (
        <Card className="lg:hidden">
          <p className="py-2 text-center text-sm text-slate-600">No employees found.</p>
        </Card>
      ) : null}

      <Card className="hidden p-0 lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredEmployees.map((employee) => (
                <tr
                  key={employee.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() => setEditEmployee(employee)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{employee.full_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{employee.phone || '-'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge active={employee.is_active} />
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <EmployeeActionsMenu
                      employee={employee}
                      isUpdatingActive={isUpdatingId === employee.id}
                      isResending={isResendingId === employee.id}
                      isResettingPassword={isResettingPasswordId === employee.id}
                      onEdit={() => setEditEmployee(employee)}
                      onChangeEmail={() => setEmailEmployee(employee)}
                      onToggleActive={() => void toggleActive(employee)}
                      onResendInvite={() => void resendInvite(employee)}
                      onPasswordReset={() => void sendPasswordReset(employee)}
                      onDelete={() => setDeleteEmployee(employee)}
                    />
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-5 text-center text-sm text-slate-600">No employees found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <EmployeeInviteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onInvited={() => {
          void refreshEmployees()
        }}
      />
      <EmployeeEditModal
        isOpen={editEmployee !== null}
        employee={editEmployee}
        onClose={() => setEditEmployee(null)}
        onUpdated={(updated) => {
          upsertEmployee(updated)
          setEditEmployee(null)
        }}
      />
      <EmployeeEmailModal
        isOpen={emailEmployee !== null}
        employee={emailEmployee}
        onClose={() => setEmailEmployee(null)}
        onUpdated={() => setEmailEmployee(null)}
      />
      <EmployeeDeleteModal
        isOpen={deleteEmployee !== null}
        employee={deleteEmployee}
        onClose={() => setDeleteEmployee(null)}
        onDeleted={(id) => {
          removeEmployee(id)
          setDeleteEmployee(null)
        }}
      />
    </div>
  )
}

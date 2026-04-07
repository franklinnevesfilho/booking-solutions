'use client'

import { useState } from 'react'

import { EmployeeInviteModal } from '@/components/admin/EmployeeInviteModal'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

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

  function upsertEmployee(employee: Employee) {
    setEmployees((current) => {
      const exists = current.some((item) => item.id === employee.id)

      if (exists) {
        return current.map((item) => (item.id === employee.id ? employee : item))
      }

      return [employee, ...current]
    })
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

      <div className="space-y-3 lg:hidden">
        {employees.map((employee) => (
          <Card key={employee.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-900">{employee.full_name}</p>
                <p className="text-sm text-slate-600">{employee.phone || 'No phone'}</p>
              </div>
              <StatusBadge active={employee.is_active} />
            </div>

            <Button
              variant="secondary"
              className="w-full"
              isLoading={isResendingId === employee.id}
              onClick={() => void resendInvite(employee)}
            >
              Resend Invite
            </Button>
            <Button
              variant={employee.is_active ? 'danger' : 'secondary'}
              className="w-full"
              isLoading={isUpdatingId === employee.id}
              onClick={() => void toggleActive(employee)}
            >
              {employee.is_active ? 'Set inactive' : 'Set active'}
            </Button>
          </Card>
        ))}
      </div>

      <Card className="hidden p-0 lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{employee.full_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{employee.phone || '-'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge active={employee.is_active} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="secondary"
                        isLoading={isResendingId === employee.id}
                        onClick={() => void resendInvite(employee)}
                      >
                        Resend Invite
                      </Button>
                      <Button
                        variant={employee.is_active ? 'danger' : 'secondary'}
                        isLoading={isUpdatingId === employee.id}
                        onClick={() => void toggleActive(employee)}
                      >
                        {employee.is_active ? 'Set inactive' : 'Set active'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
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
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'

import type { Client, ClientWithHomes } from '@/types'

import { ClientModal } from '@/components/admin/client/ClientModal'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

type ClientsTableProps = {
  initialClients: ClientWithHomes[]
}

export function ClientsTable({ initialClients }: ClientsTableProps) {
  const [clients, setClients] = useState<ClientWithHomes[]>(initialClients)
  const [query, setQuery] = useState('')
  const [activeClient, setActiveClient] = useState<Client | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return clients
    }

    return clients.filter((client) => client.full_name.toLowerCase().includes(normalizedQuery))
  }, [clients, query])

  function openCreateModal() {
    setActiveClient(null)
    setIsModalOpen(true)
  }

  function openEditModal(client: ClientWithHomes) {
    setActiveClient(client)
    setIsModalOpen(true)
  }

  function upsertClient(client: ClientWithHomes) {
    setClients((current) => {
      const exists = current.some((item) => item.id === client.id)
      const next = exists ? current.map((item) => (item.id === client.id ? client : item)) : [client, ...current]

      return next.sort((a, b) => a.full_name.localeCompare(b.full_name))
    })
  }

  async function deleteClient(clientId: string) {
    try {
      setIsDeleting(true)
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete client')
      }

      setClients((current) => current.filter((client) => client.id !== clientId))
      setPendingDeleteId(null)
    } catch (error) {
      console.error('Failed to delete client', error)
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleClientSaved(savedClient: Client) {
    try {
      const response = await fetch('/api/clients')
      if (response.ok) {
        const fresh = (await response.json()) as ClientWithHomes[]
        setClients(fresh.sort((a, b) => a.full_name.localeCompare(b.full_name)))
      } else {
        upsertClient({ ...savedClient, homes: [] })
      }
    } catch {
      upsertClient({ ...savedClient, homes: [] })
    }
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        action={
          <Button onClick={openCreateModal} className="w-full sm:w-auto">
            Add Client
          </Button>
        }
      />

      <Card className="mb-4">
        <Input
          label="Search clients"
          placeholder="Search by client name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </Card>

      <div className="space-y-3 lg:hidden">
        {filteredClients.map((client) => (
          <Card key={client.id} className="space-y-3">
            <div>
              <p className="text-base font-semibold text-slate-900">{client.full_name}</p>
              <p className="text-sm text-slate-600">{client.phone || 'No phone'}</p>
              <p className="text-sm text-slate-600">{client.email || 'No email'}</p>
              {(() => {
                const primary = client.homes?.find((h) => h.is_primary)
                return primary ? <p className="text-sm text-slate-600">{primary.street}{primary.city ? `, ${primary.city}` : ''}</p> : null
              })()}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => openEditModal(client)} className="w-full">
                Edit
              </Button>
              {pendingDeleteId === client.id ? (
                <div className="flex w-full flex-col gap-2 sm:flex-row">
                  <Button variant="danger" isLoading={isDeleting} onClick={() => void deleteClient(client.id)} className="w-full">
                    Are you sure?
                  </Button>
                  <Button variant="ghost" onClick={() => setPendingDeleteId(null)} className="w-full">
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="danger" onClick={() => setPendingDeleteId(client.id)} className="w-full">
                  Delete
                </Button>
              )}
            </div>
          </Card>
        ))}

        {filteredClients.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-600">No clients found.</p>
          </Card>
        ) : null}
      </div>

      <Card className="hidden p-0 lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Primary Home</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredClients.map((client) => (
                <tr key={client.id}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{client.full_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{client.phone || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{client.email || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {(() => {
                      const primary = client.homes?.find((h) => h.is_primary)
                      return primary ? `${primary.street}${primary.city ? `, ${primary.city}` : ''}` : '-'
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="secondary" onClick={() => openEditModal(client)}>
                        Edit
                      </Button>
                      {pendingDeleteId === client.id ? (
                        <>
                          <Button variant="danger" isLoading={isDeleting} onClick={() => void deleteClient(client.id)}>
                            Are you sure?
                          </Button>
                          <Button variant="ghost" onClick={() => setPendingDeleteId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button variant="danger" onClick={() => setPendingDeleteId(client.id)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredClients.length === 0 ? <p className="px-4 py-5 text-sm text-slate-600">No clients found.</p> : null}
        </div>
      </Card>

      <ClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        client={activeClient}
        onSaved={handleClientSaved}
      />
    </div>
  )
}

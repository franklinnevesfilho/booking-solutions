'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import type { Client, ClientHome } from '@/types'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type ClientModalProps = {
  isOpen: boolean
  onClose: () => void
  onSaved: (client: Client) => void
  client?: Client | null
}

const clientSchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required'),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})

const homeFormSchema = z.object({
  label: z.string().trim().optional(),
  street: z.string().trim().min(1, 'Street is required'),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postal_code: z.string().trim().optional(),
  country: z.string().trim().optional(),
  is_primary: z.boolean().optional(),
})

type ClientFormValues = z.infer<typeof clientSchema>
type HomeFormValues = z.infer<typeof homeFormSchema>

function defaultValues(client?: Client | null): ClientFormValues {
  return {
    full_name: client?.full_name ?? '',
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    notes: client?.notes ?? '',
  }
}

type HomeFormProps = {
  defaultValues: HomeFormValues
  onSubmit: (values: HomeFormValues) => Promise<void> | void
  onCancel: () => void
  isLoading: boolean
}

function HomeForm({ defaultValues, onSubmit, onCancel, isLoading }: HomeFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HomeFormValues>({
    resolver: zodResolver(homeFormSchema),
    defaultValues,
  })

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  return (
    <div className="space-y-2">
      <Input label="Label" {...register('label')} />
      <Input label="Street" error={errors.street?.message} {...register('street')} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input label="City" {...register('city')} />
        <Input label="State" {...register('state')} />
        <Input label="Postal code" {...register('postal_code')} />
        <Input label="Country" {...register('country')} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading || isSubmitting}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit(onSubmit)} isLoading={isLoading || isSubmitting}>
          Save Home
        </Button>
      </div>
    </div>
  )
}

export function ClientModal({ isOpen, onClose, onSaved, client }: ClientModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [currentClient, setCurrentClient] = useState<Client | null>(client ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [homes, setHomes] = useState<ClientHome[]>([])
  const [isLoadingHomes, setIsLoadingHomes] = useState(false)
  const [showAddHomeForm, setShowAddHomeForm] = useState(false)
  const [showCreateHomeForm, setShowCreateHomeForm] = useState(false)
  const [addHomeDefaults, setAddHomeDefaults] = useState<HomeFormValues>({
    label: '',
    street: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    is_primary: false,
  })
  const [homeError, setHomeError] = useState<string | null>(null)
  const [editingHomeId, setEditingHomeId] = useState<string | null>(null)
  const [deletingHomeId, setDeletingHomeId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: defaultValues(client),
  })

  const {
    register: registerCreateHome,
    reset: resetCreateHome,
    getValues: getCreateHomeValues,
  } = useForm<HomeFormValues>({
    defaultValues: {
      label: '',
      street: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      is_primary: true,
    },
  })

  useEffect(() => {
    setCurrentClient(client ?? null)
    reset(defaultValues(client))
    setErrorMessage(null)
    setShowCreateHomeForm(false)
    resetCreateHome({
      label: '',
      street: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      is_primary: true,
    })
    setAddHomeDefaults({
      label: '',
      street: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      is_primary: false,
    })
  }, [client, isOpen, reset, resetCreateHome])

  useEffect(() => {
    if (!isOpen || !currentClient?.id) {
      setHomes([])
      setShowAddHomeForm(false)
      setEditingHomeId(null)
      setDeletingHomeId(null)
      setHomeError(null)
      return
    }

    const clientId = currentClient.id

    let cancelled = false

    async function loadHomes() {
      try {
        setIsLoadingHomes(true)
        setHomeError(null)

        const response = await fetch(`/api/clients/${clientId}/homes`)
        if (!response.ok) {
          throw new Error('Failed to load homes')
        }

        const data = (await response.json()) as ClientHome[]
        if (!cancelled) {
          setHomes(data)
        }
      } catch (error) {
        console.error('Failed to fetch homes', error)
        if (!cancelled) {
          setHomes([])
          setHomeError('Failed to load homes. Please try again.')
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHomes(false)
        }
      }
    }

    void loadHomes()

    return () => {
      cancelled = true
    }
  }, [isOpen, currentClient?.id])

  async function addHome(values: HomeFormValues) {
    if (!currentClient?.id) {
      return
    }

    try {
      setHomeError(null)

      const response = await fetch(`/api/clients/${currentClient.id}/homes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label: values.label || undefined,
          street: values.street,
          city: values.city || undefined,
          state: values.state || undefined,
          postal_code: values.postal_code || undefined,
          country: values.country || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add home')
      }

      const savedHome = (await response.json()) as ClientHome
      setHomes((current) => [...current, savedHome])
      setShowAddHomeForm(false)
      setAddHomeDefaults({
        label: '',
        street: '',
        city: '',
        state: '',
        postal_code: '',
        country: '',
        is_primary: false,
      })
    } catch (error) {
      console.error('Failed to add home', error)
      setHomeError('Failed to add home. Please try again.')
    }
  }

  async function updateHome(homeId: string, values: HomeFormValues) {
    if (!currentClient?.id) {
      return
    }

    try {
      setHomeError(null)

      const response = await fetch(`/api/clients/${currentClient.id}/homes/${homeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label: values.label || undefined,
          street: values.street,
          city: values.city || undefined,
          state: values.state || undefined,
          postal_code: values.postal_code || undefined,
          country: values.country || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update home')
      }

      const updatedHome = (await response.json()) as ClientHome
      setHomes((current) => current.map((home) => (home.id === updatedHome.id ? updatedHome : home)))
      setEditingHomeId(null)
    } catch (error) {
      console.error('Failed to update home', error)
      setHomeError('Failed to update home. Please try again.')
    }
  }

  async function deleteHome(homeId: string) {
    if (!currentClient?.id) {
      return
    }

    try {
      setHomeError(null)

      const response = await fetch(`/api/clients/${currentClient.id}/homes/${homeId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        if (response.status === 400) {
          let message = 'Cannot delete home with upcoming appointments.'

          try {
            const payload = (await response.json()) as { message?: string }
            if (payload.message) {
              message = payload.message
            }
          } catch {
            // no-op
          }

          setHomeError(message)
          return
        }

        throw new Error('Failed to delete home')
      }

      setHomes((current) => current.filter((home) => home.id !== homeId))
      setDeletingHomeId(null)
    } catch (error) {
      console.error('Failed to delete home', error)
      setHomeError('Failed to delete home. Please try again.')
    }
  }

  async function setPrimary(homeId: string) {
    if (!currentClient?.id) {

      return
    }

    try {
      setHomeError(null)

      const updateResponse = await fetch(`/api/clients/${currentClient.id}/homes/${homeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_primary: true }),
      })

      if (!updateResponse.ok) {
        throw new Error('Failed to set primary home')
      }

      const refreshResponse = await fetch(`/api/clients/${currentClient.id}/homes`)
      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh homes')
      }

      const refreshedHomes = (await refreshResponse.json()) as ClientHome[]
      setHomes(refreshedHomes)
    } catch (error) {
      console.error('Failed to set primary home', error)
      setHomeError('Failed to set primary home. Please try again.')
    }
  }

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

  if (!isOpen) {
    return null
  }

  async function onSubmit(values: ClientFormValues) {
    try {
      setIsSaving(true)
      setErrorMessage(null)
      setHomeError(null)

      const payload = {
        full_name: values.full_name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        notes: values.notes || undefined,
      }

      const response = await fetch(currentClient ? `/api/clients/${currentClient.id}` : '/api/clients', {
        method: currentClient ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Failed to save client')
      }

      const savedClient = (await response.json()) as Client

      if (!currentClient?.id) {
        const createHomeValues = getCreateHomeValues()
        const hasStreet = createHomeValues.street.trim().length > 0

        if (showCreateHomeForm && hasStreet) {
          try {
            const homeResponse = await fetch(`/api/clients/${savedClient.id}/homes`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                label: createHomeValues.label || undefined,
                street: createHomeValues.street,
                city: createHomeValues.city || undefined,
                state: createHomeValues.state || undefined,
                postal_code: createHomeValues.postal_code || undefined,
                country: createHomeValues.country || undefined,
                is_primary: createHomeValues.is_primary ?? true,
              }),
            })

            if (!homeResponse.ok) {
              throw new Error('Failed to add home')
            }
          } catch (error) {
            console.error('Failed to add home', error)
            setCurrentClient(savedClient)
            setShowCreateHomeForm(false)
            setAddHomeDefaults(createHomeValues)
            setShowAddHomeForm(true)
            setHomeError('Client saved, but failed to add home. Please try again.')
            onSaved(savedClient)
            return
          }
        }
      }

      onSaved(savedClient)
      onClose()
    } catch (error) {
      console.error('Failed to save client', error)
      setErrorMessage('Failed to save client. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45"
        onClick={onClose}
        aria-label="Close client modal"
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={currentClient ? 'Edit client' : 'Add client'}
        className="relative ml-auto flex h-full w-full flex-col bg-white shadow-xl sm:mx-auto sm:my-10 sm:h-auto sm:max-h-[calc(100%-5rem)] sm:w-[min(700px,95vw)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">{currentClient ? 'Edit Client' : 'Add Client'}</h2>
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

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            {errorMessage ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</div>
            ) : null}

            <Input label="Full name" error={errors.full_name?.message} {...register('full_name')} />
            <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
            <Input label="Phone" {...register('phone')} />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Homes</p>
                {currentClient?.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddHomeForm(true)
                      setAddHomeDefaults({
                        label: '',
                        street: '',
                        city: '',
                        state: '',
                        postal_code: '',
                        country: '',
                        is_primary: false,
                      })
                      setHomeError(null)
                    }}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    + Add home
                  </button>
                ) : null}
              </div>

              {!currentClient?.id ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (showCreateHomeForm) {
                        setShowCreateHomeForm(false)
                        resetCreateHome({
                          label: '',
                          street: '',
                          city: '',
                          state: '',
                          postal_code: '',
                          country: '',
                          is_primary: true,
                        })
                      } else {
                        setShowCreateHomeForm(true)
                      }
                    }}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    {showCreateHomeForm ? 'Remove home address' : '+ Add a home address'}
                  </button>

                  {showCreateHomeForm ? (
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <Input label="Label" {...registerCreateHome('label')} />
                      <Input label="Street" {...registerCreateHome('street')} />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Input label="City" {...registerCreateHome('city')} />
                        <Input label="State" {...registerCreateHome('state')} />
                        <Input label="Postal code" {...registerCreateHome('postal_code')} />
                        <Input label="Country" {...registerCreateHome('country')} />
                      </div>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                          {...registerCreateHome('is_primary')}
                        />
                        <span className="text-sm text-slate-700">Set as primary home</span>
                      </label>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Save the client first to add homes.</p>
                  )}
                </div>
              ) : isLoadingHomes ? (
                <p className="text-sm text-slate-500">Loading homes...</p>
              ) : (
                <>
                  {homeError ? (
                    <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{homeError}</div>
                  ) : null}

                  {homes.length === 0 && !showAddHomeForm ? <p className="text-sm text-slate-500">No homes added yet.</p> : null}

                  <div className="space-y-2">
                    {homes.map((home) => (
                      <div key={home.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        {editingHomeId === home.id ? (
                          <HomeForm
                            defaultValues={{
                              label: home.label ?? '',
                              street: home.street,
                              city: home.city,
                              state: home.state,
                              postal_code: home.postal_code,
                              country: home.country,
                            }}
                            onSubmit={(values) => void updateHome(home.id, values)}
                            onCancel={() => setEditingHomeId(null)}
                            isLoading={false}
                          />
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              {home.is_primary ? (
                                <span className="mb-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">Primary</span>
                              ) : null}
                              {home.label ? <p className="text-sm font-medium text-slate-900">{home.label}</p> : null}
                              <p className="text-sm text-slate-700">{home.street}</p>
                              {home.city || home.state || home.postal_code ? (
                                <p className="text-sm text-slate-600">{[home.city, home.state, home.postal_code].filter(Boolean).join(', ')}</p>
                              ) : null}
                            </div>
                            <div className="flex flex-shrink-0 flex-col gap-1 text-right">
                              {!home.is_primary ? (
                                <button
                                  type="button"
                                  onClick={() => void setPrimary(home.id)}
                                  className="text-xs text-slate-500 hover:text-slate-700"
                                >
                                  Set primary
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingHomeId(home.id)
                                  setHomeError(null)
                                }}
                                className="text-xs text-brand-600 hover:text-brand-700"
                              >
                                Edit
                              </button>
                              {deletingHomeId === home.id ? (
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => void deleteHome(home.id)}
                                    className="text-xs font-medium text-rose-600 hover:text-rose-700"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingHomeId(null)}
                                    className="text-xs text-slate-500 hover:text-slate-700"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeletingHomeId(home.id)
                                    setHomeError(null)
                                  }}
                                  className="text-xs text-rose-600 hover:text-rose-700"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {showAddHomeForm ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <HomeForm
                          defaultValues={addHomeDefaults}
                          onSubmit={(values) => void addHome(values)}
                          onCancel={() => {
                            setShowAddHomeForm(false)
                            setAddHomeDefaults({
                              label: '',
                              street: '',
                              city: '',
                              state: '',
                              postal_code: '',
                              country: '',
                              is_primary: false,
                            })
                          }}
                          isLoading={false}
                        />
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            <div>
              <label htmlFor="client_notes" className="mb-1.5 block text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                id="client_notes"
                rows={4}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                {...register('notes')}
              />
            </div>
          </div>

          {!editingHomeId && !showAddHomeForm ? (
            <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSaving}>
                  Save Client
                </Button>
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  )
}

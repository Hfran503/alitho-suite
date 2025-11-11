'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PortalPageConfig {
  id: string
  pageKey: string
  label: string
  href: string
  icon: string | null
  order: number
  isActive: boolean
  description: string | null
  visibilityMode: 'all' | 'pace_ids' | 'user_ids' | 'user_emails'
  allowedPaceCustomerIds: string[]
  allowedUserIds: string[]
  allowedUserEmails: string[]
}

const VISIBILITY_MODES = [
  { value: 'all', label: 'All Customers', description: 'Visible to all portal users' },
  { value: 'pace_ids', label: 'PACE Customer IDs', description: 'Only specific PACE Customer IDs' },
  { value: 'user_ids', label: 'User IDs', description: 'Only specific user IDs' },
  { value: 'user_emails', label: 'User Emails', description: 'Only specific user emails' },
]

const MODE_COLORS: Record<string, string> = {
  all: 'bg-green-100 text-green-800',
  pace_ids: 'bg-blue-100 text-blue-800',
  user_ids: 'bg-purple-100 text-purple-800',
  user_emails: 'bg-orange-100 text-orange-800',
}

export function PortalPagesSettings() {
  const [pageConfigs, setPageConfigs] = useState<PortalPageConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creatingPage, setCreatingPage] = useState(false)
  const [newPage, setNewPage] = useState({
    pageKey: '',
    label: '',
    href: '',
    icon: '',
    description: '',
    visibilityMode: 'all' as 'all' | 'pace_ids' | 'user_ids' | 'user_emails',
    allowedPaceCustomerIds: '',
    allowedUserIds: '',
    allowedUserEmails: '',
  })

  useEffect(() => {
    fetchPageConfigs()
  }, [])

  const fetchPageConfigs = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/portal-pages-configuration')
      const data = await res.json()
      setPageConfigs(data.pageConfigs || [])
    } catch (error) {
      console.error('Error fetching portal page configs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInitialize = async () => {
    if (!confirm('This will create the default portal pages structure. Continue?')) {
      return
    }

    try {
      setInitializing(true)
      const res = await fetch('/api/admin/portal-pages-configuration/initialize', {
        method: 'POST',
      })

      if (res.ok) {
        await fetchPageConfigs()
        alert('Portal pages initialized successfully!')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to initialize portal pages')
      }
    } catch (error) {
      console.error('Error initializing portal pages:', error)
      alert('Failed to initialize portal pages')
    } finally {
      setInitializing(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/admin/portal-pages-configuration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageConfigs }),
      })

      if (res.ok) {
        setHasChanges(false)
        alert('Portal pages saved successfully!')
      } else {
        alert('Failed to save portal pages')
      }
    } catch (error) {
      console.error('Error saving portal pages:', error)
      alert('Failed to save portal pages')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = (pageKey: string) => {
    setPageConfigs((prev) =>
      prev.map((config) =>
        config.pageKey === pageKey ? { ...config, isActive: !config.isActive } : config
      )
    )
    setHasChanges(true)
  }

  const updateVisibilityMode = (
    pageKey: string,
    mode: 'all' | 'pace_ids' | 'user_ids' | 'user_emails'
  ) => {
    setPageConfigs((prev) =>
      prev.map((config) =>
        config.pageKey === pageKey ? { ...config, visibilityMode: mode } : config
      )
    )
    setHasChanges(true)
  }

  const updateAllowedValues = (
    pageKey: string,
    field: 'allowedPaceCustomerIds' | 'allowedUserIds' | 'allowedUserEmails',
    value: string
  ) => {
    const values = value
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v)

    setPageConfigs((prev) =>
      prev.map((config) => (config.pageKey === pageKey ? { ...config, [field]: values } : config))
    )
    setHasChanges(true)
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const items = Array.from(pageConfigs)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    // Update order values
    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index,
    }))

    setPageConfigs(updatedItems)
    setHasChanges(true)
  }

  const handleDelete = async (pageKey: string) => {
    if (
      !confirm('Are you sure you want to delete this portal page? This action cannot be undone.')
    ) {
      return
    }

    try {
      const res = await fetch(`/api/admin/portal-pages-configuration/${pageKey}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchPageConfigs()
        alert('Portal page deleted successfully!')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete portal page')
      }
    } catch (error) {
      console.error('Error deleting portal page:', error)
      alert('Failed to delete portal page')
    }
  }

  const handleCreatePage = async () => {
    if (!newPage.pageKey || !newPage.label || !newPage.href) {
      alert('Please fill in all required fields (Page Key, Label, Href)')
      return
    }

    try {
      setCreatingPage(true)
      const res = await fetch('/api/admin/portal-pages-configuration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageKey: newPage.pageKey,
          label: newPage.label,
          href: newPage.href,
          icon: newPage.icon || null,
          description: newPage.description || null,
          visibilityMode: newPage.visibilityMode,
          allowedPaceCustomerIds: newPage.allowedPaceCustomerIds
            .split(',')
            .map((v) => v.trim())
            .filter((v) => v),
          allowedUserIds: newPage.allowedUserIds
            .split(',')
            .map((v) => v.trim())
            .filter((v) => v),
          allowedUserEmails: newPage.allowedUserEmails
            .split(',')
            .map((v) => v.trim())
            .filter((v) => v),
          order: pageConfigs.length,
        }),
      })

      if (res.ok) {
        await fetchPageConfigs()
        setShowCreateModal(false)
        setNewPage({
          pageKey: '',
          label: '',
          href: '',
          icon: '',
          description: '',
          visibilityMode: 'all',
          allowedPaceCustomerIds: '',
          allowedUserIds: '',
          allowedUserEmails: '',
        })
        alert('Portal page created successfully!')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to create portal page')
      }
    } catch (error) {
      console.error('Error creating portal page:', error)
      alert('Failed to create portal page')
    } finally {
      setCreatingPage(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading portal pages configuration...</div>
  }

  if (pageConfigs.length === 0) {
    return (
      <div className="p-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Portal Pages Not Initialized</h3>
          <p className="text-gray-600 mb-4">
            Initialize the default portal pages structure to get started. This will create pages
            for Welcome, Shipments, Orders, and PDF Generator.
          </p>
          <Button onClick={handleInitialize} disabled={initializing}>
            {initializing ? 'Initializing...' : 'Initialize Portal Pages'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Portal Pages Configuration</h2>
          <p className="text-gray-600 mt-1">
            Manage which pages appear in the customer portal and control visibility per customer
          </p>
        </div>
        <div className="space-x-2">
          <Button variant="outline" onClick={() => setShowCreateModal(true)}>
            Create Page
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">You have unsaved changes. Click "Save Changes" to apply.</p>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="portal-pages">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
              {pageConfigs.map((page, index) => (
                <Draggable key={page.pageKey} draggableId={page.pageKey} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`bg-white border rounded-lg p-6 ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        <div {...provided.dragHandleProps} className="cursor-grab mt-2">
                          <svg
                            className="w-5 h-5 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 8h16M4 16h16"
                            />
                          </svg>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-semibold">{page.label}</h3>
                              <p className="text-sm text-gray-500">
                                {page.href} • {page.pageKey}
                              </p>
                              {page.description && (
                                <p className="text-sm text-gray-600 mt-1">{page.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={page.isActive}
                                  onChange={() => toggleActive(page.pageKey)}
                                  className="rounded"
                                />
                                <span className="text-sm">Active</span>
                              </label>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(page.pageKey)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>

                          {/* Visibility Mode */}
                          <div className="mb-4">
                            <Label className="text-sm font-medium mb-2 block">Visibility Mode</Label>
                            <div className="flex gap-2 flex-wrap">
                              {VISIBILITY_MODES.map((mode) => (
                                <button
                                  key={mode.value}
                                  onClick={() =>
                                    updateVisibilityMode(
                                      page.pageKey,
                                      mode.value as 'all' | 'pace_ids' | 'user_ids' | 'user_emails'
                                    )
                                  }
                                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                    page.visibilityMode === mode.value
                                      ? MODE_COLORS[mode.value]
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                  title={mode.description}
                                >
                                  {mode.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Conditional Inputs Based on Visibility Mode */}
                          {page.visibilityMode === 'pace_ids' && (
                            <div className="mb-3">
                              <Label htmlFor={`pace-ids-${page.pageKey}`} className="text-sm">
                                Allowed PACE Customer IDs (comma-separated)
                              </Label>
                              <Input
                                id={`pace-ids-${page.pageKey}`}
                                placeholder="e.g., 12345, 67890"
                                value={page.allowedPaceCustomerIds.join(', ')}
                                onChange={(e) =>
                                  updateAllowedValues(
                                    page.pageKey,
                                    'allowedPaceCustomerIds',
                                    e.target.value
                                  )
                                }
                                className="mt-1 font-mono text-sm"
                              />
                            </div>
                          )}

                          {page.visibilityMode === 'user_ids' && (
                            <div className="mb-3">
                              <Label htmlFor={`user-ids-${page.pageKey}`} className="text-sm">
                                Allowed User IDs (comma-separated)
                              </Label>
                              <Input
                                id={`user-ids-${page.pageKey}`}
                                placeholder="e.g., clxyz123, clxyz456"
                                value={page.allowedUserIds.join(', ')}
                                onChange={(e) =>
                                  updateAllowedValues(page.pageKey, 'allowedUserIds', e.target.value)
                                }
                                className="mt-1 font-mono text-sm"
                              />
                            </div>
                          )}

                          {page.visibilityMode === 'user_emails' && (
                            <div className="mb-3">
                              <Label htmlFor={`user-emails-${page.pageKey}`} className="text-sm">
                                Allowed User Emails (comma-separated)
                              </Label>
                              <Input
                                id={`user-emails-${page.pageKey}`}
                                placeholder="e.g., customer@example.com, user@example.com"
                                value={page.allowedUserEmails.join(', ')}
                                onChange={(e) =>
                                  updateAllowedValues(
                                    page.pageKey,
                                    'allowedUserEmails',
                                    e.target.value
                                  )
                                }
                                className="mt-1 font-mono text-sm"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Create Page Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Create Portal Page</h3>

            <div className="space-y-4">
              <div>
                <Label htmlFor="pageKey">Page Key *</Label>
                <Input
                  id="pageKey"
                  placeholder="e.g., portal-reports"
                  value={newPage.pageKey}
                  onChange={(e) => setNewPage({ ...newPage, pageKey: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="label">Label *</Label>
                <Input
                  id="label"
                  placeholder="e.g., Reports"
                  value={newPage.label}
                  onChange={(e) => setNewPage({ ...newPage, label: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="href">Href *</Label>
                <Input
                  id="href"
                  placeholder="e.g., /portal/reports"
                  value={newPage.href}
                  onChange={(e) => setNewPage({ ...newPage, href: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="icon">Icon</Label>
                <Input
                  id="icon"
                  placeholder="e.g., document, home, truck"
                  value={newPage.icon}
                  onChange={(e) => setNewPage({ ...newPage, icon: e.target.value })}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available: home, truck, package, document
                </p>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Optional description"
                  value={newPage.description}
                  onChange={(e) => setNewPage({ ...newPage, description: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Visibility Mode</Label>
                <select
                  value={newPage.visibilityMode}
                  onChange={(e) =>
                    setNewPage({
                      ...newPage,
                      visibilityMode: e.target.value as
                        | 'all'
                        | 'pace_ids'
                        | 'user_ids'
                        | 'user_emails',
                    })
                  }
                  className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {VISIBILITY_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label} - {mode.description}
                    </option>
                  ))}
                </select>
              </div>

              {newPage.visibilityMode === 'pace_ids' && (
                <div>
                  <Label htmlFor="paceIds">Allowed PACE Customer IDs</Label>
                  <Input
                    id="paceIds"
                    placeholder="Comma-separated IDs"
                    value={newPage.allowedPaceCustomerIds}
                    onChange={(e) =>
                      setNewPage({ ...newPage, allowedPaceCustomerIds: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
              )}

              {newPage.visibilityMode === 'user_emails' && (
                <div>
                  <Label htmlFor="emails">Allowed User Emails</Label>
                  <Input
                    id="emails"
                    placeholder="Comma-separated emails"
                    value={newPage.allowedUserEmails}
                    onChange={(e) => setNewPage({ ...newPage, allowedUserEmails: e.target.value })}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <Button onClick={handleCreatePage} disabled={creatingPage}>
                {creatingPage ? 'Creating...' : 'Create Page'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

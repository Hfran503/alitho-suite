'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Modal } from '@/components/Modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Globe,
  GripVertical,
  Plus,
  Trash2,
  Loader2,
  FileText,
  Eye,
  EyeOff,
  Users,
  Hash,
  Mail,
  Link,
  Sparkles,
  AlertCircle,
  Save,
  Home,
  Truck,
  Package,
  FileIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  { value: 'all', label: 'All Customers', description: 'Visible to all portal users', icon: Users, color: 'emerald' },
  { value: 'pace_ids', label: 'PACE IDs', description: 'Only specific PACE Customer IDs', icon: Hash, color: 'blue' },
  { value: 'user_ids', label: 'User IDs', description: 'Only specific user IDs', icon: Users, color: 'violet' },
  { value: 'user_emails', label: 'Emails', description: 'Only specific user emails', icon: Mail, color: 'amber' },
]

const ICON_MAP: Record<string, React.ElementType> = {
  home: Home,
  truck: Truck,
  package: Package,
  document: FileIcon,
}

const getVisibilityColor = (mode: string) => {
  switch (mode) {
    case 'all': return 'bg-emerald-100 text-emerald-700'
    case 'pace_ids': return 'bg-blue-100 text-blue-700'
    case 'user_ids': return 'bg-violet-100 text-violet-700'
    case 'user_emails': return 'bg-amber-100 text-amber-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

export function PortalPagesSettings() {
  const [pageConfigs, setPageConfigs] = useState<PortalPageConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creatingPage, setCreatingPage] = useState(false)
  const [expandedPage, setExpandedPage] = useState<string | null>(null)
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

    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index,
    }))

    setPageConfigs(updatedItems)
    setHasChanges(true)
  }

  const handleDelete = async (pageKey: string) => {
    if (!confirm('Are you sure you want to delete this portal page?')) {
      return
    }

    try {
      const res = await fetch(`/api/admin/portal-pages-configuration/${pageKey}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchPageConfigs()
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

  const activePages = pageConfigs.filter(p => p.isActive).length

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-48 gap-3">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Loading portal pages...</p>
      </div>
    )
  }

  if (pageConfigs.length === 0) {
    return (
      <div className="p-6">
      <Card className="border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/25">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-gray-900 text-lg">Portal Pages Not Initialized</h3>
            <p className="text-sm text-gray-600 mt-1 max-w-md">
              Initialize the default portal pages structure to get started. This creates pages for Welcome, Shipments, Orders, and PDF Generator.
            </p>
          </div>
          <Button
            onClick={handleInitialize}
            disabled={initializing}
            className="mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25"
          >
            {initializing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Initialize Portal Pages
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* Stats Bar */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <Globe className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Pages</p>
              <p className="text-lg font-bold text-gray-900">{pageConfigs.length}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 rounded-lg">
              <Eye className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Active</p>
              <p className="text-lg font-bold text-gray-900">{activePages}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gray-100 rounded-lg">
              <EyeOff className="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Hidden</p>
              <p className="text-lg font-bold text-gray-900">{pageConfigs.length - activePages}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="h-9 gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Page
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={cn(
              'h-9 gap-2',
              hasChanges
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25'
                : ''
            )}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 rounded-lg border border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">You have unsaved changes. Click Save to apply.</p>
        </div>
      )}

      {/* Pages List */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="portal-pages">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
              {pageConfigs.map((page, index) => {
                const IconComponent = page.icon ? ICON_MAP[page.icon] || FileText : FileText
                const isExpanded = expandedPage === page.pageKey

                return (
                  <Draggable key={page.pageKey} draggableId={page.pageKey} index={index}>
                    {(provided, snapshot) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          'border border-gray-200 overflow-hidden transition-all',
                          snapshot.isDragging && 'shadow-xl ring-2 ring-blue-500/20',
                          !page.isActive && 'opacity-60'
                        )}
                      >
                        <CardContent className="p-0">
                          {/* Page Header */}
                          <div
                            className={cn(
                              'px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50',
                              isExpanded && 'border-b border-gray-100'
                            )}
                            onClick={() => setExpandedPage(isExpanded ? null : page.pageKey)}
                          >
                            <div {...provided.dragHandleProps} className="cursor-grab" onClick={e => e.stopPropagation()}>
                              <GripVertical className="h-4 w-4 text-gray-400" />
                            </div>

                            <div className={cn(
                              'p-2 rounded-lg',
                              page.isActive ? 'bg-blue-100' : 'bg-gray-100'
                            )}>
                              <IconComponent className={cn(
                                'h-4 w-4',
                                page.isActive ? 'text-blue-600' : 'text-gray-400'
                              )} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-gray-900 truncate">{page.label}</h3>
                                <Badge className={cn('text-[10px] px-1.5 py-0 border-0', getVisibilityColor(page.visibilityMode))}>
                                  {VISIBILITY_MODES.find(m => m.value === page.visibilityMode)?.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Link className="h-3 w-3" />
                                <span className="truncate">{page.href}</span>
                                <span className="text-gray-300">•</span>
                                <span className="font-mono">{page.pageKey}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                              <Switch
                                checked={page.isActive}
                                onCheckedChange={() => toggleActive(page.pageKey)}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(page.pageKey)}
                                className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div className="px-4 py-3 bg-gray-50/50 space-y-4">
                              {page.description && (
                                <p className="text-sm text-gray-600">{page.description}</p>
                              )}

                              {/* Visibility Mode Selection */}
                              <div>
                                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                                  Visibility Mode
                                </Label>
                                <div className="flex gap-2 flex-wrap">
                                  {VISIBILITY_MODES.map((mode) => {
                                    const ModeIcon = mode.icon
                                    const isSelected = page.visibilityMode === mode.value
                                    return (
                                      <button
                                        key={mode.value}
                                        onClick={() =>
                                          updateVisibilityMode(
                                            page.pageKey,
                                            mode.value as 'all' | 'pace_ids' | 'user_ids' | 'user_emails'
                                          )
                                        }
                                        className={cn(
                                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                                          isSelected
                                            ? getVisibilityColor(mode.value)
                                            : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                                        )}
                                      >
                                        <ModeIcon className="h-3.5 w-3.5" />
                                        {mode.label}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* Conditional Inputs */}
                              {page.visibilityMode === 'pace_ids' && (
                                <div>
                                  <Label className="text-xs font-medium text-gray-500 mb-1.5 block">
                                    Allowed PACE Customer IDs (comma-separated)
                                  </Label>
                                  <Input
                                    placeholder="e.g., 12345, 67890"
                                    value={page.allowedPaceCustomerIds.join(', ')}
                                    onChange={(e) =>
                                      updateAllowedValues(page.pageKey, 'allowedPaceCustomerIds', e.target.value)
                                    }
                                    className="h-9 font-mono text-sm bg-white"
                                  />
                                </div>
                              )}

                              {page.visibilityMode === 'user_ids' && (
                                <div>
                                  <Label className="text-xs font-medium text-gray-500 mb-1.5 block">
                                    Allowed User IDs (comma-separated)
                                  </Label>
                                  <Input
                                    placeholder="e.g., clxyz123, clxyz456"
                                    value={page.allowedUserIds.join(', ')}
                                    onChange={(e) =>
                                      updateAllowedValues(page.pageKey, 'allowedUserIds', e.target.value)
                                    }
                                    className="h-9 font-mono text-sm bg-white"
                                  />
                                </div>
                              )}

                              {page.visibilityMode === 'user_emails' && (
                                <div>
                                  <Label className="text-xs font-medium text-gray-500 mb-1.5 block">
                                    Allowed User Emails (comma-separated)
                                  </Label>
                                  <Input
                                    placeholder="e.g., customer@example.com"
                                    value={page.allowedUserEmails.join(', ')}
                                    onChange={(e) =>
                                      updateAllowedValues(page.pageKey, 'allowedUserEmails', e.target.value)
                                    }
                                    className="h-9 text-sm bg-white"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </Draggable>
                )
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Create Page Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Portal Page"
        size="lg"
      >
        <div className="space-y-4">
          {/* Page Key & Label */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium text-gray-500 mb-1.5 block">
                Page Key <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g., portal-reports"
                value={newPage.pageKey}
                onChange={(e) => setNewPage({ ...newPage, pageKey: e.target.value })}
                className="h-9 font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-500 mb-1.5 block">
                Label <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g., Reports"
                value={newPage.label}
                onChange={(e) => setNewPage({ ...newPage, label: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Href & Icon */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium text-gray-500 mb-1.5 block">
                Href <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g., /portal/reports"
                value={newPage.href}
                onChange={(e) => setNewPage({ ...newPage, href: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-500 mb-1.5 block">Icon</Label>
              <Select
                value={newPage.icon}
                onValueChange={(value) => setNewPage({ ...newPage, icon: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select icon" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="package">Package</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs font-medium text-gray-500 mb-1.5 block">Description</Label>
            <Input
              placeholder="Optional description"
              value={newPage.description}
              onChange={(e) => setNewPage({ ...newPage, description: e.target.value })}
              className="h-9 text-sm"
            />
          </div>

          {/* Visibility Mode */}
          <div>
            <Label className="text-xs font-medium text-gray-500 mb-2 block">Visibility Mode</Label>
            <div className="flex gap-2 flex-wrap">
              {VISIBILITY_MODES.map((mode) => {
                const ModeIcon = mode.icon
                const isSelected = newPage.visibilityMode === mode.value
                return (
                  <button
                    key={mode.value}
                    onClick={() =>
                      setNewPage({
                        ...newPage,
                        visibilityMode: mode.value as 'all' | 'pace_ids' | 'user_ids' | 'user_emails',
                      })
                    }
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      isSelected
                        ? getVisibilityColor(mode.value)
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <ModeIcon className="h-3.5 w-3.5" />
                    {mode.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Conditional Inputs */}
          {newPage.visibilityMode === 'pace_ids' && (
            <div>
              <Label className="text-xs font-medium text-gray-500 mb-1.5 block">
                Allowed PACE Customer IDs
              </Label>
              <Input
                placeholder="Comma-separated IDs"
                value={newPage.allowedPaceCustomerIds}
                onChange={(e) => setNewPage({ ...newPage, allowedPaceCustomerIds: e.target.value })}
                className="h-9 font-mono text-sm"
              />
            </div>
          )}

          {newPage.visibilityMode === 'user_ids' && (
            <div>
              <Label className="text-xs font-medium text-gray-500 mb-1.5 block">
                Allowed User IDs
              </Label>
              <Input
                placeholder="Comma-separated IDs"
                value={newPage.allowedUserIds}
                onChange={(e) => setNewPage({ ...newPage, allowedUserIds: e.target.value })}
                className="h-9 font-mono text-sm"
              />
            </div>
          )}

          {newPage.visibilityMode === 'user_emails' && (
            <div>
              <Label className="text-xs font-medium text-gray-500 mb-1.5 block">
                Allowed User Emails
              </Label>
              <Input
                placeholder="Comma-separated emails"
                value={newPage.allowedUserEmails}
                onChange={(e) => setNewPage({ ...newPage, allowedUserEmails: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleCreatePage}
              disabled={creatingPage}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {creatingPage ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Page
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

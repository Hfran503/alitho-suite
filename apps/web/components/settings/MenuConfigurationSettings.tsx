'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { clearMenuCache } from '../DynamicSidebar'

interface MenuConfig {
  id: string
  menuKey: string
  label: string
  href: string
  icon: string | null
  parentKey: string | null
  order: number
  visibleToRoles: string[]
  isActive: boolean
}

const AVAILABLE_ROLES = ['full_admin', 'admin', 'manager', 'customer_service', 'estimators', 'logistics', 'accounting']

const ROLE_LABELS: Record<string, string> = {
  full_admin: 'Full Admin',
  admin: 'Admin',
  manager: 'Manager',
  customer_service: 'Customer Service',
  estimators: 'Estimators',
  logistics: 'Logistics',
  accounting: 'Accounting'
}

const ROLE_COLORS: Record<string, string> = {
  full_admin: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  manager: 'bg-cyan-100 text-cyan-800',
  customer_service: 'bg-green-100 text-green-800',
  estimators: 'bg-yellow-100 text-yellow-800',
  logistics: 'bg-orange-100 text-orange-800',
  accounting: 'bg-pink-100 text-pink-800'
}

interface DetectedPage {
  path: string
  label: string
  suggestedMenuKey: string
  isInMenu: boolean
  depth: number
}

interface DetectedPageSelection extends DetectedPage {
  selected: boolean
  icon: string
  parentKey: string | null
  visibleToRoles: string[]
}

export function MenuConfigurationSettings() {
  const [menuConfigs, setMenuConfigs] = useState<MenuConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>('full_admin')
  const [hasChanges, setHasChanges] = useState(false)
  const [showDetectModal, setShowDetectModal] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detectedPages, setDetectedPages] = useState<DetectedPageSelection[]>([])
  const [addingPages, setAddingPages] = useState(false)

  useEffect(() => {
    fetchMenuConfigs()
  }, [])

  const fetchMenuConfigs = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings/menu-configuration')
      const data = await res.json()
      setMenuConfigs(data.menuConfigs || [])
    } catch (error) {
      console.error('Error fetching menu configs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInitialize = async () => {
    if (!confirm('This will create the default menu structure. Continue?')) {
      return
    }

    try {
      setInitializing(true)
      const res = await fetch('/api/settings/menu-configuration/initialize', {
        method: 'POST'
      })

      if (res.ok) {
        clearMenuCache() // Clear cache so sidebar reloads with initialized config
        await fetchMenuConfigs()
        alert('Menu configuration initialized successfully!')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to initialize menu')
      }
    } catch (error) {
      console.error('Error initializing menu:', error)
      alert('Failed to initialize menu configuration')
    } finally {
      setInitializing(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/settings/menu-configuration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuConfigs })
      })

      if (res.ok) {
        setHasChanges(false)
        clearMenuCache() // Clear cache so sidebar reloads with new config
        alert('Menu configuration saved successfully!')
      } else {
        alert('Failed to save menu configuration')
      }
    } catch (error) {
      console.error('Error saving menu configs:', error)
      alert('Failed to save menu configuration')
    } finally {
      setSaving(false)
    }
  }

  const toggleRole = (menuKey: string, role: string) => {
    setMenuConfigs(prev =>
      prev.map(config => {
        if (config.menuKey === menuKey) {
          const visibleToRoles = config.visibleToRoles.includes(role)
            ? config.visibleToRoles.filter(r => r !== role)
            : [...config.visibleToRoles, role]
          return { ...config, visibleToRoles }
        }
        return config
      })
    )
    setHasChanges(true)
  }

  const toggleActive = (menuKey: string) => {
    setMenuConfigs(prev =>
      prev.map(config =>
        config.menuKey === menuKey
          ? { ...config, isActive: !config.isActive }
          : config
      )
    )
    setHasChanges(true)
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    // Only reorder parent menus (top-level items)
    const parents = menuConfigs.filter(m => !m.parentKey)
    const children = menuConfigs.filter(m => m.parentKey)

    const [reorderedItem] = parents.splice(result.source.index, 1)
    parents.splice(result.destination.index, 0, reorderedItem)

    // Update order values for parents
    const updatedParents = parents.map((item, index) => ({
      ...item,
      order: index
    }))

    // Combine updated parents with unchanged children
    const updatedItems = [...updatedParents, ...children]

    setMenuConfigs(updatedItems)
    setHasChanges(true)
  }

  const handleDelete = async (menuKey: string) => {
    if (!confirm('Are you sure you want to delete this menu item? This action cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/settings/menu-configuration/${menuKey}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        clearMenuCache()
        await fetchMenuConfigs()
        alert('Menu item deleted successfully!')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete menu item')
      }
    } catch (error) {
      console.error('Error deleting menu item:', error)
      alert('Failed to delete menu item')
    }
  }

  const handleDetectPages = async () => {
    try {
      setDetecting(true)
      setShowDetectModal(true)
      const res = await fetch('/api/settings/menu-configuration/detect-pages')
      const data = await res.json()

      // Convert detected pages to selection objects with defaults
      const pagesWithDefaults: DetectedPageSelection[] = (data.newPages || []).map((page: DetectedPage) => ({
        ...page,
        selected: false,
        icon: 'document',
        parentKey: null,
        visibleToRoles: ['full_admin', 'admin']
      }))

      setDetectedPages(pagesWithDefaults)
    } catch (error) {
      console.error('Error detecting pages:', error)
      alert('Failed to detect pages')
    } finally {
      setDetecting(false)
    }
  }

  const handleAddSelectedPages = async () => {
    const selectedPages = detectedPages.filter(p => p.selected)
    if (selectedPages.length === 0) {
      alert('Please select at least one page to add')
      return
    }

    try {
      setAddingPages(true)
      const res = await fetch('/api/settings/menu-configuration/detect-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: selectedPages.map(page => ({
            menuKey: page.suggestedMenuKey,
            label: page.label,
            path: page.path,
            icon: page.icon,
            parentKey: page.parentKey,
            visibleToRoles: page.visibleToRoles
          }))
        })
      })

      if (res.ok) {
        clearMenuCache() // Clear cache so sidebar reloads with new pages
        alert(`Successfully added ${selectedPages.length} page(s) to menu`)
        setShowDetectModal(false)
        setDetectedPages([])
        await fetchMenuConfigs()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to add pages to menu')
      }
    } catch (error) {
      console.error('Error adding pages:', error)
      alert('Failed to add pages to menu')
    } finally {
      setAddingPages(false)
    }
  }

  const togglePageSelection = (index: number) => {
    setDetectedPages(prev =>
      prev.map((page, i) =>
        i === index ? { ...page, selected: !page.selected } : page
      )
    )
  }

  const updatePageRole = (index: number, role: string) => {
    setDetectedPages(prev =>
      prev.map((page, i) => {
        if (i === index) {
          const visibleToRoles = page.visibleToRoles.includes(role)
            ? page.visibleToRoles.filter(r => r !== role)
            : [...page.visibleToRoles, role]
          return { ...page, visibleToRoles }
        }
        return page
      })
    )
  }

  const updatePageIcon = (index: number, icon: string) => {
    setDetectedPages(prev =>
      prev.map((page, i) =>
        i === index ? { ...page, icon } : page
      )
    )
  }

  const updatePageParent = (index: number, parentKey: string | null) => {
    setDetectedPages(prev =>
      prev.map((page, i) =>
        i === index ? { ...page, parentKey } : page
      )
    )
  }

  // Filter menu items based on selected role (for preview)
  const getVisibleMenusForRole = (role: string) => {
    return menuConfigs.filter(
      menu => menu.isActive && menu.visibleToRoles.includes(role) && !menu.parentKey
    )
  }

  // Get parent menus (not submenus)
  const parentMenus = menuConfigs.filter(m => !m.parentKey)
  const getSubmenus = (parentKey: string) =>
    menuConfigs.filter(m => m.parentKey === parentKey)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading menu configuration...</div>
      </div>
    )
  }

  if (menuConfigs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No menu configuration</h3>
          <p className="mt-1 text-sm text-gray-500">
            Initialize the default menu structure to get started.
          </p>
          <div className="mt-6">
            <button
              onClick={handleInitialize}
              disabled={initializing}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {initializing ? 'Initializing...' : 'Initialize Default Menu'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Navigation Menu Configuration</h3>
            <p className="mt-1 text-sm text-gray-500">
              Configure which menu items are visible to each role. Drag to reorder.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDetectPages}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Detect New Pages
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Role Preview Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Preview for Role:</h4>
        <div className="flex gap-2">
          {AVAILABLE_ROLES.map(role => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedRole === role
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <p className="text-xs text-gray-600 mb-2">Visible menu items for {ROLE_LABELS[selectedRole]}:</p>
          <div className="space-y-1">
            {getVisibleMenusForRole(selectedRole).map(menu => (
              <div key={menu.menuKey} className="text-sm text-gray-700">
                • {menu.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Items Configuration */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900">Menu Items</h4>
        </div>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="menu-items">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="divide-y divide-gray-200"
              >
                {parentMenus.map((menu, index) => {
                  const submenus = getSubmenus(menu.menuKey)
                  return (
                    <Draggable
                      key={menu.menuKey}
                      draggableId={menu.menuKey}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="p-6"
                        >
                          <div className="flex items-start gap-4">
                            {/* Drag Handle */}
                            <div {...provided.dragHandleProps} className="mt-1 cursor-move">
                              <svg
                                className="w-5 h-5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 8h16M4 16h16"
                                />
                              </svg>
                            </div>

                            {/* Menu Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <h5 className="text-sm font-medium text-gray-900">
                                  {menu.label}
                                </h5>
                                <span className="text-xs text-gray-500">{menu.href}</span>
                                <div className="flex items-center gap-2 ml-auto">
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={menu.isActive}
                                      onChange={() => toggleActive(menu.menuKey)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-600">Active</span>
                                  </label>
                                  <button
                                    onClick={() => handleDelete(menu.menuKey)}
                                    className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                    title="Delete menu item"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Roles */}
                              <div className="mt-3">
                                <p className="text-xs text-gray-600 mb-2">Visible to:</p>
                                <div className="flex flex-wrap gap-2">
                                  {AVAILABLE_ROLES.map(role => {
                                    const isVisible = menu.visibleToRoles.includes(role)
                                    return (
                                      <button
                                        key={role}
                                        onClick={() => toggleRole(menu.menuKey, role)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                          isVisible
                                            ? ROLE_COLORS[role]
                                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                        }`}
                                      >
                                        {ROLE_LABELS[role]}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* Submenus */}
                              {submenus.length > 0 && (
                                <div className="mt-4 ml-6 space-y-3 border-l-2 border-gray-200 pl-4">
                                  {submenus.map(submenu => (
                                    <div key={submenu.menuKey}>
                                      <div className="flex items-center gap-3">
                                        <h6 className="text-sm text-gray-700">{submenu.label}</h6>
                                        <span className="text-xs text-gray-500">{submenu.href}</span>
                                        <div className="flex items-center gap-2 ml-auto">
                                          <label className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={submenu.isActive}
                                              onChange={() => toggleActive(submenu.menuKey)}
                                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-xs text-gray-600">Active</span>
                                          </label>
                                          <button
                                            onClick={() => handleDelete(submenu.menuKey)}
                                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                            title="Delete submenu item"
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                      <div className="mt-2">
                                        <div className="flex flex-wrap gap-2">
                                          {AVAILABLE_ROLES.map(role => {
                                            const isVisible = submenu.visibleToRoles.includes(role)
                                            return (
                                              <button
                                                key={role}
                                                onClick={() => toggleRole(submenu.menuKey, role)}
                                                className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
                                                  isVisible
                                                    ? ROLE_COLORS[role]
                                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                }`}
                                              >
                                                {ROLE_LABELS[role]}
                                              </button>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  )
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* Detect Pages Modal */}
      {showDetectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Detected Pages</h3>
                <button
                  onClick={() => setShowDetectModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Select pages to add to your navigation menu. Configure roles and icons for each.
              </p>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {detecting ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-500">Scanning for pages...</div>
                </div>
              ) : detectedPages.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No new pages found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    All pages in your app directory are already in the menu.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {detectedPages.map((page, index) => (
                    <div
                      key={page.path}
                      className={`border rounded-lg p-4 ${
                        page.selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      {/* Page Selection Header */}
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={page.selected}
                          onChange={() => togglePageSelection(index)}
                          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="text-sm font-medium text-gray-900">{page.label}</h4>
                            <span className="text-xs text-gray-500">{page.path}</span>
                          </div>

                          {/* Configuration Options (only shown when selected) */}
                          {page.selected && (
                            <div className="mt-3 space-y-3">
                              {/* Icon Input */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Icon
                                </label>
                                <input
                                  type="text"
                                  value={page.icon}
                                  onChange={(e) => updatePageIcon(index, e.target.value)}
                                  placeholder="e.g., document, folder, star"
                                  className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>

                              {/* Parent Menu Dropdown */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Parent Menu (optional)
                                </label>
                                <select
                                  value={page.parentKey || ''}
                                  onChange={(e) => updatePageParent(index, e.target.value || null)}
                                  className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="">None (Top-level item)</option>
                                  {parentMenus.map(menu => (
                                    <option key={menu.menuKey} value={menu.menuKey}>
                                      {menu.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Role Visibility */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">
                                  Visible to Roles
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  {AVAILABLE_ROLES.map(role => {
                                    const isVisible = page.visibleToRoles.includes(role)
                                    return (
                                      <button
                                        key={role}
                                        onClick={() => updatePageRole(index, role)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                          isVisible
                                            ? ROLE_COLORS[role]
                                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                        }`}
                                      >
                                        {ROLE_LABELS[role]}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {detectedPages.filter(p => p.selected).length} of {detectedPages.length} pages selected
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDetectModal(false)}
                  className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSelectedPages}
                  disabled={addingPages || detectedPages.filter(p => p.selected).length === 0}
                  className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingPages ? 'Adding...' : 'Add to Menu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

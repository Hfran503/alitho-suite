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
  visibilityMode: 'role' | 'specific_users' | 'all'
  allowedUserIds: string[]
  allowedUserEmails: string[]
}

interface TenantUser {
  id: string
  email: string
  name: string | null
  memberships: Array<{ role: string }>
}

const AVAILABLE_ROLES = ['full_admin', 'admin', 'manager', 'customer_service', 'estimators', 'logistics', 'accounting', 'warehouse']

const ROLE_LABELS: Record<string, string> = {
  full_admin: 'Full Admin',
  admin: 'Admin',
  manager: 'Manager',
  customer_service: 'Customer Service',
  estimators: 'Estimators',
  logistics: 'Logistics',
  accounting: 'Accounting',
  warehouse: 'Warehouse'
}

const ROLE_COLORS: Record<string, string> = {
  full_admin: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  manager: 'bg-cyan-100 text-cyan-800',
  customer_service: 'bg-green-100 text-green-800',
  estimators: 'bg-yellow-100 text-yellow-800',
  logistics: 'bg-orange-100 text-orange-800',
  accounting: 'bg-pink-100 text-pink-800',
  warehouse: 'bg-amber-100 text-amber-800'
}

const VISIBILITY_MODES = [
  { value: 'role', label: 'By Role', description: 'Visible based on user role' },
  { value: 'all', label: 'All Users', description: 'Visible to all users regardless of role' },
  { value: 'specific_users', label: 'Specific Users', description: 'Only specific selected users' },
]

const VISIBILITY_MODE_COLORS: Record<string, string> = {
  role: 'bg-blue-100 text-blue-800',
  all: 'bg-green-100 text-green-800',
  specific_users: 'bg-purple-100 text-purple-800',
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
  visibilityMode: 'role' | 'specific_users' | 'all'
  allowedUserIds: string[]
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
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creatingMenuItem, setCreatingMenuItem] = useState(false)
  const [newMenuItem, setNewMenuItem] = useState({
    menuKey: '',
    label: '',
    href: '',
    icon: '',
    parentKey: null as string | null,
    visibleToRoles: ['full_admin', 'admin'] as string[],
    visibilityMode: 'role' as 'role' | 'specific_users' | 'all',
    allowedUserIds: [] as string[]
  })
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set())
  const [showRolePreview, setShowRolePreview] = useState(false)
  const [users, setUsers] = useState<TenantUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  const toggleMenuExpanded = (menuKey: string) => {
    setExpandedMenus(prev => {
      const next = new Set(prev)
      if (next.has(menuKey)) {
        next.delete(menuKey)
      } else {
        next.add(menuKey)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedMenus(new Set(parentMenus.map(m => m.menuKey)))
  }

  const collapseAll = () => {
    setExpandedMenus(new Set())
  }

  useEffect(() => {
    fetchMenuConfigs()
    fetchUsers()
  }, [])

  const fetchMenuConfigs = async () => {
    try {
      setLoading(true)
      // Add forConfiguration=true to get ALL menu items for admin configuration
      const res = await fetch('/api/settings/menu-configuration?forConfiguration=true')
      const data = await res.json()

      // Debug: Log fetched parent menu orders
      const fetchedParents = (data.menuConfigs || []).filter((m: MenuConfig) => !m.parentKey).sort((a: MenuConfig, b: MenuConfig) => a.order - b.order)
      console.log('Fetched parent menus with orders:', fetchedParents.map((p: MenuConfig) => ({ label: p.label, order: p.order })))

      setMenuConfigs(data.menuConfigs || [])
    } catch (error) {
      console.error('Error fetching menu configs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true)
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoadingUsers(false)
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

      // Debug: Log parent menu orders
      const parents = menuConfigs.filter(m => !m.parentKey).sort((a, b) => a.order - b.order)
      console.log('Saving parent menus with orders:', parents.map(p => ({ label: p.label, order: p.order })))

      const res = await fetch('/api/settings/menu-configuration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuConfigs })
      })

      if (res.ok) {
        setHasChanges(false)
        clearMenuCache() // Clear cache so sidebar reloads with new config
        await fetchMenuConfigs() // Re-fetch to ensure we have the latest data
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

  const updateVisibilityMode = (
    menuKey: string,
    mode: 'role' | 'specific_users' | 'all'
  ) => {
    setMenuConfigs(prev =>
      prev.map(config =>
        config.menuKey === menuKey ? { ...config, visibilityMode: mode } : config
      )
    )
    setHasChanges(true)
  }

  const toggleMenuUser = (menuKey: string, userId: string) => {
    setMenuConfigs(prev =>
      prev.map(config => {
        if (config.menuKey === menuKey) {
          const allowedUserIds = config.allowedUserIds.includes(userId)
            ? config.allowedUserIds.filter(id => id !== userId)
            : [...config.allowedUserIds, userId]
          return { ...config, allowedUserIds }
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

    const { source, destination, type } = result

    // Handle parent menu reordering
    if (type === 'parent') {
      const parents = menuConfigs.filter(m => !m.parentKey).sort((a, b) => a.order - b.order)
      const children = menuConfigs.filter(m => m.parentKey)

      console.log('Before drag - Parent orders:', parents.map(p => ({ label: p.label, order: p.order })))
      console.log(`Dragging from index ${source.index} to ${destination.index}`)

      const [reorderedItem] = parents.splice(source.index, 1)
      parents.splice(destination.index, 0, reorderedItem)

      // Update order values for parents
      const updatedParents = parents.map((item, index) => ({
        ...item,
        order: index
      }))

      console.log('After drag - Parent orders:', updatedParents.map(p => ({ label: p.label, order: p.order })))

      // Combine updated parents with unchanged children
      const updatedItems = [...updatedParents, ...children]

      setMenuConfigs(updatedItems)
      setHasChanges(true)
    }
    // Handle submenu reordering within the same parent
    else if (type?.startsWith('submenu-')) {
      const parentKey = type.replace('submenu-', '')
      const submenus = menuConfigs.filter(m => m.parentKey === parentKey).sort((a, b) => a.order - b.order)
      const others = menuConfigs.filter(m => m.parentKey !== parentKey)

      console.log(`Before drag - Submenu orders for parent ${parentKey}:`, submenus.map(s => ({ label: s.label, order: s.order })))

      const [reorderedItem] = submenus.splice(source.index, 1)
      submenus.splice(destination.index, 0, reorderedItem)

      // Update order values for submenus
      const updatedSubmenus = submenus.map((item, index) => ({
        ...item,
        order: index
      }))

      console.log(`After drag - Submenu orders for parent ${parentKey}:`, updatedSubmenus.map(s => ({ label: s.label, order: s.order })))

      // Combine with other items
      const updatedItems = [...others, ...updatedSubmenus]

      setMenuConfigs(updatedItems)
      setHasChanges(true)
    }
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
        visibleToRoles: ['full_admin', 'admin'],
        visibilityMode: 'role' as const,
        allowedUserIds: []
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
            visibleToRoles: page.visibleToRoles,
            visibilityMode: page.visibilityMode,
            allowedUserIds: page.allowedUserIds
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

  const updatePageVisibilityMode = (
    index: number,
    mode: 'role' | 'specific_users' | 'all'
  ) => {
    setDetectedPages(prev =>
      prev.map((page, i) =>
        i === index ? { ...page, visibilityMode: mode } : page
      )
    )
  }

  const togglePageUser = (index: number, userId: string) => {
    setDetectedPages(prev =>
      prev.map((page, i) => {
        if (i === index) {
          const allowedUserIds = page.allowedUserIds.includes(userId)
            ? page.allowedUserIds.filter(id => id !== userId)
            : [...page.allowedUserIds, userId]
          return { ...page, allowedUserIds }
        }
        return page
      })
    )
  }

  const toggleNewMenuItemUser = (userId: string) => {
    setNewMenuItem(prev => ({
      ...prev,
      allowedUserIds: prev.allowedUserIds.includes(userId)
        ? prev.allowedUserIds.filter(id => id !== userId)
        : [...prev.allowedUserIds, userId]
    }))
  }

  const handleCreateMenuItem = async () => {
    // Validation
    if (!newMenuItem.label.trim()) {
      alert('Please enter a label')
      return
    }
    if (!newMenuItem.menuKey.trim()) {
      alert('Please enter a menu key')
      return
    }
    if (!newMenuItem.href.trim()) {
      alert('Please enter a href (use # for labels without pages)')
      return
    }
    if (newMenuItem.visibilityMode === 'role' && newMenuItem.visibleToRoles.length === 0) {
      alert('Please select at least one role')
      return
    }
    if (newMenuItem.visibilityMode === 'specific_users' && newMenuItem.allowedUserIds.length === 0) {
      alert('Please select at least one user')
      return
    }

    try {
      setCreatingMenuItem(true)
      const res = await fetch('/api/settings/menu-configuration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuKey: newMenuItem.menuKey,
          label: newMenuItem.label,
          href: newMenuItem.href,
          icon: newMenuItem.icon || null,
          parentKey: newMenuItem.parentKey,
          visibleToRoles: newMenuItem.visibleToRoles,
          visibilityMode: newMenuItem.visibilityMode,
          allowedUserIds: newMenuItem.allowedUserIds,
          order: menuConfigs.filter(m => !m.parentKey).length // Put at end
        })
      })

      if (res.ok) {
        clearMenuCache()
        await fetchMenuConfigs()
        setShowCreateModal(false)
        // Reset form
        setNewMenuItem({
          menuKey: '',
          label: '',
          href: '',
          icon: '',
          parentKey: null,
          visibleToRoles: ['full_admin', 'admin'],
          visibilityMode: 'role',
          allowedUserIds: []
        })
        alert('Menu item created successfully!')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to create menu item')
      }
    } catch (error) {
      console.error('Error creating menu item:', error)
      alert('Failed to create menu item')
    } finally {
      setCreatingMenuItem(false)
    }
  }

  const toggleNewMenuItemRole = (role: string) => {
    setNewMenuItem(prev => ({
      ...prev,
      visibleToRoles: prev.visibleToRoles.includes(role)
        ? prev.visibleToRoles.filter(r => r !== role)
        : [...prev.visibleToRoles, role]
    }))
  }

  // Filter menu items based on selected role (for preview)
  const getVisibleMenusForRole = (role: string) => {
    return menuConfigs.filter(
      menu => menu.isActive && menu.visibleToRoles.includes(role) && !menu.parentKey
    )
  }

  // Get parent menus (not submenus) - sorted by order
  const parentMenus = menuConfigs.filter(m => !m.parentKey).sort((a, b) => a.order - b.order)
  const getSubmenus = (parentKey: string) =>
    menuConfigs.filter(m => m.parentKey === parentKey).sort((a, b) => a.order - b.order)

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
      {/* Modern Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Navigation Menu Configuration
            </h3>
            <p className="mt-2 text-blue-100">
              Control menu visibility with granular permissions. Drag to reorder menus and submenus.
            </p>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-400 text-yellow-900">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Unsaved changes
              </span>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="mt-4 flex items-center justify-between border-t border-blue-500 pt-4">
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-white text-blue-600 rounded-lg shadow-sm text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Menu Item
            </button>
            <button
              onClick={handleDetectPages}
              className="inline-flex items-center px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Detect Pages
            </button>
            <button
              onClick={() => setShowRolePreview(!showRolePreview)}
              className="inline-flex items-center px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {showRolePreview ? 'Hide' : 'Preview'}
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="inline-flex items-center px-6 py-2 bg-white text-blue-600 rounded-lg shadow-lg text-sm font-semibold hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Role Preview Selector - Collapsible */}
      {showRolePreview && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Role Preview
              </h4>
              <button
                onClick={() => setShowRolePreview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {AVAILABLE_ROLES.map(role => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedRole === role
                      ? 'bg-blue-600 text-white shadow-md scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
            <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-900 mb-3">
                Visible to: {ROLE_LABELS[selectedRole]} ({getVisibleMenusForRole(selectedRole).length} items)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {getVisibleMenusForRole(selectedRole).map(menu => (
                  <div key={menu.menuKey} className="flex items-center gap-2 text-sm text-gray-700 bg-white px-3 py-2 rounded-md shadow-sm">
                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-medium">{menu.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu Items Configuration */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h4 className="text-lg font-semibold text-gray-900">Menu Items</h4>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {parentMenus.length} menus
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Collapse All
              </button>
            </div>
          </div>
        </div>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="menu-items" type="parent">
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
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`p-6 ${snapshot.isDragging ? 'bg-blue-50 shadow-lg ring-2 ring-blue-500 rounded-lg' : ''}`}
                        >
                          {/* Collapsible Menu Card Header */}
                          <div className="flex items-start gap-3">
                            {/* Drag Handle */}
                            <div {...provided.dragHandleProps} className="mt-2 cursor-move group">
                              <svg
                                className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors"
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

                            {/* Expand/Collapse Button */}
                            <button
                              onClick={() => toggleMenuExpanded(menu.menuKey)}
                              className="mt-2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <svg
                                className={`w-5 h-5 transform transition-transform ${expandedMenus.has(menu.menuKey) ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>

                            {/* Menu Info */}
                            <div className="flex-1 min-w-0">
                              {/* Header Row */}
                              <div className="flex items-center gap-3 flex-wrap">
                                <h5 className="text-base font-semibold text-gray-900">
                                  {menu.label}
                                </h5>
                                <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">{menu.href}</span>
                                {submenus.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                    {submenus.length} submenu{submenus.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${VISIBILITY_MODE_COLORS[menu.visibilityMode]}`}>
                                  {VISIBILITY_MODES.find(m => m.value === menu.visibilityMode)?.label}
                                </span>
                                {menu.visibilityMode === 'specific_users' && menu.allowedUserIds.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                    {menu.allowedUserIds.length} user{menu.allowedUserIds.length !== 1 ? 's' : ''} selected
                                  </span>
                                )}
                                <div className="flex items-center gap-2 ml-auto">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={menu.isActive}
                                      onChange={() => toggleActive(menu.menuKey)}
                                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className={`text-sm font-medium ${menu.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                      {menu.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </label>
                                  <button
                                    onClick={() => handleDelete(menu.menuKey)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete menu item"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Content */}
                              {expandedMenus.has(menu.menuKey) && (
                                <div className="mt-4 space-y-4 pl-3 border-l-2 border-blue-200">
                              {/* Visibility Mode */}
                              <div>
                                <p className="text-xs text-gray-600 mb-2">Visibility Mode:</p>
                                <div className="flex flex-wrap gap-2">
                                  {VISIBILITY_MODES.map(mode => (
                                    <button
                                      key={mode.value}
                                      onClick={() => updateVisibilityMode(menu.menuKey, mode.value as 'role' | 'specific_users' | 'all')}
                                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                        menu.visibilityMode === mode.value
                                          ? VISIBILITY_MODE_COLORS[mode.value]
                                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                      }`}
                                      title={mode.description}
                                    >
                                      {mode.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Role Selection (only shown when visibility mode is 'role') */}
                              {menu.visibilityMode === 'role' && (
                                <div className="mt-3">
                                  <p className="text-xs text-gray-600 mb-2">Visible to roles:</p>
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
                              )}

                              {/* User Selection (only shown when visibility mode is 'specific_users') */}
                              {menu.visibilityMode === 'specific_users' && (
                                <div className="mt-3">
                                  <label className="block text-xs text-gray-600 mb-2">
                                    Select Users {menu.allowedUserIds.length > 0 && (
                                      <span className="text-purple-600 font-semibold">({menu.allowedUserIds.length} selected)</span>
                                    )}
                                  </label>
                                  {loadingUsers ? (
                                    <div className="text-xs text-gray-500">Loading users...</div>
                                  ) : users.length === 0 ? (
                                    <div className="text-xs text-gray-500">No users found</div>
                                  ) : (
                                    <>
                                      {menu.allowedUserIds.length > 0 && (
                                        <div className="mb-2 p-2 bg-purple-50 border border-purple-200 rounded-md">
                                          <div className="text-xs font-medium text-purple-900 mb-1">Selected Users:</div>
                                          <div className="flex flex-wrap gap-1">
                                            {menu.allowedUserIds.map(userId => {
                                              const user = users.find(u => u.id === userId)
                                              return user ? (
                                                <span key={userId} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">
                                                  {user.name || user.email}
                                                </span>
                                              ) : null
                                            })}
                                          </div>
                                        </div>
                                      )}
                                      <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
                                      {users.map(user => (
                                        <label key={user.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={menu.allowedUserIds.includes(user.id)}
                                            onChange={() => toggleMenuUser(menu.menuKey, user.id)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-900 truncate">
                                              {user.name || user.email}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">{user.email}</div>
                                          </div>
                                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.memberships[0]?.role] || 'bg-gray-100 text-gray-600'}`}>
                                            {ROLE_LABELS[user.memberships[0]?.role] || user.memberships[0]?.role}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Submenus */}
                              {submenus.length > 0 && (
                                <div className="mt-4">
                                  <div className="flex items-center gap-2 mb-2 ml-6">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Submenus ({submenus.length})</span>
                                  </div>
                                  <Droppable droppableId={`submenu-${menu.menuKey}`} type={`submenu-${menu.menuKey}`}>
                                    {(provided) => (
                                      <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="ml-6 space-y-2 border-l-2 border-gray-200 pl-4"
                                      >
                                        {submenus.map((submenu, subIndex) => (
                                          <Draggable
                                            key={submenu.menuKey}
                                            draggableId={submenu.menuKey}
                                            index={subIndex}
                                          >
                                            {(provided, snapshot) => (
                                              <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`bg-gray-50 rounded-md p-3 ${
                                                  snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''
                                                }`}
                                              >
                                                <div className="flex items-start gap-3">
                                                  {/* Drag Handle */}
                                                  <div {...provided.dragHandleProps} className="mt-1 cursor-move">
                                                    <svg
                                                      className="w-4 h-4 text-gray-400 hover:text-gray-600"
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
                                                  <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                      <h6 className="text-sm font-medium text-gray-700">{submenu.label}</h6>
                                                      <span className="text-xs text-gray-500 font-mono">{submenu.href}</span>
                                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${VISIBILITY_MODE_COLORS[submenu.visibilityMode]}`}>
                                                        {VISIBILITY_MODES.find(m => m.value === submenu.visibilityMode)?.label}
                                                      </span>
                                                      {submenu.visibilityMode === 'specific_users' && submenu.allowedUserIds.length > 0 && (
                                                        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                                          {submenu.allowedUserIds.length} user{submenu.allowedUserIds.length !== 1 ? 's' : ''}
                                                        </span>
                                                      )}
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

                                      {/* Submenu Visibility Mode */}
                                      <div className="mt-2">
                                        <p className="text-xs text-gray-600 mb-1">Visibility:</p>
                                        <div className="flex flex-wrap gap-2">
                                          {VISIBILITY_MODES.map(mode => (
                                            <button
                                              key={mode.value}
                                              onClick={() => updateVisibilityMode(submenu.menuKey, mode.value as 'role' | 'specific_users' | 'all')}
                                              className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                                                submenu.visibilityMode === mode.value
                                                  ? VISIBILITY_MODE_COLORS[mode.value]
                                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                              }`}
                                              title={mode.description}
                                            >
                                              {mode.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Submenu Role Selection */}
                                      {submenu.visibilityMode === 'role' && (
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
                                      )}

                                      {/* Submenu User Selection */}
                                      {submenu.visibilityMode === 'specific_users' && (
                                        <div className="mt-2">
                                          {loadingUsers ? (
                                            <div className="text-xs text-gray-500">Loading users...</div>
                                          ) : users.length === 0 ? (
                                            <div className="text-xs text-gray-500">No users found</div>
                                          ) : (
                                            <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
                                              {users.map(user => (
                                                <label key={user.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                                  <input
                                                    type="checkbox"
                                                    checked={submenu.allowedUserIds.includes(user.id)}
                                                    onChange={() => toggleMenuUser(submenu.menuKey, user.id)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                  />
                                                  <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-medium text-gray-900 truncate">
                                                      {user.name || user.email}
                                                    </div>
                                                    <div className="text-xs text-gray-400 truncate">{user.email}</div>
                                                  </div>
                                                </label>
                                              ))}
                                            </div>
                                          )}
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
                                                </div>
                                              )}
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

                              {/* Visibility Mode */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">
                                  Visibility Mode
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  {VISIBILITY_MODES.map(mode => (
                                    <button
                                      key={mode.value}
                                      onClick={() => updatePageVisibilityMode(index, mode.value as 'role' | 'specific_users' | 'all')}
                                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                        page.visibilityMode === mode.value
                                          ? VISIBILITY_MODE_COLORS[mode.value]
                                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                      }`}
                                      title={mode.description}
                                    >
                                      {mode.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Role Visibility (only shown when visibility mode is 'role') */}
                              {page.visibilityMode === 'role' && (
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
                              )}

                              {/* User Selection (only shown when visibility mode is 'specific_users') */}
                              {page.visibilityMode === 'specific_users' && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">
                                    Select Users
                                  </label>
                                  {loadingUsers ? (
                                    <div className="text-xs text-gray-500">Loading users...</div>
                                  ) : users.length === 0 ? (
                                    <div className="text-xs text-gray-500">No users found</div>
                                  ) : (
                                    <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
                                      {users.map(user => (
                                        <label key={user.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={page.allowedUserIds.includes(user.id)}
                                            onChange={() => togglePageUser(index, user.id)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-900 truncate">
                                              {user.name || user.email}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">{user.email}</div>
                                          </div>
                                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.memberships[0]?.role] || 'bg-gray-100 text-gray-600'}`}>
                                            {ROLE_LABELS[user.memberships[0]?.role] || user.memberships[0]?.role}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
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

      {/* Create Menu Item Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Create New Menu Item</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Create a new menu item or menu label. Use "#" as href for labels without pages.
              </p>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newMenuItem.label}
                  onChange={(e) => setNewMenuItem(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g., Test, Reports, Analytics"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">The display name shown in the menu</p>
              </div>

              {/* Menu Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Menu Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newMenuItem.menuKey}
                  onChange={(e) => setNewMenuItem(prev => ({ ...prev, menuKey: e.target.value }))}
                  placeholder="e.g., test-menu, reports, analytics"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Unique identifier (lowercase, use hyphens)</p>
              </div>

              {/* Href */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Href (URL Path) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newMenuItem.href}
                  onChange={(e) => setNewMenuItem(prev => ({ ...prev, href: e.target.value }))}
                  placeholder="e.g., /scheduler, /reports, or # for labels"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Use "#" if this is just a label without a page</p>
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Icon (optional)
                </label>
                <input
                  type="text"
                  value={newMenuItem.icon}
                  onChange={(e) => setNewMenuItem(prev => ({ ...prev, icon: e.target.value }))}
                  placeholder="e.g., clipboard-check, document, package"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Available: home, package, list, plus, search, upload, dollar, briefcase, settings, document, clipboard-check
                </p>
              </div>

              {/* Parent Menu */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Menu (optional)
                </label>
                <select
                  value={newMenuItem.parentKey || ''}
                  onChange={(e) => setNewMenuItem(prev => ({ ...prev, parentKey: e.target.value || null }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">None (Top-level item)</option>
                  {parentMenus.map(menu => (
                    <option key={menu.menuKey} value={menu.menuKey}>
                      {menu.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Select a parent to make this a submenu item</p>
              </div>

              {/* Visibility Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visibility Mode <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {VISIBILITY_MODES.map(mode => (
                    <button
                      key={mode.value}
                      onClick={() => setNewMenuItem(prev => ({
                        ...prev,
                        visibilityMode: mode.value as 'role' | 'specific_users' | 'all'
                      }))}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        newMenuItem.visibilityMode === mode.value
                          ? VISIBILITY_MODE_COLORS[mode.value]
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      title={mode.description}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Role Visibility (only shown when visibility mode is 'role') */}
              {newMenuItem.visibilityMode === 'role' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Visible to Roles <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_ROLES.map(role => {
                      const isVisible = newMenuItem.visibleToRoles.includes(role)
                      return (
                        <button
                          key={role}
                          onClick={() => toggleNewMenuItemRole(role)}
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
                  <p className="mt-1 text-xs text-gray-500">Select at least one role</p>
                </div>
              )}

              {/* User Selection (only shown when visibility mode is 'specific_users') */}
              {newMenuItem.visibilityMode === 'specific_users' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Users <span className="text-red-500">*</span>
                  </label>
                  {loadingUsers ? (
                    <div className="text-sm text-gray-500">Loading users...</div>
                  ) : users.length === 0 ? (
                    <div className="text-sm text-gray-500">No users found</div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
                      {users.map(user => (
                        <label key={user.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newMenuItem.allowedUserIds.includes(user.id)}
                            onChange={() => toggleNewMenuItemUser(user.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {user.name || user.email}
                            </div>
                            <div className="text-xs text-gray-500 truncate">{user.email}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.memberships[0]?.role] || 'bg-gray-100 text-gray-600'}`}>
                            {ROLE_LABELS[user.memberships[0]?.role] || user.memberships[0]?.role}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-500">Select at least one user</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMenuItem}
                disabled={creatingMenuItem}
                className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingMenuItem ? 'Creating...' : 'Create Menu Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

interface MenuItem {
  menuKey: string
  label: string
  href: string
  icon: string | null
  parentKey: string | null
  order: number
  visibleToRoles: string[]
  isActive: boolean
  visibilityMode?: 'role' | 'all' | 'specific_users'
  submenu?: MenuItem[]
}

interface DynamicSidebarProps {
  onPinChange?: (isPinned: boolean) => void
}

// Default menu structure (used when no configuration exists)
function getDefaultMenu(): MenuItem[] {
  return [
    {
      menuKey: 'dashboard',
      label: 'Dashboard',
      href: '/dashboard',
      icon: 'home',
      parentKey: null,
      order: 0,
      visibleToRoles: ['full_admin', 'admin', 'customer_service', 'estimator', 'logistics', 'accounting', 'warehouse', 'marketing'],
      isActive: true
    },
    {
      menuKey: 'shipments',
      label: 'Shipments',
      href: '/shipments',
      icon: 'package',
      parentKey: null,
      order: 1,
      visibleToRoles: ['full_admin', 'admin', 'customer_service', 'logistics'],
      isActive: true,
      submenu: [
        {
          menuKey: 'shipments-all',
          label: 'All Shipments',
          href: '/shipments',
          icon: 'list',
          parentKey: 'shipments',
          order: 0,
          visibleToRoles: ['full_admin', 'admin', 'customer_service', 'logistics'],
          isActive: true
        },
        {
          menuKey: 'shipments-manual-label',
          label: 'Manual Label',
          href: '/shipments/manual-label',
          icon: 'plus',
          parentKey: 'shipments',
          order: 1,
          visibleToRoles: ['full_admin', 'admin', 'customer_service'],
          isActive: true
        },
        {
          menuKey: 'shipments-track',
          label: 'Track Labels',
          href: '/shipment-track',
          icon: 'search',
          parentKey: 'shipments',
          order: 2,
          visibleToRoles: ['full_admin', 'admin', 'customer_service', 'logistics'],
          isActive: true
        }
      ]
    },
    {
      menuKey: 'batch-import',
      label: 'Batch Import',
      href: '/batch-import',
      icon: 'upload',
      parentKey: null,
      order: 2,
      visibleToRoles: ['full_admin', 'admin'],
      isActive: true,
      submenu: [
        {
          menuKey: 'batch-import-new',
          label: 'New Import',
          href: '/batch-import',
          icon: 'plus',
          parentKey: 'batch-import',
          order: 0,
          visibleToRoles: ['full_admin', 'admin'],
          isActive: true
        },
        {
          menuKey: 'batch-import-track',
          label: 'Track Batches',
          href: '/batch-import/batches',
          icon: 'search',
          parentKey: 'batch-import',
          order: 1,
          visibleToRoles: ['full_admin', 'admin'],
          isActive: true
        }
      ]
    },
    {
      menuKey: 'open-jobs',
      label: 'Open Jobs',
      href: '/open-jobs',
      icon: 'briefcase',
      parentKey: null,
      order: 3,
      visibleToRoles: ['full_admin', 'admin', 'customer_service', 'estimators'],
      isActive: true
    },
    {
      menuKey: 'cost-vs-estimate',
      label: 'Cost vs. Estimate',
      href: '/cost-vs-estimate',
      icon: 'clipboard-check',
      parentKey: null,
      order: 3.5,
      visibleToRoles: ['full_admin', 'admin', 'accounting'],
      isActive: true
    },
    {
      menuKey: 'rate-estimates',
      label: 'Rate Estimates',
      href: '/rates/estimate',
      icon: 'dollar',
      parentKey: null,
      order: 4,
      visibleToRoles: ['full_admin', 'admin', 'estimators'],
      isActive: true
    },
    {
      menuKey: 'warehouse',
      label: 'Warehouse',
      href: '/warehouse',
      icon: 'warehouse',
      parentKey: null,
      order: 5,
      visibleToRoles: ['full_admin', 'admin', 'logistics', 'warehouse'],
      isActive: true,
      submenu: [
        {
          menuKey: 'warehouse-overview',
          label: 'Overview',
          href: '/warehouse',
          icon: 'home',
          parentKey: 'warehouse',
          order: 0,
          visibleToRoles: ['full_admin', 'admin', 'logistics', 'warehouse'],
          isActive: true
        },
        {
          menuKey: 'warehouse-locations',
          label: 'Locations',
          href: '/warehouse/locations',
          icon: 'location-marker',
          parentKey: 'warehouse',
          order: 1,
          visibleToRoles: ['full_admin', 'admin', 'warehouse'],
          isActive: true
        },
        {
          menuKey: 'warehouse-inventory',
          label: 'Inventory',
          href: '/warehouse/inventory',
          icon: 'cube',
          parentKey: 'warehouse',
          order: 2,
          visibleToRoles: ['full_admin', 'admin', 'logistics', 'warehouse'],
          isActive: true
        },
        {
          menuKey: 'warehouse-asn',
          label: 'ASN',
          href: '/warehouse/asn',
          icon: 'clipboard-list',
          parentKey: 'warehouse',
          order: 3,
          visibleToRoles: ['full_admin', 'admin', 'logistics', 'warehouse'],
          isActive: true
        },
        {
          menuKey: 'warehouse-receiving',
          label: 'Receiving',
          href: '/warehouse/receiving',
          icon: 'inbox-in',
          parentKey: 'warehouse',
          order: 4,
          visibleToRoles: ['full_admin', 'admin', 'warehouse'],
          isActive: true
        },
        {
          menuKey: 'warehouse-fulfillment',
          label: 'Fulfillment',
          href: '/warehouse/fulfillment',
          icon: 'truck',
          parentKey: 'warehouse',
          order: 5,
          visibleToRoles: ['full_admin', 'admin', 'logistics', 'warehouse'],
          isActive: true
        }
      ]
    },
    {
      menuKey: 'crm',
      label: 'CRM',
      href: '/crm',
      icon: 'users',
      parentKey: null,
      order: 6,
      visibleToRoles: ['full_admin', 'admin', 'customer_service'],
      isActive: true
    },
    {
      menuKey: 'settings',
      label: 'Settings',
      href: '/settings',
      icon: 'settings',
      parentKey: null,
      order: 7,
      visibleToRoles: ['full_admin', 'admin'],
      isActive: true
    }
  ]
}

// Icon mapping - maps icon identifiers to SVG components
const IconMap: Record<string, React.ReactNode> = {
  home: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  package: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  ),
  list: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  plus: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  upload: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  dollar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  briefcase: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  'clipboard-check': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  warehouse: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  'cube': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  'inbox-in': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
    </svg>
  ),
  'clipboard-list': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  'truck': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  'location-marker': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  'users': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
}

// Cache for menu data to avoid refetching on every navigation
let menuCache: { items: MenuItem[]; role: string; timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const LOCALSTORAGE_KEY = 'sidebar_menu_cache'

// Helper functions for localStorage cache
function loadFromLocalStorage(): { items: MenuItem[]; role: string; timestamp: number } | null {
  try {
    const cached = localStorage.getItem(LOCALSTORAGE_KEY)
    if (!cached) return null
    return JSON.parse(cached)
  } catch {
    return null
  }
}

function saveToLocalStorage(data: { items: MenuItem[]; role: string; timestamp: number }) {
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to save menu cache to localStorage:', error)
  }
}

// Function to clear menu cache (call this when menu settings are updated)
export function clearMenuCache() {
  menuCache = null
  try {
    localStorage.removeItem(LOCALSTORAGE_KEY)
    // Also clear expanded menus state when menu configuration changes
    localStorage.removeItem('sidebarExpandedMenus')
  } catch {
    // Ignore localStorage errors
  }
}

export function DynamicSidebar({ onPinChange }: DynamicSidebarProps = {}) {
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])
  const [isFullyExpanded, setIsFullyExpanded] = useState(false)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [userRole, setUserRole] = useState<string>('customer_service')
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const { data: session } = useSession()
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load pin state from localStorage on mount
  useEffect(() => {
    const savedPinState = localStorage.getItem('sidebarPinned')
    if (savedPinState !== null) {
      const pinState = savedPinState === 'true'
      setIsPinned(pinState)
      if (onPinChange) {
        onPinChange(pinState)
      }
    }
  }, [onPinChange])

  // Load and validate expanded menus when menuItems are loaded
  useEffect(() => {
    if (menuItems.length === 0) return

    const savedExpandedMenus = localStorage.getItem('sidebarExpandedMenus')
    if (savedExpandedMenus !== null) {
      try {
        const expandedMenusArray = JSON.parse(savedExpandedMenus)
        if (Array.isArray(expandedMenusArray)) {
          // Validate that the saved menu keys still exist in current menu configuration
          const validMenuKeys = new Set(menuItems.map(item => item.menuKey))
          const validExpandedMenus = expandedMenusArray.filter(key => validMenuKeys.has(key))

          // If some keys were filtered out, update localStorage
          if (validExpandedMenus.length !== expandedMenusArray.length) {
            localStorage.setItem('sidebarExpandedMenus', JSON.stringify(validExpandedMenus))
          }

          setExpandedMenus(validExpandedMenus)
        }
      } catch (error) {
        console.error('Failed to parse expanded menus from localStorage:', error)
        localStorage.removeItem('sidebarExpandedMenus')
      }
    }
  }, [menuItems])

  // Fetch menu configuration and user role with multi-layer caching
  useEffect(() => {
    async function fetchMenuConfig(backgroundRefresh = false) {
      try {
        if (!backgroundRefresh) {
          setLoading(true)
        }

        const now = Date.now()

        // Layer 1: Check in-memory cache
        if (menuCache && (now - menuCache.timestamp) < CACHE_DURATION) {
          setMenuItems(menuCache.items)
          setUserRole(menuCache.role)
          setLoading(false)
          return
        }

        // Layer 2: Check localStorage cache
        const localCache = loadFromLocalStorage()
        if (localCache && (now - localCache.timestamp) < CACHE_DURATION) {
          // Use localStorage cache immediately for instant render
          setMenuItems(localCache.items)
          setUserRole(localCache.role)
          menuCache = localCache // Update memory cache
          setLoading(false)

          // Optionally refresh in background if cache is older than 1 minute
          if ((now - localCache.timestamp) > 60 * 1000) {
            fetchMenuConfig(true) // Background refresh
          }
          return
        }

        // Layer 3: Fetch from API
        const [userRes, menuRes] = await Promise.all([
          fetch('/api/user/settings'),
          fetch('/api/settings/menu-configuration')
        ])

        let role = 'customer_service'
        let items: MenuItem[] = []

        // Process user role
        if (userRes.ok) {
          const userData = await userRes.json()
          role = userData.role || 'customer_service'
          setUserRole(role)
        }

        // Process menu configuration
        if (menuRes.ok) {
          const data = await menuRes.json()
          const configs = data.menuConfigs || []

          // If no menu configuration exists, use default menu for all users
          if (configs.length === 0) {
            items = getDefaultMenu()
            setMenuItems(items)
          } else {
            // Organize menu items into parent-child structure
            const parents = configs
              .filter((item: any) => !item.parentKey && item.isActive)
              .sort((a: any, b: any) => a.order - b.order)

            const organized = parents.map((parent: any) => ({
              ...parent,
              submenu: configs
                .filter((item: any) => item.parentKey === parent.menuKey && item.isActive)
                .sort((a: any, b: any) => a.order - b.order)
            }))

            items = organized
            setMenuItems(organized)
          }
        }

        // Update both caches
        const cacheData = {
          items,
          role,
          timestamp: Date.now()
        }
        menuCache = cacheData
        saveToLocalStorage(cacheData)
      } catch (error) {
        console.error('Error fetching menu config:', error)
        // On error, use default menu as fallback
        const defaultMenu = getDefaultMenu()
        setMenuItems(defaultMenu)
      } finally {
        if (!backgroundRefresh) {
          setLoading(false)
        }
      }
    }

    if (session) {
      fetchMenuConfig()
    }
  }, [session])

  const isExpanded = isPinned || isHovered

  // Delay showing submenus until sidebar expansion animation completes
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => {
        setIsFullyExpanded(true)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setIsFullyExpanded(false)
    }
  }, [isExpanded])

  const handlePinToggle = () => {
    const newPinState = !isPinned
    setIsPinned(newPinState)
    localStorage.setItem('sidebarPinned', String(newPinState))
    if (onPinChange) {
      onPinChange(newPinState)
    }
  }

  const toggleSubmenu = (menuKey: string) => {
    setExpandedMenus(prev => {
      const newExpandedMenus = prev.includes(menuKey)
        ? prev.filter(h => h !== menuKey) // Close this submenu
        : [menuKey] // Close all others and open only this one

      // Persist to localStorage
      localStorage.setItem('sidebarExpandedMenus', JSON.stringify(newExpandedMenus))

      return newExpandedMenus
    })
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      await signOut({
        redirect: true,
        callbackUrl: '/auth/signin'
      })
    } catch (error) {
      console.error('Logout error:', error)
      await signOut({
        redirect: true,
        callbackUrl: '/auth/signin'
      })
    }
  }

  // Filter menu items based on visibility mode
  // Note: The API already filters based on visibility mode, so items returned from API
  // should already be visible to the user. We only apply role filter for 'role' mode
  // or when visibilityMode is not set (backward compatibility with default menu)
  const visibleMenuItems = menuItems.filter(item => {
    // If visibility mode is 'all' or 'specific_users', the API already approved this item
    if (item.visibilityMode === 'all' || item.visibilityMode === 'specific_users') {
      return true
    }
    // For role-based visibility (default), filter by role
    return item.visibleToRoles.includes(userRole)
  })

  const getIcon = (iconKey: string | null) => {
    if (!iconKey) return null
    return IconMap[iconKey] || null
  }

  if (loading) {
    return (
      <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] bg-gray-900 text-white w-16 z-40">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </aside>
    )
  }

  const handleMouseEnter = () => {
    if (!isPinned) {
      // Delay to ensure intentional hover, not just passing by
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(true)
      }, 150) // 150ms delay - fast but prevents accidental triggers
    }
  }

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setIsHovered(false)
  }

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-gray-900 text-white transition-all duration-300 ease-in-out z-40 overflow-hidden ${
        isExpanded ? 'w-64' : 'w-16'
      }`}
    >
      <nav className="h-full flex flex-col py-4">
        {/* Navigation Items */}
        <ul className="flex-1 space-y-1 px-2">
          {visibleMenuItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            const hasSubmenu = item.submenu && item.submenu.length > 0
            const isSubmenuExpanded = expandedMenus.includes(item.menuKey)
            const visibleSubmenu = hasSubmenu
              ? item.submenu!.filter(sub => {
                  if (sub.visibilityMode === 'all' || sub.visibilityMode === 'specific_users') {
                    return true
                  }
                  return sub.visibleToRoles.includes(userRole)
                })
              : []

            return (
              <li key={item.menuKey}>
                {hasSubmenu && visibleSubmenu.length > 0 ? (
                  <>
                    <button
                      onClick={() => toggleSubmenu(item.menuKey)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors w-full ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : `text-gray-300 ${isExpanded ? 'hover:bg-gray-800 hover:text-white' : ''}`
                      }`}
                    >
                      <span className="flex-shrink-0">{getIcon(item.icon)}</span>
                      <span
                        className={`whitespace-nowrap transition-opacity duration-300 flex-1 text-left ${
                          isExpanded ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        {item.label}
                      </span>
                      {isExpanded && (
                        <svg
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isSubmenuExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                    {isFullyExpanded && isSubmenuExpanded && visibleSubmenu.length > 0 && (
                      <ul className="mt-1 space-y-1 ml-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        {visibleSubmenu.map((subitem) => {
                          const isSubActive = pathname === subitem.href
                          return (
                            <li key={subitem.menuKey}>
                              <Link
                                href={subitem.href}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                                  isSubActive
                                    ? 'bg-blue-500 text-white'
                                    : `text-gray-400 ${isExpanded ? 'hover:bg-gray-800 hover:text-white' : ''}`
                                }`}
                              >
                                <span className="flex-shrink-0">{getIcon(subitem.icon)}</span>
                                <span className="whitespace-nowrap">{subitem.label}</span>
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : `text-gray-300 ${isExpanded ? 'hover:bg-gray-800 hover:text-white' : ''}`
                    }`}
                  >
                    <span className="flex-shrink-0">{getIcon(item.icon)}</span>
                    <span
                      className={`whitespace-nowrap transition-opacity duration-300 ${
                        isExpanded ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                )}
              </li>
            )
          })}
        </ul>

        {/* Pin Button and Logout - At Bottom */}
        <div className="px-2 mt-4 border-t border-gray-800 pt-4 space-y-2">
          <button
            onClick={handlePinToggle}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full ${
              isPinned
                ? 'bg-blue-600 text-white'
                : `text-gray-400 ${isExpanded ? 'hover:bg-gray-800 hover:text-white' : ''}`
            }`}
            title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
          >
            <svg
              className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${isPinned ? 'rotate-45' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 12h14M12 5l7 7-7 7"
                transform="rotate(-45 12 12)"
              />
            </svg>
            <span
              className={`whitespace-nowrap transition-opacity duration-300 text-sm ${
                isExpanded ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {isPinned ? 'Unpin' : 'Pin'}
            </span>
          </button>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-gray-400 ${isExpanded ? 'hover:bg-red-900 hover:text-white' : ''}`}
            title="Logout"
          >
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span
              className={`whitespace-nowrap transition-opacity duration-300 text-sm ${
                isExpanded ? 'opacity-100' : 'opacity-0'
              }`}
            >
              Logout
            </span>
          </button>
        </div>
      </nav>
    </aside>
  )
}

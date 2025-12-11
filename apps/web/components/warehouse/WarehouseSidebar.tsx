'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

interface MenuItem {
  key: string
  label: string
  href: string
  icon: React.ReactNode
  badge?: number
}

interface WarehouseSidebarProps {
  onPinChange?: (isPinned: boolean) => void
}

export function WarehouseSidebar({ onPinChange }: WarehouseSidebarProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(true) // Default pinned for warehouse
  const pathname = usePathname()
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load pin state from localStorage on mount
  useEffect(() => {
    const savedPinState = localStorage.getItem('warehouseSidebarPinned')
    if (savedPinState !== null) {
      const pinState = savedPinState === 'true'
      setIsPinned(pinState)
      if (onPinChange) {
        onPinChange(pinState)
      }
    } else {
      // Default to pinned for warehouse
      if (onPinChange) {
        onPinChange(true)
      }
    }
  }, [onPinChange])

  const isExpanded = isPinned || isHovered

  const handlePinToggle = () => {
    const newPinState = !isPinned
    setIsPinned(newPinState)
    localStorage.setItem('warehouseSidebarPinned', String(newPinState))
    if (onPinChange) {
      onPinChange(newPinState)
    }
  }

  const handleMouseEnter = () => {
    if (!isPinned) {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(true)
      }, 150)
    }
  }

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setIsHovered(false)
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      await signOut({ redirect: true, callbackUrl: '/auth/signin' })
    } catch (error) {
      console.error('Logout error:', error)
      await signOut({ redirect: true, callbackUrl: '/auth/signin' })
    }
  }

  const menuItems: MenuItem[] = [
    {
      key: 'overview',
      label: 'Overview',
      href: '/warehouse',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      ),
    },
    {
      key: 'warehouses',
      label: 'Warehouses',
      href: '/warehouse/warehouses',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      key: 'locations',
      label: 'Locations',
      href: '/warehouse/locations',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      key: 'items',
      label: 'Item Master',
      href: '/warehouse/items',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
    },
    {
      key: 'inventory',
      label: 'Inventory',
      href: '/warehouse/inventory',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      key: 'asn',
      label: 'ASN',
      href: '/warehouse/asn',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      key: 'receiving',
      label: 'Receiving',
      href: '/warehouse/receiving',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
        </svg>
      ),
    },
    {
      key: 'fulfillment',
      label: 'Fulfillment',
      href: '/warehouse/fulfillment',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
  ]

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`fixed left-0 top-0 h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 text-white transition-all duration-300 ease-in-out z-50 overflow-hidden shadow-xl ${
        isExpanded ? 'w-64' : 'w-16'
      }`}
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className={`transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
              <h1 className="font-bold text-lg text-white whitespace-nowrap">Warehouse</h1>
              <p className="text-xs text-emerald-300 whitespace-nowrap">Management System</p>
            </div>
          </div>
        </div>

        {/* Back to Suite Link */}
        <div className="px-2 py-3 border-b border-emerald-800">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-emerald-300 hover:bg-emerald-800 hover:text-white transition-colors group"
          >
            <svg className="w-5 h-5 flex-shrink-0 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            <span className={`whitespace-nowrap text-sm transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
              Back to Suite
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {menuItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/warehouse' && pathname?.startsWith(item.href))

              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-emerald-700 text-white shadow-md'
                        : 'text-emerald-200 hover:bg-emerald-800 hover:text-white'
                    }`}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span className={`whitespace-nowrap transition-opacity duration-300 flex-1 ${
                      isExpanded ? 'opacity-100' : 'opacity-0'
                    }`}>
                      {item.label}
                    </span>
                    {item.badge !== undefined && item.badge > 0 && isExpanded && (
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-emerald-800 space-y-1">
          <button
            onClick={handlePinToggle}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full ${
              isPinned
                ? 'bg-emerald-700 text-white'
                : 'text-emerald-300 hover:bg-emerald-800 hover:text-white'
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
            <span className={`whitespace-nowrap text-sm transition-opacity duration-300 ${
              isExpanded ? 'opacity-100' : 'opacity-0'
            }`}>
              {isPinned ? 'Unpin' : 'Pin'}
            </span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-emerald-300 hover:bg-red-900 hover:text-white"
            title="Logout"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className={`whitespace-nowrap text-sm transition-opacity duration-300 ${
              isExpanded ? 'opacity-100' : 'opacity-0'
            }`}>
              Logout
            </span>
          </button>
        </div>
      </div>
    </aside>
  )
}

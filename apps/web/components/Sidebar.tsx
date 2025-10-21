'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

interface NavItem {
  name: string
  href: string
  icon: React.ReactNode
  submenu?: NavItem[]
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  // TODO: Uncomment when Orders page is implemented
  // {
  //   name: 'Orders',
  //   href: '/dashboard/orders',
  //   icon: (
  //     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  //       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  //     </svg>
  //   ),
  // },
  {
    name: 'Shipments',
    href: '/shipments',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
  {
    name: 'Batch Import',
    href: '/batch-import',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    submenu: [
      {
        name: 'New Import',
        href: '/batch-import',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        ),
      },
      {
        name: 'Track Batches',
        href: '/batch-import/batches',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        ),
      },
    ],
  },
  {
    name: 'Shipment Track',
    href: '/shipment-track',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    name: 'Rate Estimates',
    href: '/rates/estimate',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  // TODO: Uncomment when Customers page is implemented
  // {
  //   name: 'Customers',
  //   href: '/dashboard/customers',
  //   icon: (
  //     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  //       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  //     </svg>
  //   ),
  // },
  // TODO: Uncomment when Products page is implemented
  // {
  //   name: 'Products',
  //   href: '/dashboard/products',
  //   icon: (
  //     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  //       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  //     </svg>
  //   ),
  // },
  {
    name: 'Settings',
    href: '/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

interface SidebarProps {
  onPinChange?: (isPinned: boolean) => void
}

export function Sidebar({ onPinChange }: SidebarProps = {}) {
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])
  const [isFullyExpanded, setIsFullyExpanded] = useState(false)
  const pathname = usePathname()

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

  const isExpanded = isPinned || isHovered

  // Delay showing submenus until sidebar expansion animation completes
  useEffect(() => {
    if (isExpanded) {
      // Wait for the 300ms transition to complete
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
    // Save to localStorage
    localStorage.setItem('sidebarPinned', String(newPinState))
    if (onPinChange) {
      onPinChange(newPinState)
    }
  }

  const toggleSubmenu = (href: string) => {
    setExpandedMenus(prev =>
      prev.includes(href)
        ? prev.filter(h => h !== href)
        : [...prev, href]
    )
  }

  const handleLogout = async () => {
    try {
      // Call logout API to clear server-side session
      await fetch('/api/auth/logout', { method: 'POST' })

      // Sign out using NextAuth
      await signOut({
        redirect: true,
        callbackUrl: '/auth/signin'
      })
    } catch (error) {
      console.error('Logout error:', error)
      // Still try to sign out even if API call fails
      await signOut({
        redirect: true,
        callbackUrl: '/auth/signin'
      })
    }
  }

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-gray-900 text-white transition-all duration-300 ease-in-out z-40 ${
        isExpanded ? 'w-64' : 'w-16'
      }`}
    >
      <nav className="h-full flex flex-col py-4">
        {/* Navigation Items */}
        <ul className="flex-1 space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            const hasSubmenu = item.submenu && item.submenu.length > 0
            const isSubmenuExpanded = expandedMenus.includes(item.href)

            return (
              <li key={item.href}>
                {hasSubmenu ? (
                  <>
                    <button
                      onClick={() => toggleSubmenu(item.href)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors w-full ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span
                        className={`whitespace-nowrap transition-opacity duration-300 flex-1 text-left ${
                          isExpanded ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        {item.name}
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
                    {isFullyExpanded && isSubmenuExpanded && item.submenu && (
                      <ul className="mt-1 space-y-1 ml-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        {item.submenu.map((subitem) => {
                          const isSubActive = pathname === subitem.href
                          return (
                            <li key={subitem.href}>
                              <Link
                                href={subitem.href}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                                  isSubActive
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                }`}
                              >
                                <span className="flex-shrink-0">{subitem.icon}</span>
                                <span className="whitespace-nowrap">{subitem.name}</span>
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
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span
                      className={`whitespace-nowrap transition-opacity duration-300 ${
                        isExpanded ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      {item.name}
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
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
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
            className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-gray-400 hover:bg-red-900 hover:text-white"
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

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
    submenu: [
      {
        name: 'All Shipments',
        href: '/shipments',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        ),
      },
      {
        name: 'By Date',
        href: '/shipments-by-date',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
    ],
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
  const pathname = usePathname()

  const isExpanded = isPinned || isHovered

  const handlePinToggle = () => {
    const newPinState = !isPinned
    setIsPinned(newPinState)
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
                    {isExpanded && isSubmenuExpanded && item.submenu && (
                      <ul className="mt-1 space-y-1 ml-4">
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

        {/* Pin Button - At Bottom */}
        <div className="px-2 mt-4 border-t border-gray-800 pt-4">
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
        </div>
      </nav>
    </aside>
  )
}

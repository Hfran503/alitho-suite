'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Truck, Home, Package, FileText, LucideIcon } from 'lucide-react'

interface PortalPage {
  pageKey: string
  label: string
  href: string
  icon: string | null
  order: number
}

// Map icon names to Lucide icon components
const iconMap: Record<string, LucideIcon> = {
  home: Home,
  truck: Truck,
  package: Package,
  document: FileText,
}

// Fallback navigation in case API fails
const fallbackNavigation = [
  {
    name: 'Welcome',
    href: '/portal',
    icon: Home,
  },
  {
    name: 'Shipments',
    href: '/portal/shipments',
    icon: Truck,
  },
]

export function PortalSidebar() {
  const pathname = usePathname()
  const [navigation, setNavigation] = useState(fallbackNavigation)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPortalPages() {
      try {
        const res = await fetch('/api/portal/pages-configuration', {
          cache: 'no-store',
        })

        if (res.ok) {
          const data = await res.json()
          const pages = data.pageConfigs || []

          // Transform API data to navigation format
          const navItems = pages.map((page: PortalPage) => ({
            name: page.label,
            href: page.href,
            icon: page.icon ? iconMap[page.icon] || Home : Home,
          }))

          setNavigation(navItems.length > 0 ? navItems : fallbackNavigation)
        }
      } catch (error) {
        console.error('Error fetching portal pages:', error)
        // Keep fallback navigation on error
      } finally {
        setLoading(false)
      }
    }

    fetchPortalPages()
  }, [])

  return (
    <aside className="w-64 bg-white border-r min-h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto">
      <nav className="p-4 space-y-1">
        {loading ? (
          // Loading skeleton
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          navigation.map((item) => {
            // For the Welcome page, only match exact path
            const isActive =
              item.href === '/portal'
                ? pathname === '/portal'
                : pathname === item.href || pathname?.startsWith(item.href + '/')
            const Icon = item.icon

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })
        )}
      </nav>
    </aside>
  )
}

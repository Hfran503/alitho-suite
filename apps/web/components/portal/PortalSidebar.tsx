'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Truck, Home } from 'lucide-react'

const navigation = [
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

  return (
    <aside className="w-64 bg-white border-r min-h-[calc(100vh-4rem)] sticky top-16">
      <nav className="p-4 space-y-1">
        {navigation.map((item) => {
          // For the Welcome page, only match exact path
          const isActive = item.href === '/portal'
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
        })}
      </nav>
    </aside>
  )
}

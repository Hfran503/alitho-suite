'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Package, Truck, Home, FileText, PlusCircle, ShoppingCart, LucideIcon, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface PortalPage {
  pageKey: string
  label: string
  href: string
  icon: string | null
  description: string | null
  order: number
}

// Map icon names to Lucide icon components
const iconMap: Record<string, LucideIcon> = {
  home: Home,
  truck: Truck,
  package: Package,
  document: FileText,
  plus: PlusCircle,
  cart: ShoppingCart,
}

// Default descriptions for common pages
const defaultDescriptions: Record<string, string> = {
  'portal-shipments': 'View and track your shipments. Access detailed information about your orders organized by item and job.',
  'portal-orders': 'View your order history and check the status of your current orders.',
  'portal-orders-new': 'Place a new order from your available inventory items.',
}

export default function PortalWelcomePage() {
  const { data: session, status } = useSession()
  const [pages, setPages] = useState<PortalPage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/auth/portal-signin')
    }
  }, [status])

  useEffect(() => {
    async function fetchPages() {
      try {
        const res = await fetch('/api/portal/pages-configuration', {
          cache: 'no-store',
        })
        if (res.ok) {
          const data = await res.json()
          // Filter out the welcome page itself
          const filteredPages = (data.pageConfigs || []).filter(
            (p: PortalPage) => p.pageKey !== 'portal-welcome' && p.href !== '/portal'
          )
          setPages(filteredPages)
        }
      } catch (error) {
        console.error('Error fetching portal pages:', error)
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated') {
      fetchPages()
    }
  }, [status])

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome{session?.user?.name ? `, ${session.user.name}` : ''}!
        </h1>
        <p className="text-gray-600 text-lg">
          Access your portal to manage orders, track shipments, and more.
        </p>
      </div>

      {/* Dynamic Quick Links */}
      {pages.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pages.map((page) => {
            const Icon = page.icon ? iconMap[page.icon] || Package : Package
            const description = page.description || defaultDescriptions[page.pageKey] || `Access ${page.label}`

            return (
              <Link
                key={page.pageKey}
                href={page.href}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4 mb-3">
                  <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {page.label}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {description}
                </p>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-200 p-8 text-center">
          <div className="p-4 bg-white rounded-xl shadow-sm inline-block mb-4">
            <Package className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Need Help?
          </h3>
          <p className="text-gray-700 max-w-md mx-auto">
            If you have any questions or need assistance, please contact your account representative.
          </p>
        </div>
      )}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment } from 'react'

export function Breadcrumbs() {
  const pathname = usePathname()

  // Generate breadcrumb segments from pathname
  const segments = pathname?.split('/').filter(Boolean) || []

  // Map for better display names
  const displayNames: Record<string, string> = {
    dashboard: 'Dashboard',
    orders: 'Orders',
    customers: 'Customers',
    products: 'Products',
    settings: 'Settings',
    new: 'New',
    edit: 'Edit',
  }

  // Build breadcrumb items
  const breadcrumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    const isLast = index === segments.length - 1
    const name = displayNames[segment] || segment

    return {
      name,
      href,
      isLast,
    }
  })

  if (breadcrumbs.length === 0) {
    return null
  }

  return (
    <nav className="flex items-center space-x-2 text-sm">
      <Link
        href="/"
        className="text-gray-400 hover:text-gray-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </Link>

      {breadcrumbs.map((breadcrumb, index) => (
        <Fragment key={breadcrumb.href}>
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {breadcrumb.isLast ? (
            <span className="text-white font-medium">{breadcrumb.name}</span>
          ) : (
            <Link
              href={breadcrumb.href}
              className="text-gray-400 hover:text-gray-200 transition-colors"
            >
              {breadcrumb.name}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  )
}

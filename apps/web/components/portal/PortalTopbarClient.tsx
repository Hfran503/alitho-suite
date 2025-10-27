'use client'

import Link from 'next/link'
import { Package, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'

interface PortalTopbarClientProps {
  user: {
    id?: string
    name?: string | null
    email?: string | null
    image?: string | null
  } | null
}

export function PortalTopbarClient({ user }: PortalTopbarClientProps) {
  const userInitials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U'

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between px-6 max-w-full">
        {/* Left Section - Logo */}
        <Link href="/portal" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Package className="h-6 w-6 text-blue-600" />
          <span className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Customer Portal
          </span>
        </Link>

        {/* Right Section - User Info & Sign Out */}
        <div className="flex items-center gap-4">
          {/* User Info */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm">
                {userInitials}
              </div>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-medium text-gray-900">{user.name}</span>
                <span className="text-xs text-gray-500">{user.email}</span>
              </div>
            </div>
          )}

          {/* Sign Out Button */}
          {user && (
            <button
              onClick={() => {
                // Use window.location.origin to ensure correct domain (calithosuite.com)
                const callbackUrl = `${window.location.origin}/auth/portal-signin`
                signOut({ callbackUrl })
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

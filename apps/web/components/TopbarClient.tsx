'use client'

import { Breadcrumbs } from './Breadcrumbs'
import { SearchBar } from './SearchBar'
import { Notifications } from './Notifications'
import { UserMenu } from './UserMenu'

interface TopbarClientProps {
  user: {
    id?: string
    name?: string | null
    email?: string | null
    image?: string | null
  } | null
}

export function TopbarClient({ user }: TopbarClientProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-gray-900 border-b border-gray-800 z-50">
      <div className="h-full flex items-center justify-between px-6 gap-4">
        {/* Left Section - Logo and Breadcrumbs */}
        <div className="flex items-center gap-6 flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white whitespace-nowrap">
            Calitho Suite
          </h1>
          <div className="hidden lg:block">
            <Breadcrumbs />
          </div>
        </div>

        {/* Center Section - Search Bar */}
        <div className="hidden xl:block flex-shrink-0">
          <SearchBar />
        </div>

        {/* Right Section - Actions and User Menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Search (Mobile/Tablet) */}
          <div className="xl:hidden">
            <SearchBar />
          </div>

          {user && (
            <>
              {/* Notifications */}
              <Notifications />

              {/* Divider */}
              <div className="h-8 w-px bg-gray-700 mx-1"></div>

              {/* User Menu */}
              <UserMenu user={user} />
            </>
          )}
        </div>
      </div>
    </header>
  )
}

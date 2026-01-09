'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

interface CRMSidebarProps {
  onPinChange?: (isPinned: boolean) => void
}

export function CRMSidebar({ onPinChange }: CRMSidebarProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(true) // Default pinned for CRM
  const pathname = usePathname()
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load pin state from localStorage on mount
  useEffect(() => {
    const savedPinState = localStorage.getItem('crmSidebarPinned')
    if (savedPinState !== null) {
      const pinState = savedPinState === 'true'
      setIsPinned(pinState)
      if (onPinChange) {
        onPinChange(pinState)
      }
    } else {
      // Default to pinned for CRM
      if (onPinChange) {
        onPinChange(true)
      }
    }
  }, [onPinChange])

  const isExpanded = isPinned || isHovered

  const handlePinToggle = () => {
    const newPinState = !isPinned
    setIsPinned(newPinState)
    localStorage.setItem('crmSidebarPinned', String(newPinState))
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

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`fixed left-0 top-0 h-screen bg-teal-950 text-white transition-all duration-300 ease-in-out z-50 overflow-hidden shadow-xl ${
        isExpanded ? 'w-64' : 'w-16'
      }`}
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-teal-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-teal-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className={`transition-opacity duration-300 overflow-hidden ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
              <h1 className="font-bold text-lg text-white whitespace-nowrap">CRM</h1>
              <p className="text-xs text-teal-300 whitespace-nowrap">Relationship Management</p>
            </div>
          </div>
        </div>

        {/* Back to Suite Link */}
        <div className="px-2 py-3 border-b border-teal-900/50">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-teal-300 hover:bg-teal-900 hover:text-white transition-colors group"
          >
            <svg className="w-5 h-5 flex-shrink-0 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            <span className={`whitespace-nowrap text-sm transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
              Back to Suite
            </span>
          </Link>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="px-2 space-y-1">
            <Link
              href="/crm"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                pathname === '/crm'
                  ? 'bg-teal-800 text-white'
                  : 'text-teal-100 hover:bg-teal-900 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className={`whitespace-nowrap text-sm transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                Overview
              </span>
            </Link>

            <Link
              href="/crm/contacts"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                pathname.startsWith('/crm/contacts')
                  ? 'bg-teal-800 text-white'
                  : 'text-teal-100 hover:bg-teal-900 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className={`whitespace-nowrap text-sm transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                Contacts
              </span>
            </Link>

            <Link
              href="/crm/opportunities"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                pathname.startsWith('/crm/opportunities')
                  ? 'bg-teal-800 text-white'
                  : 'text-teal-100 hover:bg-teal-900 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className={`whitespace-nowrap text-sm transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                Opportunities
              </span>
            </Link>

            <Link
              href="/crm/quotes"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                pathname.startsWith('/crm/quotes')
                  ? 'bg-teal-800 text-white'
                  : 'text-teal-100 hover:bg-teal-900 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
              </svg>
              <span className={`whitespace-nowrap text-sm transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                Quotes
              </span>
            </Link>

            {/* Settings Section */}
            <div className="pt-4 mt-4 border-t border-teal-900/50">
              <Link
                href="/crm/product-types"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  pathname.startsWith('/crm/product-types')
                    ? 'bg-teal-800 text-white'
                    : 'text-teal-100 hover:bg-teal-900 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span className={`whitespace-nowrap text-sm transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                  Product Types
                </span>
              </Link>
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-teal-900/50 space-y-1">
          <button
            onClick={handlePinToggle}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full ${
              isPinned
                ? 'bg-teal-700 text-white'
                : 'text-teal-300 hover:bg-teal-900 hover:text-white'
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
            className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-teal-300 hover:bg-red-900 hover:text-white"
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

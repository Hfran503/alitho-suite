'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './Sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isSidebarPinned, setIsSidebarPinned] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Track session on mount
    const trackSession = async () => {
      try {
        await fetch('/api/auth/track-session', { method: 'POST' })
      } catch (error) {
        console.error('Failed to track session:', error)
      }
    }

    // Validate session hasn't been revoked
    const validateSession = async () => {
      try {
        const response = await fetch('/api/auth/validate-session')
        const data = await response.json()

        if (!data.valid) {
          // Session was revoked - sign out user immediately
          console.log('Session revoked:', data.reason)

          // Show alert to user
          alert(`Your session has been terminated by an administrator.\n\nReason: ${data.reason}\n\nYou will be signed out now.`)

          // Sign out and redirect
          await signOut({ redirect: false })
          router.push('/auth/signin?error=session-revoked')
        }
      } catch (error) {
        console.error('Failed to validate session:', error)
      }
    }

    // Initial calls
    trackSession()
    validateSession()

    // Track session every 5 minutes to keep it active
    const trackInterval = setInterval(trackSession, 5 * 60 * 1000)

    // Validate session every 30 seconds to catch revocations quickly
    const validateInterval = setInterval(validateSession, 30 * 1000)

    return () => {
      clearInterval(trackInterval)
      clearInterval(validateInterval)
    }
  }, [router])

  return (
    <>
      <Sidebar onPinChange={setIsSidebarPinned} />
      <main
        className={`mt-16 p-8 transition-all duration-300 ${
          isSidebarPinned ? 'ml-64' : 'ml-16'
        }`}
      >
        {children}
      </main>
    </>
  )
}

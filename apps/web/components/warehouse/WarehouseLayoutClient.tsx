'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { WarehouseSidebar } from './WarehouseSidebar'

interface WarehouseLayoutClientProps {
  children: React.ReactNode
}

export function WarehouseLayoutClient({ children }: WarehouseLayoutClientProps) {
  const [isSidebarPinned, setIsSidebarPinned] = useState(true) // Default pinned for warehouse
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
          console.log('Session revoked:', data.reason)
          alert(`Your session has been terminated by an administrator.\n\nReason: ${data.reason}\n\nYou will be signed out now.`)
          await signOut({ redirect: false })
          router.push('/auth/signin?error=session-revoked')
        }
      } catch (error) {
        console.error('Failed to validate session:', error)
      }
    }

    trackSession()
    validateSession()

    const trackInterval = setInterval(trackSession, 5 * 60 * 1000)
    const validateInterval = setInterval(validateSession, 30 * 1000)

    return () => {
      clearInterval(trackInterval)
      clearInterval(validateInterval)
    }
  }, [router])

  return (
    <>
      <WarehouseSidebar onPinChange={setIsSidebarPinned} />
      <main
        className={`p-8 transition-all duration-300 ${
          isSidebarPinned ? 'ml-64' : 'ml-16'
        }`}
      >
        {children}
      </main>
    </>
  )
}

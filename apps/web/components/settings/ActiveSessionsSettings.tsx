'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface Session {
  id: string
  userId: string
  expires: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  // Browser/device info if available
  userAgent?: string
  ipAddress?: string
  lastActivity?: string
}

export function ActiveSessionsSettings() {
  const { data: currentSession } = useSession()
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [signingOut, setSigningOut] = useState<string | null>(null)
  const currentUserId = currentSession?.user?.id

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/admin/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions)
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async (sessionId: string, userName: string) => {
    if (!confirm(`Are you sure you want to sign out ${userName}?`)) {
      return
    }

    setSigningOut(sessionId)

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Remove from list
        setSessions(sessions.filter((s) => s.id !== sessionId))
      } else {
        alert('Failed to sign out user')
      }
    } catch (error) {
      console.error('Error signing out user:', error)
      alert('An error occurred')
    } finally {
      setSigningOut(null)
    }
  }

  const handleSignOutAll = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to sign out ALL sessions for ${userName}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/sessions`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Remove all sessions for this user
        setSessions(sessions.filter((s) => s.userId !== userId))
      } else {
        alert('Failed to sign out all sessions')
      }
    } catch (error) {
      console.error('Error signing out all sessions:', error)
      alert('An error occurred')
    }
  }

  // Filter sessions based on search
  const filteredSessions = sessions.filter((session) =>
    session.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group sessions by user
  const sessionsByUser = filteredSessions.reduce((acc, session) => {
    if (!acc[session.userId]) {
      acc[session.userId] = []
    }
    acc[session.userId].push(session)
    return acc
  }, {} as Record<string, Session[]>)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading active sessions...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <input
              type="text"
              placeholder="Search active users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Active Sessions List */}
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
        {Object.entries(sessionsByUser).length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No active sessions found
          </div>
        ) : (
          Object.entries(sessionsByUser).map(([userId, userSessions]) => {
            const user = userSessions[0].user
            return (
              <div key={userId} className="p-6 hover:bg-gray-50">
                {/* User Info */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    {user.image ? (
                      <img
                        className="h-12 w-12 rounded-full"
                        src={user.image}
                        alt={user.name || user.email}
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-lg">
                        {(user.name || user.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-base font-medium text-gray-900">
                        {user.name || 'No name'}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {userSessions.length} active session{userSessions.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {userSessions.length > 1 && (
                    <button
                      onClick={() => handleSignOutAll(userId, user.name || user.email)}
                      className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
                    >
                      Sign Out All
                    </button>
                  )}
                </div>

                {/* Sessions */}
                <div className="space-y-2 ml-16">
                  {userSessions.map((session) => {
                    const isCurrentUser = session.userId === currentUserId
                    return (
                      <div
                        key={session.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          isCurrentUser ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span className="text-gray-700">Session ID: {session.id.substring(0, 8)}...</span>
                            {isCurrentUser && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">
                                Your Session
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Expires: {new Date(session.expires).toLocaleString()}
                          </div>
                        </div>

                        {isCurrentUser ? (
                          <div className="px-3 py-1.5 text-sm text-gray-500 italic">
                            Cannot sign out self
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSignOut(session.id, user.name || user.email)}
                            disabled={signingOut === session.id}
                            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {signingOut === session.id ? 'Signing out...' : 'Sign Out'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-2">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-800">About Active Sessions</p>
            <p className="text-sm text-blue-700 mt-1">
              Active sessions represent currently logged-in users. Signing out a session will immediately terminate that user's access (within 30 seconds). Your own session is highlighted and cannot be terminated - use the logout button instead.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

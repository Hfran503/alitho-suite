'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Search,
  KeyRound,
  Monitor,
  Loader2,
  LogOut,
  Users,
  Shield,
  Activity,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Session {
  id: string
  userId: string
  sessionToken: string
  expires: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  userAgent?: string
  ipAddress?: string
  lastActivity?: string
}

export function ActiveSessionsSettings() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [signingOut, setSigningOut] = useState<string | null>(null)
  const [currentSessionToken, setCurrentSessionToken] = useState<string | null>(null)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/admin/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions)
        setCurrentSessionToken(data.currentSessionToken)
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
        setSessions(sessions.filter((s) => s.userId !== userId))
      } else {
        alert('Failed to sign out all sessions')
      }
    } catch (error) {
      console.error('Error signing out all sessions:', error)
      alert('An error occurred')
    }
  }

  const filteredSessions = sessions.filter((session) =>
    session.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const sessionsByUser = filteredSessions.reduce((acc, session) => {
    if (!acc[session.userId]) {
      acc[session.userId] = []
    }
    acc[session.userId].push(session)
    return acc
  }, {} as Record<string, Session[]>)

  const uniqueUsers = Object.keys(sessionsByUser).length

  const getTimeRemaining = (expires: string) => {
    const now = new Date()
    const expiry = new Date(expires)
    const diff = expiry.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h`
    return 'Expiring soon'
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
          <div className="absolute inset-0 h-16 w-16 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
        </div>
        <p className="text-sm text-gray-500 font-medium">Loading active sessions...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Compact Stats Bar */}
      <div className="flex items-center gap-6 p-3 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 rounded-lg">
            <Activity className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Sessions</p>
            <p className="text-lg font-bold text-gray-900">{sessions.length}</p>
          </div>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 rounded-lg">
            <Users className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Users</p>
            <p className="text-lg font-bold text-gray-900">{uniqueUsers}</p>
          </div>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 rounded-lg">
            <Shield className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Your Session</p>
            <p className="text-sm font-semibold text-emerald-600">Protected</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-10 bg-white border-gray-200 rounded-lg focus:border-blue-500 focus:ring-blue-500/20 text-sm"
        />
      </div>

      {/* Sessions List */}
      {Object.entries(sessionsByUser).length === 0 ? (
        <Card className="border border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="p-3 bg-gray-100 rounded-xl">
              <KeyRound className="h-8 w-8 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-900">No active sessions</p>
              <p className="text-sm text-gray-500">No users are currently logged in</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Object.entries(sessionsByUser).map(([userId, userSessions]) => {
            const user = userSessions[0].user
            const hasCurrentSession = userSessions.some(s => s.sessionToken === currentSessionToken)

            return (
              <Card
                key={userId}
                className={cn(
                  'border border-gray-200 overflow-hidden',
                  hasCurrentSession && 'ring-1 ring-blue-500/30 border-blue-200'
                )}
              >
                <CardContent className="p-0">
                  {/* Compact User Header */}
                  <div className={cn(
                    'px-4 py-3 border-b flex items-center justify-between',
                    hasCurrentSession ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-50/50 border-gray-100'
                  )}>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {user.image ? (
                          <img
                            className="h-10 w-10 rounded-xl ring-2 ring-white shadow object-cover"
                            src={user.image}
                            alt={user.name || user.email}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow ring-2 ring-white">
                            {(user.name || user.email).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 border-2 border-white rounded-full" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">
                            {user.name || 'Unknown User'}
                          </h3>
                          {hasCurrentSession && (
                            <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px] px-1.5 py-0">You</Badge>
                          )}
                          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] px-1.5 py-0 gap-1">
                            <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />
                            {userSessions.length} session{userSessions.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>

                    {userSessions.length > 1 && !userSessions.every(s => s.sessionToken === currentSessionToken) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSignOutAll(userId, user.name || user.email)}
                        className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 gap-1"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        End All
                      </Button>
                    )}
                  </div>

                  {/* Compact Sessions List */}
                  <div className="divide-y divide-gray-100">
                    {userSessions.map((session) => {
                      const isCurrentSession = session.sessionToken === currentSessionToken
                      const timeRemaining = getTimeRemaining(session.expires)

                      return (
                        <div
                          key={session.id}
                          className={cn(
                            'flex items-center justify-between px-4 py-2.5',
                            isCurrentSession ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Monitor className={cn('h-4 w-4', isCurrentSession ? 'text-blue-200' : 'text-gray-400')} />
                            <div className="flex items-center gap-3">
                              <span className={cn('text-xs font-mono', isCurrentSession ? 'text-white' : 'text-gray-600')}>
                                {session.id.substring(0, 10)}...
                              </span>
                              {isCurrentSession && (
                                <Badge className="bg-white/20 text-white border-0 text-[10px] px-1.5 py-0">Current</Badge>
                              )}
                              <span className={cn('text-xs', isCurrentSession ? 'text-blue-200' : 'text-gray-400')}>
                                Expires {timeRemaining}
                              </span>
                              <span className={cn('text-xs', isCurrentSession ? 'text-blue-200' : 'text-gray-400')}>
                                {new Date(session.expires).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          </div>

                          {isCurrentSession ? (
                            <div className="flex items-center gap-1.5 text-xs text-blue-200">
                              <Shield className="h-3 w-3" />
                              Protected
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSignOut(session.id, user.name || user.email)}
                              disabled={signingOut === session.id}
                              className="h-7 px-2 text-xs text-red-600 hover:bg-red-100 hover:text-red-700"
                            >
                              {signingOut === session.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <LogOut className="h-3 w-3 mr-1" />
                                  Terminate
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Compact Info Footer */}
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-lg border border-amber-200">
        <Shield className="h-4 w-4 text-amber-600 flex-shrink-0" />
        <p className="text-xs text-amber-700">
          Terminating a session revokes access within 30 seconds. Your session (highlighted in blue) is protected.
        </p>
      </div>
    </div>
  )
}

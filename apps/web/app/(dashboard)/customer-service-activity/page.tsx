'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Search,
  Loader2,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface User {
  id: string
  email: string
  name: string | null
  image: string | null
  createdAt: string
  lastActivity: string | null
  isInactive: boolean
  daysSinceActivity: number | null
  memberships: {
    id: string
    role: string
    tenant: {
      id: string
      name: string
    }
  }[]
}

interface Stats {
  total: number
  active: number
  inactive: number
}

export default function CustomerServiceActivityPage() {
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setIsRefreshing(true)
      }
      const response = await fetch('/api/staff/customer-service-activity')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching customer service users:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchUsers(true)
  }

  // Filter users based on search and status
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'inactive' && user.isInactive) ||
      (filterStatus === 'active' && !user.isInactive)

    return matchesSearch && matchesFilter
  })

  const getActivityStatus = (user: User) => {
    if (!user.lastActivity) {
      return {
        label: 'Never Active',
        color: 'bg-gray-100 text-gray-700 border-gray-200',
        icon: <Clock className="h-3.5 w-3.5" />,
      }
    }
    if (user.isInactive) {
      return {
        label: `${user.daysSinceActivity}+ days ago`,
        color: 'bg-red-50 text-red-700 border-red-200',
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
      }
    }
    return {
      label: 'Active',
      color: 'bg-green-50 text-green-700 border-green-200',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    }
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          <p className="text-sm text-gray-500 font-medium">
            Loading customer service users...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900">
          Customer Service Activity Monitor
        </h1>
        <p className="text-gray-500">
          Track customer service team activity and identify inactive users
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total CS Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active (Last 3 Days)</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
          </div>
        </div>
        <div
          className={cn(
            'rounded-xl border p-5 shadow-sm transition-all',
            stats.inactive > 0
              ? 'bg-red-50 border-red-200 animate-pulse'
              : 'bg-white border-gray-200'
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2.5 rounded-lg',
                stats.inactive > 0 ? 'bg-red-100' : 'bg-gray-50'
              )}
            >
              <AlertTriangle
                className={cn(
                  'h-5 w-5',
                  stats.inactive > 0 ? 'text-red-600' : 'text-gray-400'
                )}
              />
            </div>
            <div>
              <p
                className={cn(
                  'text-sm',
                  stats.inactive > 0 ? 'text-red-600' : 'text-gray-500'
                )}
              >
                Inactive (3+ Days)
              </p>
              <p
                className={cn(
                  'text-2xl font-bold',
                  stats.inactive > 0 ? 'text-red-600' : 'text-gray-400'
                )}
              >
                {stats.inactive}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Banner for Inactive Users */}
      {stats.inactive > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800">
              Attention: {stats.inactive} user{stats.inactive > 1 ? 's have' : ' has'}{' '}
              not been active for more than 3 days
            </p>
            <p className="text-sm text-red-600 mt-1">
              Review the users below and follow up if necessary. Users without recent
              activity may need assistance or reminders.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setFilterStatus('all')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                filterStatus === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                filterStatus === 'active'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Active
            </button>
            <button
              onClick={() => setFilterStatus('inactive')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                filterStatus === 'inactive'
                  ? 'bg-white text-red-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Inactive
            </button>
          </div>

          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-10"
          >
            <RefreshCw
              className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100/50 hover:bg-gray-50">
              <TableHead className="font-semibold text-gray-700">User</TableHead>
              <TableHead className="font-semibold text-gray-700">Organization</TableHead>
              <TableHead className="font-semibold text-gray-700">Status</TableHead>
              <TableHead className="font-semibold text-gray-700">Last Activity</TableHead>
              <TableHead className="font-semibold text-gray-700">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40">
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <div className="p-3 bg-gray-100 rounded-xl">
                      <Users className="h-8 w-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">No users found</p>
                      <p className="text-sm text-gray-500">
                        {users.length === 0
                          ? 'No customer service users in the system'
                          : 'Try adjusting your search or filter criteria'}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const status = getActivityStatus(user)
                return (
                  <TableRow
                    key={user.id}
                    className={cn(
                      'group transition-colors duration-150',
                      user.isInactive
                        ? 'bg-red-50/50 hover:bg-red-50'
                        : 'hover:bg-blue-50/50'
                    )}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {user.image ? (
                            <img
                              className="h-10 w-10 rounded-full ring-2 ring-white shadow-md object-cover"
                              src={user.image}
                              alt={user.name || user.email}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-md ring-2 ring-white">
                              {(user.name || user.email).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div
                            className={cn(
                              'absolute -bottom-0.5 -right-0.5 h-3 w-3 border-2 border-white rounded-full',
                              user.isInactive ? 'bg-red-500' : 'bg-green-500'
                            )}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.name || 'No name'}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {user.memberships.map((m) => m.tenant.name).join(', ') || (
                        <span className="text-gray-400 italic">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          'font-medium text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 w-fit',
                          status.color
                        )}
                      >
                        {status.icon}
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.lastActivity ? (
                        <div className="space-y-0.5">
                          <p
                            className={cn(
                              user.isInactive ? 'text-red-600 font-medium' : 'text-gray-600'
                            )}
                          >
                            {new Date(user.lastActivity).toLocaleDateString('en-US', {
                              timeZone: 'America/Los_Angeles',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          <p
                            className={cn(
                              'text-xs',
                              user.isInactive ? 'text-red-500' : 'text-gray-400'
                            )}
                          >
                            {new Date(user.lastActivity).toLocaleTimeString('en-US', {
                              timeZone: 'America/Los_Angeles',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {new Date(user.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      {filteredUsers.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500 px-1">
          <p>
            Showing <span className="font-medium text-gray-700">{filteredUsers.length}</span>{' '}
            of <span className="font-medium text-gray-700">{users.length}</span> customer
            service users
          </p>
          <p className="text-xs text-gray-400">
            Activity threshold: 3 days | Timezone: America/Los_Angeles
          </p>
        </div>
      )}
    </div>
  )
}

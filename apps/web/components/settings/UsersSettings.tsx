'use client'

import { useState, useEffect } from 'react'
import { EditUserModal } from './EditUserModal'
import { ResetPasswordModal } from './ResetPasswordModal'
import { AddUserModal } from './AddUserModal'
import { USER_ROLES, ROLE_LABELS, getRoleColor, getRoleLabel } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Plus,
  Pencil,
  KeyRound,
  Loader2,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface User {
  id: string
  email: string
  name: string | null
  image: string | null
  paceCustomerId: string | null
  createdAt: string
  lastActivity: string | null
  memberships: {
    id: string
    role: string
    tenant: {
      id: string
      name: string
    }
  }[]
}

export function UsersSettings() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false)
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setIsEditModalOpen(true)
  }

  const handleResetPassword = (user: User) => {
    setSelectedUser(user)
    setIsResetPasswordModalOpen(true)
  }

  const handleUserUpdated = () => {
    fetchUsers()
    setIsEditModalOpen(false)
    setIsResetPasswordModalOpen(false)
    setIsAddUserModalOpen(false)
  }

  // Filter users based on search and role
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesRole =
      roleFilter === 'all' ||
      user.memberships.some((m) => m.role === roleFilter)

    return matchesSearch && matchesRole
  })


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Loading users...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-44 h-10 bg-white border-gray-200">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {Object.entries(USER_ROLES).map(([, value]) => (
                <SelectItem key={value} value={value}>
                  {ROLE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => setIsAddUserModalOpen(true)}
            className="h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 transition-all duration-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100/50 hover:bg-gray-50">
              <TableHead className="font-semibold text-gray-700">User</TableHead>
              <TableHead className="font-semibold text-gray-700">Role</TableHead>
              <TableHead className="font-semibold text-gray-700">Organization</TableHead>
              <TableHead className="font-semibold text-gray-700">Joined</TableHead>
              <TableHead className="font-semibold text-gray-700">Last Activity</TableHead>
              <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40">
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <div className="p-3 bg-gray-100 rounded-xl">
                      <Users className="h-8 w-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">No users found</p>
                      <p className="text-sm text-gray-500">Try adjusting your search or filter criteria</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow
                  key={user.id}
                  className="group hover:bg-blue-50/50 transition-colors duration-150"
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
                        <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 border-2 border-white rounded-full" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.name || 'No name'}
                        </p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {user.memberships.map((membership) => (
                        <Badge
                          key={membership.id}
                          className={cn(
                            'font-medium text-xs px-2.5 py-0.5 rounded-full border-0',
                            getRoleColor(membership.role)
                          )}
                        >
                          {getRoleLabel(membership.role)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {user.memberships.map((m) => m.tenant.name).join(', ') || (
                      <span className="text-gray-400 italic">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {new Date(user.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </TableCell>
                  <TableCell>
                    {user.lastActivity ? (
                      <div className="space-y-0.5">
                        <p className="text-gray-600">
                          {new Date(user.lastActivity).toLocaleDateString('en-US', {
                            timeZone: 'America/Los_Angeles',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(user.lastActivity).toLocaleTimeString('en-US', {
                            timeZone: 'America/Los_Angeles',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Never</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                        className="h-8 px-3 text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetPassword(user)}
                        className="h-8 px-3 text-gray-600 hover:text-amber-600 hover:bg-amber-50"
                      >
                        <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                        Reset
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* User Count Footer */}
      {filteredUsers.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500 px-1">
          <p>
            Showing <span className="font-medium text-gray-700">{filteredUsers.length}</span> of{' '}
            <span className="font-medium text-gray-700">{users.length}</span> users
          </p>
        </div>
      )}

      {/* Modals */}
      {selectedUser && (
        <>
          <EditUserModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            user={selectedUser}
            onSuccess={handleUserUpdated}
          />
          <ResetPasswordModal
            isOpen={isResetPasswordModalOpen}
            onClose={() => setIsResetPasswordModalOpen(false)}
            user={selectedUser}
            onSuccess={handleUserUpdated}
          />
        </>
      )}

      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onSuccess={handleUserUpdated}
      />
    </div>
  )
}

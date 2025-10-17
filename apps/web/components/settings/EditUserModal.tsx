'use client'

import { useState, useEffect } from 'react'
import { Modal } from '../Modal'
import { USER_ROLES, ROLE_LABELS } from '@/lib/roles'

interface User {
  id: string
  email: string
  name: string | null
  image: string | null
  memberships: {
    id: string
    role: string
    tenant: {
      id: string
      name: string
    }
  }[]
}

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  user: User
  onSuccess: () => void
}

export function EditUserModal({ isOpen, onClose, user, onSuccess }: EditUserModalProps) {
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email,
  })
  const [membershipRoles, setMembershipRoles] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Initialize membership roles
    const roles: Record<string, string> = {}
    user.memberships.forEach((m) => {
      roles[m.id] = m.role
    })
    setMembershipRoles(roles)
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          memberships: Object.entries(membershipRoles).map(([id, role]) => ({
            id,
            role,
          })),
        }),
      })

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1000)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update user')
      }
    } catch (error) {
      setError('An error occurred. Please try again.')
      console.error('Error updating user:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRoleChange = (membershipId: string, newRole: string) => {
    setMembershipRoles({
      ...membershipRoles,
      [membershipId]: newRole,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Success Message */}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm text-green-800">User updated successfully!</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* User Info Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Information</h3>

          {/* Profile Picture */}
          <div className="flex items-center gap-4 mb-6">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name || user.email}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-medium">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">User ID</p>
              <p className="text-xs font-mono text-gray-600">{user.id}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter full name"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="email@example.com"
                required
              />
            </div>
          </div>
        </div>

        {/* Roles & Permissions Section */}
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Roles & Permissions</h3>
          <div className="space-y-4">
            {user.memberships.map((membership) => (
              <div
                key={membership.id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{membership.tenant.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Tenant ID: {membership.tenant.id}
                    </p>
                  </div>
                  <select
                    value={membershipRoles[membership.id] || membership.role}
                    onChange={(e) => handleRoleChange(membership.id, e.target.value)}
                    className="ml-4 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Object.entries(USER_ROLES).map(([, value]) => (
                      <option key={value} value={value}>
                        {ROLE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {user.memberships.length === 0 && (
              <p className="text-sm text-gray-500">No organization memberships</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

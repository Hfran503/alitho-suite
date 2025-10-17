// User role types and permissions
export const USER_ROLES = {
  FULL_ADMIN: 'full_admin',
  ADMIN: 'admin',
  CUSTOMER_SERVICE: 'customer_service',
  ACCOUNTING: 'accounting',
  ESTIMATORS: 'estimators',
  LOGISTICS: 'logistics',
} as const

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]

export const ROLE_LABELS: Record<string, string> = {
  [USER_ROLES.FULL_ADMIN]: 'Full Admin',
  [USER_ROLES.ADMIN]: 'Admin',
  [USER_ROLES.CUSTOMER_SERVICE]: 'Customer Service',
  [USER_ROLES.ACCOUNTING]: 'Accounting',
  [USER_ROLES.ESTIMATORS]: 'Estimators',
  [USER_ROLES.LOGISTICS]: 'Logistics',
}

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  [USER_ROLES.FULL_ADMIN]: 'Full system access with all permissions',
  [USER_ROLES.ADMIN]: 'Administrative access with limited system settings',
  [USER_ROLES.CUSTOMER_SERVICE]: 'Manage customer interactions and orders',
  [USER_ROLES.ACCOUNTING]: 'Manage invoices, payments, and financial data',
  [USER_ROLES.ESTIMATORS]: 'Create and manage project estimates',
  [USER_ROLES.LOGISTICS]: 'Manage shipping, inventory, and logistics',
}

export const ROLE_COLORS: Record<string, string> = {
  [USER_ROLES.FULL_ADMIN]: 'bg-purple-100 text-purple-800',
  [USER_ROLES.ADMIN]: 'bg-blue-100 text-blue-800',
  [USER_ROLES.CUSTOMER_SERVICE]: 'bg-green-100 text-green-800',
  [USER_ROLES.ACCOUNTING]: 'bg-yellow-100 text-yellow-800',
  [USER_ROLES.ESTIMATORS]: 'bg-orange-100 text-orange-800',
  [USER_ROLES.LOGISTICS]: 'bg-teal-100 text-teal-800',
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role
}

export function getRoleColor(role: string): string {
  return ROLE_COLORS[role] || 'bg-gray-100 text-gray-800'
}

export function getRoleDescription(role: string): string {
  return ROLE_DESCRIPTIONS[role] || ''
}

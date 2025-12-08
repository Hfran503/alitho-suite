// User role types and permissions
export const USER_ROLES = {
  FULL_ADMIN: 'full_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  CUSTOMER_SERVICE: 'customer_service',
  ACCOUNTING: 'accounting',
  ESTIMATORS: 'estimators',
  LOGISTICS: 'logistics',
  WAREHOUSE: 'warehouse',
  MARKETING: 'marketing',
  CUSTOMER: 'customer',
} as const

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]

export const ROLE_LABELS: Record<string, string> = {
  [USER_ROLES.FULL_ADMIN]: 'Full Admin',
  [USER_ROLES.ADMIN]: 'Admin',
  [USER_ROLES.MANAGER]: 'Manager',
  [USER_ROLES.CUSTOMER_SERVICE]: 'Customer Service',
  [USER_ROLES.ACCOUNTING]: 'Accounting',
  [USER_ROLES.ESTIMATORS]: 'Estimators',
  [USER_ROLES.LOGISTICS]: 'Logistics',
  [USER_ROLES.WAREHOUSE]: 'Warehouse',
  [USER_ROLES.MARKETING]: 'Marketing',
  [USER_ROLES.CUSTOMER]: 'Customer',
}

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  [USER_ROLES.FULL_ADMIN]: 'Full system access with all permissions',
  [USER_ROLES.ADMIN]: 'Administrative access with limited system settings',
  [USER_ROLES.MANAGER]: 'Manage teams, departments, and operational workflows',
  [USER_ROLES.CUSTOMER_SERVICE]: 'Manage customer interactions and orders',
  [USER_ROLES.ACCOUNTING]: 'Manage invoices, payments, and financial data',
  [USER_ROLES.ESTIMATORS]: 'Create and manage project estimates',
  [USER_ROLES.LOGISTICS]: 'Manage shipping, inventory, and logistics',
  [USER_ROLES.WAREHOUSE]: 'Manage warehouse operations, inventory, and fulfillment',
  [USER_ROLES.MARKETING]: 'Manage marketing campaigns and customer communications',
  [USER_ROLES.CUSTOMER]: 'View orders, shipments, and invoices',
}

export const ROLE_COLORS: Record<string, string> = {
  [USER_ROLES.FULL_ADMIN]: 'bg-purple-100 text-purple-800',
  [USER_ROLES.ADMIN]: 'bg-blue-100 text-blue-800',
  [USER_ROLES.MANAGER]: 'bg-cyan-100 text-cyan-800',
  [USER_ROLES.CUSTOMER_SERVICE]: 'bg-green-100 text-green-800',
  [USER_ROLES.ACCOUNTING]: 'bg-yellow-100 text-yellow-800',
  [USER_ROLES.ESTIMATORS]: 'bg-orange-100 text-orange-800',
  [USER_ROLES.LOGISTICS]: 'bg-teal-100 text-teal-800',
  [USER_ROLES.WAREHOUSE]: 'bg-amber-100 text-amber-800',
  [USER_ROLES.MARKETING]: 'bg-pink-100 text-pink-800',
  [USER_ROLES.CUSTOMER]: 'bg-indigo-100 text-indigo-800',
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

// Staff roles (internal users with access to dashboard)
export const STAFF_ROLES = [
  USER_ROLES.FULL_ADMIN,
  USER_ROLES.ADMIN,
  USER_ROLES.MANAGER,
  USER_ROLES.CUSTOMER_SERVICE,
  USER_ROLES.ACCOUNTING,
  USER_ROLES.ESTIMATORS,
  USER_ROLES.LOGISTICS,
  USER_ROLES.WAREHOUSE,
  USER_ROLES.MARKETING,
] as const

// Customer roles (external users with access to portal)
export const CUSTOMER_ROLES = [
  USER_ROLES.CUSTOMER,
] as const

export function isStaffRole(role: string): boolean {
  return STAFF_ROLES.includes(role as any)
}

export function isCustomerRole(role: string): boolean {
  return CUSTOMER_ROLES.includes(role as any)
}

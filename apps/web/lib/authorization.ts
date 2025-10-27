import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { STAFF_ROLES, CUSTOMER_ROLES, USER_ROLES } from '@/lib/roles'

export type AdminRole = typeof USER_ROLES.FULL_ADMIN | typeof USER_ROLES.ADMIN

/**
 * Check if the current user has admin access (full_admin or admin roles only)
 * @returns User session if authorized, or error response
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return {
      authorized: false as const,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const userRole = (session.user as any).role

  // Only full_admin and admin can access admin routes
  if (userRole !== USER_ROLES.FULL_ADMIN && userRole !== USER_ROLES.ADMIN) {
    return {
      authorized: false as const,
      error: NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      ),
    }
  }

  return {
    authorized: true as const,
    session,
  }
}

/**
 * Check if the current user has staff access (any staff role)
 * @returns User session if authorized, or error response
 */
export async function requireStaff() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return {
      authorized: false as const,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const userRole = (session.user as any).role

  if (!STAFF_ROLES.includes(userRole)) {
    return {
      authorized: false as const,
      error: NextResponse.json(
        { error: 'Forbidden - Staff access required' },
        { status: 403 }
      ),
    }
  }

  return {
    authorized: true as const,
    session,
  }
}

/**
 * Check if the current user has customer access
 * @returns User session if authorized, or error response
 */
export async function requireCustomer() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return {
      authorized: false as const,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const userRole = (session.user as any).role

  if (!CUSTOMER_ROLES.includes(userRole as any)) {
    return {
      authorized: false as const,
      error: NextResponse.json(
        { error: 'Forbidden - Customer access required' },
        { status: 403 }
      ),
    }
  }

  return {
    authorized: true as const,
    session,
  }
}

/**
 * Check if the current user is authenticated (any role)
 * @returns User session if authorized, or error response
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return {
      authorized: false as const,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return {
    authorized: true as const,
    session,
  }
}

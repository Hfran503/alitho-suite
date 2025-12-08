import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const STAFF_ROLES = ['full_admin', 'admin', 'manager', 'customer_service', 'accounting', 'estimators', 'logistics', 'warehouse', 'marketing']
const CUSTOMER_ROLES = ['customer']

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  const pathname = request.nextUrl.pathname

  // Portal routes - customer access only
  if (pathname.startsWith('/portal') || pathname.startsWith('/api/portal')) {
    if (!token) {
      return NextResponse.redirect(new URL('/auth/portal-signin', request.url))
    }

    const userRole = (token as any).role
    if (!CUSTOMER_ROLES.includes(userRole)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return NextResponse.next()
  }

  // Admin routes - full_admin and admin roles only
  if (pathname.startsWith('/api/admin')) {
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (token as any).role
    // Only full_admin and admin can access admin routes
    if (userRole !== 'full_admin' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    return NextResponse.next()
  }

  // Staff-only pages and API routes (all pages except portal, auth, and root)
  const isStaffRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/open-jobs') ||
    pathname.startsWith('/prebilling-jobs') ||
    pathname.startsWith('/shipments') ||
    pathname.startsWith('/shipment-track') ||
    pathname.startsWith('/batch-import') ||
    pathname.startsWith('/invoices') ||
    pathname.startsWith('/rates') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/api/orders') ||
    pathname.startsWith('/api/uploads')

  // Check if user needs to change password
  if (token && (token as any).passwordResetRequired) {
    // Allow access to the change password page and API
    if (
      pathname === '/auth/change-password' ||
      pathname === '/api/user/force-change-password' ||
      pathname === '/api/auth/signout' ||
      pathname.startsWith('/api/auth/session')
    ) {
      return NextResponse.next()
    }

    // Redirect to change password page for all other protected routes
    if (isStaffRoute) {
      return NextResponse.redirect(new URL('/auth/change-password', request.url))
    }
  }

  // Staff routes - staff access only
  if (isStaffRoute) {
    if (!token) {
      return NextResponse.redirect(new URL('/auth/signin', request.url))
    }

    const userRole = (token as any).role
    if (!STAFF_ROLES.includes(userRole)) {
      return NextResponse.redirect(new URL('/portal', request.url))
    }

    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Staff-only pages
    '/dashboard/:path*',
    '/open-jobs/:path*',
    '/prebilling-jobs/:path*',
    '/shipments/:path*',
    '/shipment-track/:path*',
    '/batch-import/:path*',
    '/invoices/:path*',
    '/rates/:path*',
    '/settings/:path*',
    // Customer portal pages
    '/portal/:path*',
    // API routes
    '/api/admin/:path*',
    '/api/orders/:path*',
    '/api/portal/:path*',
    '/api/uploads/:path*',
    // Auth pages
    '/auth/change-password',
  ],
}

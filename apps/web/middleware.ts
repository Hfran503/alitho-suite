import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const STAFF_ROLES = ['full_admin', 'admin', 'customer_service', 'accounting', 'estimators', 'logistics']
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
    if (
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/api/orders') ||
      pathname.startsWith('/api/uploads')
    ) {
      return NextResponse.redirect(new URL('/auth/change-password', request.url))
    }
  }

  // Dashboard routes - staff access only
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/orders') || pathname.startsWith('/api/uploads')) {
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
    '/dashboard/:path*',
    '/portal/:path*',
    '/api/orders/:path*',
    '/api/portal/:path*',
    '/api/uploads/:path*',
    '/auth/change-password',
  ],
}

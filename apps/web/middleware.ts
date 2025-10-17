import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  // Check if user needs to change password
  if (token && (token as any).passwordResetRequired) {
    // Allow access to the change password page and API
    if (
      request.nextUrl.pathname === '/auth/change-password' ||
      request.nextUrl.pathname === '/api/user/force-change-password' ||
      request.nextUrl.pathname === '/api/auth/signout' ||
      request.nextUrl.pathname.startsWith('/api/auth/session')
    ) {
      return NextResponse.next()
    }

    // Redirect to change password page for all other protected routes
    if (
      request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/api/orders') ||
      request.nextUrl.pathname.startsWith('/api/uploads')
    ) {
      return NextResponse.redirect(new URL('/auth/change-password', request.url))
    }
  }

  // Check authentication for protected routes
  const protectedPaths = ['/dashboard', '/api/orders', '/api/uploads']
  const isProtectedPath = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))

  if (isProtectedPath && !token) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/orders/:path*',
    '/api/uploads/:path*',
    '/auth/change-password',
  ],
}

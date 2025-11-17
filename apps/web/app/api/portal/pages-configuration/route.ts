import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db as prisma } from '@repo/database'
import { isCustomerRole } from '@/lib/roles'

/**
 * GET - Fetch portal pages visible to the current customer user
 * Filters based on visibilityMode and checks:
 * - "all": All customers can see
 * - "pace_ids": Only customers with matching PACE Customer ID
 * - "user_ids": Only specific user IDs
 * - "user_emails": Only specific user emails
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify customer role
    const userRole = (session.user as any).role
    if (!isCustomerRole(userRole)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get user with PACE Customer ID and membership
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        paceCustomerId: true,
        memberships: {
          include: {
            tenant: true,
          },
        },
      },
    })

    if (!user || !user.memberships[0]) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const tenantId = user.memberships[0].tenantId

    // Get all active portal page configurations for tenant
    const allPages = await prisma.portalPageConfiguration.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: { order: 'asc' },
    })

    // Filter pages based on visibility mode
    const visiblePages = allPages.filter((page: (typeof allPages)[number]) => {
      switch (page.visibilityMode) {
        case 'all':
          // Everyone can see this page
          return true

        case 'pace_ids':
          // Check if user has PACE Customer ID and it's in the allowed list
          if (!user.paceCustomerId) return false
          return page.allowedPaceCustomerIds.includes(user.paceCustomerId)

        case 'user_ids':
          // Check if user's ID is in the allowed list
          return page.allowedUserIds.includes(user.id)

        case 'user_emails':
          // Check if user's email is in the allowed list
          return page.allowedUserEmails.includes(user.email)

        default:
          // Unknown visibility mode - default to hiding
          return false
      }
    })

    // Return with no-cache headers to ensure fresh data
    return NextResponse.json(
      { pageConfigs: visiblePages },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching portal page configurations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch portal page configurations' },
      { status: 500 }
    )
  }
}

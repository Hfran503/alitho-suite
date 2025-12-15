import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/authorization'
import { db as prisma } from '@repo/database'

const DEFAULT_PORTAL_PAGES = [
  {
    pageKey: 'portal-welcome',
    label: 'Welcome',
    href: '/portal',
    icon: 'home',
    order: 0,
    isActive: true,
    description: 'Portal welcome page',
    visibilityMode: 'all',
  },
  {
    pageKey: 'portal-shipments',
    label: 'Shipments',
    href: '/portal/shipments',
    icon: 'truck',
    order: 1,
    isActive: true,
    description: 'Track shipments',
    visibilityMode: 'all',
  },
  {
    pageKey: 'portal-orders',
    label: 'Orders',
    href: '/portal/orders',
    icon: 'package',
    order: 2,
    isActive: true,
    description: 'View and manage orders',
    visibilityMode: 'all',
  },
  {
    pageKey: 'portal-orders-new',
    label: 'Create Order',
    href: '/portal/orders/new',
    icon: 'plus',
    order: 3,
    isActive: true,
    description: 'Create a new order',
    visibilityMode: 'all',
  },
  {
    pageKey: 'gcu-custom-envelope-new-order',
    label: 'GCU Custom Envelope Orders',
    href: '/portal/gcu-custom-envelope-new-order',
    icon: 'document',
    order: 4,
    isActive: true,
    description: 'Generate custom envelope order PDFs',
    visibilityMode: 'pace_ids', // Restrict to specific PACE Customer IDs
    allowedPaceCustomerIds: ['00001085'], // GCU customer
  },
]

// POST - Initialize default portal pages for tenant (Admin only)
export async function POST(_req: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.error
    }

    const session = authResult.session

    // Get user's tenant
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: {
        memberships: true,
      },
    })

    if (!user || !user.memberships[0]) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const tenantId = user.memberships[0].tenantId

    // Check if portal pages already exist
    const existing = await prisma.portalPageConfiguration.findFirst({
      where: { tenantId },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Portal pages already initialized for this tenant' },
        { status: 409 }
      )
    }

    // Create default portal pages in a transaction
    const createdPages = await prisma.$transaction(
      DEFAULT_PORTAL_PAGES.map((page) =>
        prisma.portalPageConfiguration.create({
          data: {
            ...page,
            allowedPaceCustomerIds: page.allowedPaceCustomerIds || [],
            allowedUserIds: [],
            allowedUserEmails: [],
            tenantId,
          },
        })
      )
    )

    return NextResponse.json({
      success: true,
      message: `Created ${createdPages.length} default portal pages`,
      pageConfigs: createdPages,
    })
  } catch (error) {
    console.error('Error initializing portal pages:', error)
    return NextResponse.json(
      { error: 'Failed to initialize portal pages' },
      { status: 500 }
    )
  }
}

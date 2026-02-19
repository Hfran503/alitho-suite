import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db as prisma } from '@repo/database'

// Default menu structure
const DEFAULT_MENU_ITEMS = [
  {
    menuKey: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'home',
    order: 0,
    visibleToRoles: ['full_admin', 'admin', 'customer_service', 'estimators', 'logistics', 'accounting']
  },
  {
    menuKey: 'shipments',
    label: 'Shipments',
    href: '/shipments',
    icon: 'package',
    order: 1,
    visibleToRoles: ['full_admin', 'admin', 'customer_service', 'logistics']
  },
  {
    menuKey: 'shipments-all',
    label: 'All Shipments',
    href: '/shipments',
    icon: 'list',
    parentKey: 'shipments',
    order: 0,
    visibleToRoles: ['full_admin', 'admin', 'customer_service', 'logistics']
  },
  {
    menuKey: 'shipments-manual-label',
    label: 'Manual Label',
    href: '/shipments/manual-label',
    icon: 'plus',
    parentKey: 'shipments',
    order: 1,
    visibleToRoles: ['full_admin', 'admin', 'customer_service']
  },
  {
    menuKey: 'shipments-track',
    label: 'Track Labels',
    href: '/shipment-track',
    icon: 'search',
    parentKey: 'shipments',
    order: 2,
    visibleToRoles: ['full_admin', 'admin', 'customer_service', 'logistics']
  },
  {
    menuKey: 'batch-import',
    label: 'Batch Import',
    href: '/batch-import',
    icon: 'upload',
    order: 2,
    visibleToRoles: ['full_admin', 'admin']
  },
  {
    menuKey: 'batch-import-new',
    label: 'New Import',
    href: '/batch-import',
    icon: 'plus',
    parentKey: 'batch-import',
    order: 0,
    visibleToRoles: ['full_admin', 'admin']
  },
  {
    menuKey: 'batch-import-track',
    label: 'Track Batches',
    href: '/batch-import/batches',
    icon: 'search',
    parentKey: 'batch-import',
    order: 1,
    visibleToRoles: ['full_admin', 'admin']
  },
  {
    menuKey: 'rates',
    label: 'Shipping Rates',
    href: '/rates/estimate',
    icon: 'dollar',
    order: 3,
    visibleToRoles: ['full_admin', 'admin', 'estimators', 'customer_service']
  },
  {
    menuKey: 'rate-estimates',
    label: 'Shipping Estimate',
    href: '/rates/estimate',
    icon: 'calculator',
    parentKey: 'rates',
    order: 0,
    visibleToRoles: ['full_admin', 'admin', 'estimators']
  },
  {
    menuKey: 'quote-requests',
    label: 'Quote Requests',
    href: '/rates/quote-requests',
    icon: 'document',
    parentKey: 'rates',
    order: 1,
    visibleToRoles: ['full_admin', 'admin', 'customer_service', 'estimators']
  },
  {
    menuKey: 'invoice-integrations',
    label: 'Invoice Integrations',
    href: '/netsuite/Invoices',
    icon: 'document',
    order: 4,
    visibleToRoles: ['full_admin', 'admin', 'accounting']
  },
  {
    menuKey: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: 'settings',
    order: 5,
    visibleToRoles: ['full_admin', 'admin']
  }
]

// POST - Initialize default menu configuration for a tenant
export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user and membership
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        memberships: {
          include: { tenant: true }
        }
      }
    })

    if (!user || !user.memberships[0]) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const membership = user.memberships[0]
    const tenantId = membership.tenantId

    // Only full_admin and admin can initialize menu
    if (membership.role !== 'full_admin' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if menu already exists
    const existingMenus = await prisma.menuConfiguration.count({
      where: { tenantId }
    })

    if (existingMenus > 0) {
      return NextResponse.json(
        { error: 'Menu already initialized. Delete existing menus first.' },
        { status: 400 }
      )
    }

    // Create all default menu items
    const menuConfigs = await prisma.menuConfiguration.createMany({
      data: DEFAULT_MENU_ITEMS.map(item => ({
        ...item,
        tenantId
      }))
    })

    return NextResponse.json({
      success: true,
      count: menuConfigs.count
    }, { status: 201 })
  } catch (error) {
    console.error('Error initializing menu configuration:', error)
    return NextResponse.json(
      { error: 'Failed to initialize menu configuration' },
      { status: 500 }
    )
  }
}

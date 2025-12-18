import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db as prisma } from '@repo/database'

interface NotificationRecipients {
  customer: boolean
  internal: boolean
}

interface StorefrontNotifications {
  orderPlaced: NotificationRecipients
  orderApproved: NotificationRecipients
  orderShipped: NotificationRecipients
  orderDelivered: NotificationRecipients
  orderCancelled: NotificationRecipients
  pickOrderCreated: NotificationRecipients
  pickOrderStarted: NotificationRecipients
  pickOrderCompleted: NotificationRecipients
  pickOrderCancelled: NotificationRecipients
}

interface WarehouseStorefrontConfig {
  emailNotificationsEnabled: boolean
  internalNotificationEmails: string[]
  notifications: StorefrontNotifications
}

interface ModuleSettings {
  warehouseStorefront?: WarehouseStorefrontConfig
}

const defaultNotifications: StorefrontNotifications = {
  orderPlaced: { customer: true, internal: true },
  orderApproved: { customer: true, internal: false },
  orderShipped: { customer: true, internal: false },
  orderDelivered: { customer: true, internal: false },
  orderCancelled: { customer: true, internal: true },
  pickOrderCreated: { customer: false, internal: true },
  pickOrderStarted: { customer: true, internal: false },
  pickOrderCompleted: { customer: true, internal: true },
  pickOrderCancelled: { customer: true, internal: true },
}

// GET - Fetch module settings for tenant
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const tenant = user.memberships[0].tenant
    const metadata = (tenant.metadata as Record<string, any>) || {}
    const moduleSettings = metadata.modules || {}

    return NextResponse.json(
      { data: moduleSettings },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching module settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch module settings' },
      { status: 500 }
    )
  }
}

// PUT - Update module settings
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    if (membership.role !== 'full_admin' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as ModuleSettings

    const tenant = membership.tenant
    const currentMetadata = (tenant.metadata as Record<string, any>) || {}
    const currentModules = currentMetadata.modules || {}

    const updatedModules: Record<string, any> = { ...currentModules }

    // Handle warehouse/storefront config
    if (body.warehouseStorefront) {
      updatedModules.warehouseStorefront = {
        emailNotificationsEnabled: body.warehouseStorefront.emailNotificationsEnabled ?? false,
        internalNotificationEmails: body.warehouseStorefront.internalNotificationEmails || [],
        notifications: body.warehouseStorefront.notifications || defaultNotifications,
      }
    }

    const updatedMetadata = {
      ...currentMetadata,
      modules: updatedModules,
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: updatedMetadata },
    })

    return NextResponse.json({
      success: true,
      data: updatedModules
    })
  } catch (error) {
    console.error('Error updating module settings:', error)
    return NextResponse.json(
      { error: 'Failed to update module settings' },
      { status: 500 }
    )
  }
}

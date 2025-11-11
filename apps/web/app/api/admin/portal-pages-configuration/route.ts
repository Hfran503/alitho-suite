import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/authorization'
import { db as prisma } from '@repo/database'

// GET - Fetch all portal page configurations for tenant (Admin only)
export async function GET(_req: NextRequest) {
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

    // Get all portal page configurations for tenant
    const pageConfigs = await prisma.portalPageConfiguration.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({ pageConfigs })
  } catch (error) {
    console.error('Error fetching portal page configurations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch portal page configurations' },
      { status: 500 }
    )
  }
}

// POST - Create new portal page configuration (Admin only)
export async function POST(req: NextRequest) {
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
    const body = await req.json()

    const {
      pageKey,
      label,
      href,
      icon,
      order,
      isActive,
      description,
      visibilityMode,
      allowedPaceCustomerIds,
      allowedUserIds,
      allowedUserEmails,
    } = body

    // Validate required fields
    if (!pageKey || !label || !href) {
      return NextResponse.json(
        { error: 'Missing required fields: pageKey, label, href' },
        { status: 400 }
      )
    }

    // Check if page key already exists for this tenant
    const existing = await prisma.portalPageConfiguration.findUnique({
      where: {
        tenantId_pageKey: {
          tenantId,
          pageKey,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Page key already exists for this tenant' },
        { status: 409 }
      )
    }

    // Create portal page configuration
    const pageConfig = await prisma.portalPageConfiguration.create({
      data: {
        pageKey,
        label,
        href,
        icon: icon || null,
        order: order || 0,
        isActive: isActive !== undefined ? isActive : true,
        description: description || null,
        visibilityMode: visibilityMode || 'all',
        allowedPaceCustomerIds: allowedPaceCustomerIds || [],
        allowedUserIds: allowedUserIds || [],
        allowedUserEmails: allowedUserEmails || [],
        tenantId,
      },
    })

    return NextResponse.json({ pageConfig }, { status: 201 })
  } catch (error) {
    console.error('Error creating portal page configuration:', error)
    return NextResponse.json(
      { error: 'Failed to create portal page configuration' },
      { status: 500 }
    )
  }
}

// PUT - Bulk update portal page configurations (Admin only)
export async function PUT(req: NextRequest) {
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
    const { pageConfigs } = await req.json()

    if (!Array.isArray(pageConfigs)) {
      return NextResponse.json(
        { error: 'pageConfigs must be an array' },
        { status: 400 }
      )
    }

    // Update all configurations in a transaction
    await prisma.$transaction(
      pageConfigs.map((config: any) =>
        prisma.portalPageConfiguration.update({
          where: {
            tenantId_pageKey: {
              tenantId,
              pageKey: config.pageKey,
            },
          },
          data: {
            label: config.label,
            href: config.href,
            icon: config.icon,
            order: config.order,
            isActive: config.isActive,
            description: config.description,
            visibilityMode: config.visibilityMode,
            allowedPaceCustomerIds: config.allowedPaceCustomerIds,
            allowedUserIds: config.allowedUserIds,
            allowedUserEmails: config.allowedUserEmails,
          },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error bulk updating portal page configurations:', error)
    return NextResponse.json(
      { error: 'Failed to update portal page configurations' },
      { status: 500 }
    )
  }
}

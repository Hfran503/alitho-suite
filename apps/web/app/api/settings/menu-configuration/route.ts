import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db as prisma } from '@repo/database'

// GET - Fetch all menu configurations for tenant
export async function GET(_req: NextRequest) {
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

    const tenantId = user.memberships[0].tenantId
    const userRole = user.memberships[0].role

    // Get all menu configurations for tenant
    const menuConfigs = await prisma.menuConfiguration.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' }
    })

    // Filter menu items by user role
    const visibleMenuConfigs = menuConfigs.filter(
      (config: typeof menuConfigs[number]) => config.isActive && config.visibleToRoles.includes(userRole)
    )

    // Return with no-cache headers to ensure fresh data
    return NextResponse.json(
      { menuConfigs: visibleMenuConfigs },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching menu configurations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch menu configurations' },
      { status: 500 }
    )
  }
}

// POST - Create new menu configuration
export async function POST(req: NextRequest) {
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

    // Only full_admin and admin can modify menu
    if (membership.role !== 'full_admin' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { menuKey, label, href, icon, parentKey, order, visibleToRoles, isActive } = body

    // Validate required fields
    if (!menuKey || !label || !href || !visibleToRoles) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const menuConfig = await prisma.menuConfiguration.create({
      data: {
        tenantId,
        menuKey,
        label,
        href,
        icon,
        parentKey,
        order: order || 0,
        visibleToRoles,
        isActive: isActive !== undefined ? isActive : true
      }
    })

    return NextResponse.json({ menuConfig }, { status: 201 })
  } catch (error) {
    console.error('Error creating menu configuration:', error)
    return NextResponse.json(
      { error: 'Failed to create menu configuration' },
      { status: 500 }
    )
  }
}

// PUT - Bulk update menu configurations (for reordering and role changes)
export async function PUT(req: NextRequest) {
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

    // Only full_admin and admin can modify menu
    if (membership.role !== 'full_admin' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { menuConfigs } = body

    if (!Array.isArray(menuConfigs)) {
      return NextResponse.json(
        { error: 'menuConfigs must be an array' },
        { status: 400 }
      )
    }

    // Update all configurations in a transaction
    await prisma.$transaction(
      menuConfigs.map((config: any) =>
        prisma.menuConfiguration.update({
          where: {
            tenantId_menuKey: {
              tenantId,
              menuKey: config.menuKey
            }
          },
          data: {
            label: config.label,
            href: config.href,
            icon: config.icon,
            parentKey: config.parentKey,
            order: config.order,
            visibleToRoles: config.visibleToRoles,
            isActive: config.isActive
          }
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating menu configurations:', error)
    return NextResponse.json(
      { error: 'Failed to update menu configurations' },
      { status: 500 }
    )
  }
}

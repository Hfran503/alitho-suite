import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db as prisma } from '@repo/database'

// GET - Fetch all menu configurations for tenant
export async function GET(req: NextRequest) {
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

    // Check if this is an admin viewing the settings page (for configuration)
    const isAdmin = userRole === 'full_admin' || userRole === 'admin'
    const { searchParams } = new URL(req.url)
    const forConfiguration = searchParams.get('forConfiguration') === 'true'

    // If admin is viewing for configuration, return all menu items unfiltered
    if (isAdmin && forConfiguration) {
      return NextResponse.json(
        { menuConfigs },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      )
    }

    // Otherwise, filter menu items based on visibility mode
    const visibleMenuConfigs = menuConfigs.filter((config: typeof menuConfigs[number]) => {
      if (!config.isActive) return false

      switch (config.visibilityMode) {
        case 'all':
          // Visible to all users
          return true
        case 'specific_users':
        case 'user_ids': // Backward compatibility
          // Only specific user IDs
          return config.allowedUserIds.includes(user.id)
        case 'user_emails': // Backward compatibility
          // Only specific user emails
          return config.allowedUserEmails.includes(user.email)
        case 'role':
        default:
          // Role-based (default behavior)
          return config.visibleToRoles.includes(userRole)
      }
    })

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
    const {
      menuKey,
      label,
      href,
      icon,
      parentKey,
      order,
      visibleToRoles,
      isActive,
      visibilityMode,
      allowedUserIds,
      allowedUserEmails
    } = body

    // Validate required fields
    if (!menuKey || !label || !href) {
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
        visibleToRoles: visibleToRoles || [],
        isActive: isActive !== undefined ? isActive : true,
        visibilityMode: visibilityMode || 'role',
        allowedUserIds: allowedUserIds || [],
        allowedUserEmails: allowedUserEmails || []
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
            isActive: config.isActive,
            visibilityMode: config.visibilityMode || 'role',
            allowedUserIds: config.allowedUserIds || [],
            allowedUserEmails: config.allowedUserEmails || []
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

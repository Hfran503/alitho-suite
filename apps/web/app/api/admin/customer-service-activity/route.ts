import { NextResponse } from 'next/server'
import { db } from '@repo/database'
import { requireAdmin } from '@/lib/authorization'
import { USER_ROLES } from '@/lib/roles'

interface UserFromDb {
  id: string
  email: string
  name: string | null
  image: string | null
  createdAt: Date
  memberships: Array<{
    id: string
    role: string
    tenant: { id: string; name: string }
  }>
  sessions: Array<{
    updatedAt: Date
  }>
}

interface UserWithActivity {
  id: string
  email: string
  name: string | null
  image: string | null
  createdAt: Date
  memberships: Array<{
    id: string
    role: string
    tenant: { id: string; name: string }
  }>
  lastActivity: string | null
  isInactive: boolean
  daysSinceActivity: number | null
}

// GET /api/admin/customer-service-activity - Get all Customer Service users with activity
export async function GET() {
  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.error
    }

    // Find all users who have the customer_service role
    const users = await db.user.findMany({
      where: {
        memberships: {
          some: {
            role: USER_ROLES.CUSTOMER_SERVICE,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        createdAt: true,
        memberships: {
          where: {
            role: USER_ROLES.CUSTOMER_SERVICE,
          },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        sessions: {
          where: {
            expires: {
              gt: new Date(),
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: 1,
          select: {
            updatedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Calculate inactivity and transform data
    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    const usersWithActivity: UserWithActivity[] = (users as UserFromDb[]).map((user) => {
      let lastActivity: string | null = null
      let isInactive = false
      let daysSinceActivity: number | null = null

      if (user.sessions[0]?.updatedAt) {
        lastActivity = user.sessions[0].updatedAt.toISOString()
        const lastActivityDate = new Date(user.sessions[0].updatedAt)
        isInactive = lastActivityDate < threeDaysAgo
        daysSinceActivity = Math.floor(
          (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      } else {
        // No session = inactive
        isInactive = true
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        createdAt: user.createdAt,
        memberships: user.memberships,
        lastActivity,
        isInactive,
        daysSinceActivity,
      }
    })

    // Sort by inactivity (inactive users first) then by days since activity
    usersWithActivity.sort((a, b) => {
      if (a.isInactive !== b.isInactive) {
        return a.isInactive ? -1 : 1
      }
      if (a.daysSinceActivity === null) return -1
      if (b.daysSinceActivity === null) return 1
      return b.daysSinceActivity - a.daysSinceActivity
    })

    // Calculate summary stats
    const totalUsers = usersWithActivity.length
    const inactiveUsers = usersWithActivity.filter((u: UserWithActivity) => u.isInactive).length
    const activeUsers = totalUsers - inactiveUsers

    return NextResponse.json({
      users: usersWithActivity,
      stats: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
      },
    })
  } catch (error) {
    console.error('Error fetching customer service activity:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

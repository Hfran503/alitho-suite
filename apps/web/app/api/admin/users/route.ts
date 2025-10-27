import { NextResponse } from 'next/server'
import { db } from '@repo/database'
import { requireAdmin } from '@/lib/authorization'

// GET /api/admin/users - Get all users
export async function GET() {
  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.error
    }

    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        paceCustomerId: true,
        createdAt: true,
        memberships: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

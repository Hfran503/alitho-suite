import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/database'
import { requireAdmin } from '@/lib/authorization'

// GET /api/admin/users/[userId] - Get user details
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.error
    }

    const { userId } = await params

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
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
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/users/[userId] - Update user info and roles
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.error
    }

    const { userId } = await params
    const body = await request.json()
    const { name, email, paceCustomerId, memberships } = body

    // Update user basic info
    await db.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        paceCustomerId: paceCustomerId || null,
      },
    })

    // Update membership roles if provided
    if (memberships && Array.isArray(memberships)) {
      for (const membership of memberships) {
        await db.membership.update({
          where: { id: membership.id },
          data: { role: membership.role },
        })
      }
    }

    // Fetch updated user with memberships
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
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
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/users/[userId] - Delete user (optional)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.error
    }

    const session = authResult.session
    const { userId } = await params

    // Prevent user from deleting themselves
    if (session.user.id === userId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // Delete user (cascade will handle related records)
    await db.user.delete({
      where: { id: userId },
    })

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

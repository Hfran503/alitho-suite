import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// DELETE /api/admin/users/[userId]/sessions - Delete all sessions for a user (sign out all)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Add role check to ensure only admins can access this

    const { userId } = await params

    // Prevent admin from signing out themselves
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot sign out all your own sessions. Use the logout button instead.' },
        { status: 400 }
      )
    }

    // Get user info before deleting sessions
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Count sessions before deletion
    const sessionCount = await db.session.count({
      where: { userId },
    })

    // Delete all sessions for this user
    await db.session.deleteMany({
      where: { userId },
    })

    // TODO: Create audit log entry
    // await db.auditLog.create({
    //   data: {
    //     action: 'user.sessions.terminated_all',
    //     entityType: 'user',
    //     entityId: userId,
    //     userId: session.user.id,
    //     actorName: session.user.name || undefined,
    //     actorEmail: session.user.email || undefined,
    //     tenantId: 'tenant-id-here',
    //     metadata: {
    //       targetUserId: userId,
    //       targetUserEmail: targetUser.email,
    //       sessionsTerminated: sessionCount,
    //     },
    //   },
    // })

    return NextResponse.json({
      message: 'All sessions terminated successfully',
      terminatedUser: targetUser,
      sessionsTerminated: sessionCount,
    })
  } catch (error) {
    console.error('Error deleting user sessions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

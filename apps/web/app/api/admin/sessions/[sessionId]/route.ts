import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// DELETE /api/admin/sessions/[sessionId] - Delete a specific session (sign out user)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Add role check to ensure only admins can access this

    const { sessionId } = await params

    // Get session info before deleting for audit log
    const targetSession = await db.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Prevent admin from signing out themselves (could be confusing)
    if (targetSession.userId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot sign out your own session. Use the logout button instead.' },
        { status: 400 }
      )
    }

    // Delete the session
    await db.session.delete({
      where: { id: sessionId },
    })

    // TODO: Create audit log entry
    // await db.auditLog.create({
    //   data: {
    //     action: 'session.terminated',
    //     entityType: 'session',
    //     entityId: sessionId,
    //     userId: session.user.id,
    //     actorName: session.user.name || undefined,
    //     actorEmail: session.user.email || undefined,
    //     tenantId: 'tenant-id-here',
    //     metadata: {
    //       targetUserId: targetSession.userId,
    //       targetUserEmail: targetSession.user.email,
    //     },
    //   },
    // })

    return NextResponse.json({
      message: 'Session terminated successfully',
      terminatedUser: {
        id: targetSession.user.id,
        email: targetSession.user.email,
        name: targetSession.user.name,
      },
    })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

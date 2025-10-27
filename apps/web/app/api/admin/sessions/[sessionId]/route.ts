import { NextResponse } from 'next/server'
import { db } from '@repo/database'
import { requireAdmin } from '@/lib/authorization'

// DELETE /api/admin/sessions/[sessionId] - Delete a specific session (sign out user)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.error
    }

    const session = authResult.session
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

    // Get the current user's active sessions to prevent deleting their current session
    const currentUserSessions = await db.session.findMany({
      where: {
        userId: session.user.id,
        expires: { gt: new Date() },
      },
      orderBy: { expires: 'desc' },
      take: 1, // Get the most recent session (should be the current one)
    })

    // Prevent admin from signing out their current active session
    // Allow deleting old sessions even if they belong to the current user
    if (currentUserSessions.length > 0 && targetSession.id === currentUserSessions[0].id) {
      return NextResponse.json(
        { error: 'You cannot sign out your current session. Use the logout button instead.' },
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

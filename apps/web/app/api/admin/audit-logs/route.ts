import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/admin/audit-logs - Get audit logs with filtering
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant and check admin role
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Check for admin role (full_admin or admin)
    if (!['full_admin', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const action = searchParams.get('action') || undefined
    const entityType = searchParams.get('entityType') || undefined
    const entityId = searchParams.get('entityId') || undefined
    const paceTransactionId = searchParams.get('paceTransactionId') || undefined
    const actorEmail = searchParams.get('actorEmail') || undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    // Build where clause
    const where: any = {
      tenantId: membership.tenantId,
      // Hide tracking_update actions from audit logs
      NOT: {
        action: { contains: 'tracking_update', mode: 'insensitive' }
      }
    }

    if (action) {
      where.action = { contains: action, mode: 'insensitive' }
    }
    if (entityType) {
      where.entityType = { contains: entityType, mode: 'insensitive' }
    }
    if (entityId) {
      where.entityId = entityId
    }
    if (paceTransactionId) {
      where.paceTransactionId = paceTransactionId
    }
    if (actorEmail) {
      where.actorEmail = { contains: actorEmail, mode: 'insensitive' }
    }
    if (startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(startDate) }
    }
    if (endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(endDate) }
    }

    // Get total count
    const total = await db.auditLog.count({ where })

    // Get paginated results
    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }
      }
    })
  } catch (error) {
    console.error('Audit logs error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}

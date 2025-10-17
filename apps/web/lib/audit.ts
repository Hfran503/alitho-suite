import { db } from '@repo/database'
import { headers } from 'next/headers'

export async function createAuditLog({
  action,
  entityType,
  entityId,
  userId,
  tenantId,
  metadata,
  orderId,
}: {
  action: string
  entityType: string
  entityId?: string
  userId?: string
  tenantId: string
  metadata?: Record<string, any>
  orderId?: string
}) {
  const headersList = await headers()
  const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
  const userAgent = headersList.get('user-agent') || 'unknown'

  // Get user info if userId provided
  let actorName: string | undefined
  let actorEmail: string | undefined

  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })
    actorName = user?.name || undefined
    actorEmail = user?.email || undefined
  }

  return await db.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      userId,
      actorName,
      actorEmail,
      ipAddress,
      userAgent,
      metadata,
      tenantId,
      orderId,
    },
  })
}

export async function getAuditLogs({
  tenantId,
  entityType,
  entityId,
  userId,
  limit = 50,
  offset = 0,
}: {
  tenantId: string
  entityType?: string
  entityId?: string
  userId?: string
  limit?: number
  offset?: number
}) {
  return await db.auditLog.findMany({
    where: {
      tenantId,
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(userId && { userId }),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    skip: offset,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  })
}

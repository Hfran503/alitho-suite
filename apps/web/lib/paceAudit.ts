import { db } from '@repo/database'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { headers } from 'next/headers'
import { randomUUID } from 'crypto'

export interface PaceAuditParams {
  action: string           // e.g., "pace.shipment.update", "pace.carton.create"
  entityType: string       // e.g., "JobShipment", "Carton"
  entityId?: string        // PACE object ID
  tenantId: string
  metadata?: Record<string, any>  // Request body, response, etc.
}

/**
 * Generates a transaction ID and logs a PACE transaction to the audit log.
 * Returns the txnId to be passed to PACE API calls.
 *
 * Usage:
 * ```
 * const txnId = await logPaceTransaction({
 *   action: 'pace.shipment.update',
 *   entityType: 'JobShipment',
 *   entityId: '147237',
 *   tenantId: membership.tenantId,
 *   metadata: { requestBody, endpoint }
 * })
 *
 * // Pass txnId to PACE
 * await fetch(`${paceUrl}/UpdateObject/updateJobShipment?txnId=${txnId}`, ...)
 * ```
 */
export async function logPaceTransaction(params: PaceAuditParams): Promise<string> {
  const { action, entityType, entityId, tenantId, metadata } = params

  const session = await getServerSession(authOptions)
  const headersList = await headers()

  // Generate UUID for cross-referencing with PACE
  const txnId = randomUUID()

  await db.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      paceTransactionId: txnId,
      userId: session?.user?.id,
      actorName: session?.user?.name,
      actorEmail: session?.user?.email,
      ipAddress: headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null,
      userAgent: headersList.get('user-agent') || null,
      metadata,
      tenantId,
    }
  })

  return txnId
}

/**
 * Updates an existing audit log entry with PACE response data.
 * Call this after the PACE API call completes.
 */
export async function updatePaceAuditWithResponse(
  txnId: string,
  response: {
    success: boolean
    paceResponse?: any
    error?: string
  }
) {
  await db.auditLog.updateMany({
    where: { paceTransactionId: txnId },
    data: {
      metadata: {
        // Merge with existing metadata
        paceResponse: response.paceResponse,
        success: response.success,
        error: response.error,
      }
    }
  })
}

/**
 * Generates a txnId without logging (for cases where you want to log after the PACE call)
 */
export function generatePaceTransactionId(): string {
  return randomUUID()
}

/**
 * Logs a PACE transaction after the fact (when you already have the txnId)
 */
export async function logPaceTransactionWithId(
  txnId: string,
  params: PaceAuditParams & { paceResponse?: any; success?: boolean; error?: string }
): Promise<void> {
  const { action, entityType, entityId, tenantId, metadata, paceResponse, success, error } = params

  const session = await getServerSession(authOptions)
  const headersList = await headers()

  await db.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      paceTransactionId: txnId,
      userId: session?.user?.id,
      actorName: session?.user?.name,
      actorEmail: session?.user?.email,
      ipAddress: headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null,
      userAgent: headersList.get('user-agent') || null,
      metadata: {
        ...metadata,
        paceResponse,
        success,
        error,
      },
      tenantId,
    }
  })
}

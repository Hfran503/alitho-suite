import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

/**
 * POST /api/batch-import/[id]/void-all
 * Void all successful labels in a batch
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: batchId } = await params

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!membership?.tenantId) {
      return NextResponse.json({ error: 'User has no tenant' }, { status: 400 })
    }

    // Verify batch belongs to user's tenant
    const batch = await db.batchImport.findFirst({
      where: {
        id: batchId,
        tenantId: membership.tenantId,
      },
      include: {
        rows: {
          where: {
            status: 'SUCCESS',
          },
          orderBy: {
            rowNumber: 'asc',
          },
        },
      },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    const successRows = batch.rows
    if (successRows.length === 0) {
      return NextResponse.json({ error: 'No successful labels to void' }, { status: 400 })
    }

    console.log(`[VOID-ALL] Voiding ${successRows.length} labels from batch ${batchId}`)

    // Get ShipStation client for this tenant
    const { getShipStationClient } = await import('@/lib/shipstation')

    let shipStationClient
    try {
      shipStationClient = await getShipStationClient(membership.tenantId)
    } catch (error: any) {
      return NextResponse.json(
        { error: 'ShipStation not configured for this tenant', details: error.message },
        { status: 400 }
      )
    }

    // Get PACE API credentials for deleting shipments/cartons
    const { getPaceApiCredentials } = await import('@repo/shared')
    let paceCredentials
    try {
      paceCredentials = await getPaceApiCredentials()
    } catch (error) {
      console.warn('[VOID-ALL] PACE not configured, skipping PACE cleanup')
    }

    // Collect unique PACE shipment IDs and carton IDs to delete
    const paceShipmentIds = new Set<number>()
    const paceCartonIds = new Set<number>()

    successRows.forEach(r => {
      if (r.paceJobShipmentId) paceShipmentIds.add(r.paceJobShipmentId)
      if (r.paceCartonId) paceCartonIds.add(r.paceCartonId)
    })

    // Void all labels in parallel batches
    const CONCURRENCY_LIMIT = 10 // Process 10 labels at a time
    const voidResults = []
    let voidedCount = 0
    let failedCount = 0

    console.log(`[VOID-ALL] 🚀 Voiding ${successRows.length} labels with concurrency limit of ${CONCURRENCY_LIMIT}`)

    // Process labels in parallel batches
    for (let i = 0; i < successRows.length; i += CONCURRENCY_LIMIT) {
      const batch = successRows.slice(i, i + CONCURRENCY_LIMIT)
      console.log(`[VOID-ALL] Processing batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1}/${Math.ceil(successRows.length / CONCURRENCY_LIMIT)} (${batch.length} labels)`)

      // Process this batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(async (row) => {
          // Void the label using ShipStation client
          if (!row.shipstationLabelId) {
            return {
              rowId: row.id,
              rowNumber: row.rowNumber,
              success: false,
              error: 'No label ID available',
            }
          }

          try {
            await shipStationClient.voidLabel(row.shipstationLabelId)

            // Update row to mark as voided
            await db.batchImportRow.update({
              where: { id: row.id },
              data: {
                status: 'CANCELLED',
                errorMessage: 'Label voided by user (batch void all)',
                trackingNumber: null,
                labelUrl: null,
              },
            })

            // Also update ShippingLabel record to voided status
            if (row.trackingNumber) {
              try {
                const updateResult = await db.shippingLabel.updateMany({
                  where: {
                    trackingNumber: row.trackingNumber,
                    tenantId: membership.tenantId,
                  },
                  data: {
                    status: 'voided',
                  },
                })
                console.log(`[VOID-ALL] ✅ Updated ${updateResult.count} ShippingLabel(s) to voided for tracking ${row.trackingNumber}`)

                if (updateResult.count === 0) {
                  console.warn(`[VOID-ALL] ⚠️  No ShippingLabel found for tracking ${row.trackingNumber}`)
                }
              } catch (labelError) {
                console.error(`[VOID-ALL] ❌ Failed to update ShippingLabel:`, labelError)
              }
            }

            return {
              rowId: row.id,
              rowNumber: row.rowNumber,
              success: true,
            }
          } catch (error: any) {
            console.error(`[VOID-ALL] Failed to void label for row ${row.id}:`, error)
            return {
              rowId: row.id,
              rowNumber: row.rowNumber,
              success: false,
              error: error.message,
            }
          }
        })
      )

      // Process results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          voidResults.push(result.value)
          if (result.value.success) {
            voidedCount++
          } else {
            failedCount++
          }
        } else {
          failedCount++
          voidResults.push({
            rowId: 'unknown',
            rowNumber: 0,
            success: false,
            error: result.reason?.message || 'Unknown error',
          })
        }
      }

      console.log(`[VOID-ALL] Batch complete - Total voided: ${voidedCount}, failed: ${failedCount}`)
    }

    console.log(`[VOID-ALL] ✅ All batches complete - Voided ${voidedCount}/${successRows.length} labels`)

    // Delete PACE cartons and shipments
    if (paceCredentials) {
      const authHeader = 'Basic ' + Buffer.from(`${paceCredentials.username}:${paceCredentials.password}`).toString('base64')

      console.log(`[VOID-ALL] 🗑️  PACE Cleanup - Cartons: ${paceCartonIds.size}, Shipments: ${paceShipmentIds.size}`)

      // Step 1: Delete cartons in parallel (should cascade delete CartonContent)
      const cartonDeletions = Array.from(paceCartonIds).map(async (cartonId) => {
        try {
          const url = `${paceCredentials.url}/DeleteObject/DeleteObject?type=Carton&key=${cartonId}`
          const response = await fetch(url, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
            },
          })

          if (response.ok) {
            console.log(`[VOID-ALL] ✅ Carton ${cartonId} deleted`)
          } else {
            const responseText = await response.text()
            console.error(`[VOID-ALL] ❌ Carton ${cartonId} DELETE FAILED - Status: ${response.status}`, responseText)
          }
        } catch (error: any) {
          console.error(`[VOID-ALL] ❌ Exception deleting Carton ${cartonId}:`, error.message)
        }
      })

      // Wait for all carton deletions to complete
      await Promise.allSettled(cartonDeletions)
      console.log(`[VOID-ALL] ✅ Carton deletions complete`)

      // Step 2: Update and delete shipments in parallel
      const shipmentDeletions = Array.from(paceShipmentIds).map(async (shipmentId) => {
        try {
          // First, update the shipment to mark it as "planned" (not "actual")
          const updatePayload = {
            id: shipmentId,
            planned: true, // Mark as planned shipment
            trackingNumber: null, // Clear tracking number
          }

          const updateResponse = await fetch(`${paceCredentials.url}/UpdateObject/updateJobShipment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
            },
            body: JSON.stringify(updatePayload),
          })

          if (!updateResponse.ok) {
            const updateError = await updateResponse.text()
            console.error(`[VOID-ALL] ❌ Failed to update JobShipment ${shipmentId} to planned:`, updateError)
            return // Skip deletion if update fails
          }

          console.log(`[VOID-ALL] ✅ JobShipment ${shipmentId} updated to planned`)

          // Now delete the shipment
          const deleteUrl = `${paceCredentials.url}/DeleteObject/DeleteObject?type=JobShipment&key=${shipmentId}`

          const deleteResponse = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
            },
          })

          if (deleteResponse.ok) {
            console.log(`[VOID-ALL] ✅ JobShipment ${shipmentId} deleted successfully`)
          } else {
            const deleteError = await deleteResponse.text()
            console.error(`[VOID-ALL] ❌ Failed to delete JobShipment ${shipmentId}:`, deleteError)
          }
        } catch (error: any) {
          console.error(`[VOID-ALL] ❌ Exception processing JobShipment ${shipmentId}:`, error.message)
        }
      })

      // Wait for all shipment deletions to complete
      await Promise.allSettled(shipmentDeletions)
      console.log(`[VOID-ALL] 🏁 PACE cleanup completed`)
    } else {
      console.log('[VOID-ALL] ⚠️  PACE credentials not available, skipping PACE cleanup')
    }

    // Update batch stats
    if (voidedCount > 0 || failedCount > 0) {
      await db.batchImport.update({
        where: { id: batchId },
        data: {
          successfulRows: { decrement: voidedCount },
          voidedRows: { increment: voidedCount },
          failedRows: { increment: failedCount },
          processedRows: batch.successfulRows + batch.failedRows, // Keep same
        },
      })
    }

    // Build success message
    let message = `Voided ${voidedCount} of ${successRows.length} label(s)`
    if (failedCount > 0) {
      message += ` (${failedCount} failed to void)`
    }

    if (paceCredentials) {
      message += `. Deleted ${paceCartonIds.size} PACE carton(s) and ${paceShipmentIds.size} shipment(s).`
    }

    return NextResponse.json({
      success: true,
      message,
      voidedCount,
      failedCount,
      totalRows: successRows.length,
      paceCartonsDeleted: paceCartonIds.size,
      paceShipmentsDeleted: paceShipmentIds.size,
      details: voidResults.filter(r => !r.success), // Only return failures for debugging
      // Signal to frontend to clear shipments cache
      clearCache: true,
    })
  } catch (error: any) {
    console.error('[API] Batch void-all error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to void labels' },
      { status: 500 }
    )
  }
}

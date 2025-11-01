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

    successRows.forEach((r: typeof successRows[number]) => {
      if (r.paceJobShipmentId) paceShipmentIds.add(r.paceJobShipmentId)
      if (r.paceCartonId) paceCartonIds.add(r.paceCartonId)
    })

    // Void all labels in parallel batches
    const CONCURRENCY_LIMIT = 5 // Process 5 labels at a time (ShipStation limit: 200 req/min = ~3.3 req/sec)
    const MAX_VOID_RETRIES = 3 // Retry voiding up to 3 times for transient ShipStation errors
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
        batch.map(async (row: typeof successRows[number]) => {
          // Void the label using ShipStation client
          if (!row.shipstationLabelId) {
            return {
              rowId: row.id,
              rowNumber: row.rowNumber,
              success: false,
              error: 'No label ID available',
            }
          }

          // Retry void operation up to MAX_VOID_RETRIES times
          let lastError: any = null
          for (let attempt = 1; attempt <= MAX_VOID_RETRIES; attempt++) {
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
                  console.log(`[VOID-ALL] ✅ Updated ${updateResult.count} ShippingLabel(s) to voided for tracking ${row.trackingNumber}${attempt > 1 ? ` (succeeded on attempt ${attempt})` : ''}`)

                  if (updateResult.count === 0) {
                    console.warn(`[VOID-ALL] ⚠️  No ShippingLabel found for tracking ${row.trackingNumber}`)
                  }
                } catch (labelError) {
                  console.error(`[VOID-ALL] ❌ Failed to update ShippingLabel:`, labelError)
                }
              }

              // Success! Log if it took multiple attempts
              if (attempt > 1) {
                console.log(`[VOID-ALL] ✅ Label ${row.shipstationLabelId} voided successfully on attempt ${attempt}`)
              }

              return {
                rowId: row.id,
                rowNumber: row.rowNumber,
                success: true,
              }
            } catch (error: any) {
              lastError = error

              if (attempt < MAX_VOID_RETRIES) {
                console.warn(`[VOID-ALL] ⚠️  Failed to void label ${row.shipstationLabelId} for row ${row.id} (attempt ${attempt}/${MAX_VOID_RETRIES}), retrying...`)
                // Wait before retry (exponential backoff: 1s, 2s, 4s)
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
                continue
              } else {
                console.error(`[VOID-ALL] ❌ Failed to void label ${row.shipstationLabelId} for row ${row.id} after ${MAX_VOID_RETRIES} attempts:`, error)
              }
            }
          }

          // All retries exhausted
          return {
            rowId: row.id,
            rowNumber: row.rowNumber,
            success: false,
            error: lastError?.message || 'Unknown error',
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

    // Delete PACE shipments (which should cascade delete cartons)
    if (paceCredentials) {
      const authHeader = 'Basic ' + Buffer.from(`${paceCredentials.username}:${paceCredentials.password}`).toString('base64')
      const PACE_CONCURRENCY_LIMIT = 5 // Limit PACE API calls to prevent overwhelming the server

      console.log(`[VOID-ALL] 🗑️  PACE Cleanup - Shipments: ${paceShipmentIds.size} (Cartons will be cascade deleted)`)

      // Update and delete shipments in batches with retry logic (cartons should be cascade deleted)
      const shipmentIdsArray = Array.from(paceShipmentIds)
      let deletedShipments = 0
      let failedShipments = 0

      for (let i = 0; i < shipmentIdsArray.length; i += PACE_CONCURRENCY_LIMIT) {
        const batch = shipmentIdsArray.slice(i, i + PACE_CONCURRENCY_LIMIT)
        console.log(`[VOID-ALL] Processing shipment batch ${Math.floor(i / PACE_CONCURRENCY_LIMIT) + 1}/${Math.ceil(shipmentIdsArray.length / PACE_CONCURRENCY_LIMIT)} (${batch.length} shipments)`)

        const shipmentDeletions = batch.map(async (shipmentId) => {
          const MAX_RETRIES = 3
          let updateSuccess = false

          // Retry update operation up to 3 times
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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

                if (attempt < MAX_RETRIES) {
                  console.warn(`[VOID-ALL] ⚠️  Failed to update JobShipment ${shipmentId} to planned (attempt ${attempt}/${MAX_RETRIES}), retrying...`)
                  // Wait before retry (exponential backoff: 1s, 2s, 4s)
                  await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
                  continue
                } else {
                  console.error(`[VOID-ALL] ❌ Failed to update JobShipment ${shipmentId} to planned after ${MAX_RETRIES} attempts:`, updateError)
                  return { success: false } // Skip deletion if all update attempts fail
                }
              }

              console.log(`[VOID-ALL] ✅ JobShipment ${shipmentId} updated to planned${attempt > 1 ? ` (succeeded on attempt ${attempt})` : ''}`)
              updateSuccess = true
              break // Success, exit retry loop
            } catch (error: any) {
              if (attempt < MAX_RETRIES) {
                console.warn(`[VOID-ALL] ⚠️  Exception updating JobShipment ${shipmentId} (attempt ${attempt}/${MAX_RETRIES}):`, error.message)
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
                continue
              } else {
                console.error(`[VOID-ALL] ❌ Exception updating JobShipment ${shipmentId} after ${MAX_RETRIES} attempts:`, error.message)
                return { success: false }
              }
            }
          }

          if (!updateSuccess) {
            return { success: false } // Skip deletion if update didn't succeed
          }

          // Wait 2 seconds for PACE to process the update
          console.log(`[VOID-ALL] ⏳ Waiting 2 seconds for PACE to process update for shipment ${shipmentId}...`)
          await new Promise(resolve => setTimeout(resolve, 2000))

          // Retry delete operation up to 3 times
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              const deleteUrl = `${paceCredentials.url}/DeleteObject/DeleteObject?type=JobShipment&key=${shipmentId}`

              const deleteResponse = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': authHeader,
                },
              })

              if (deleteResponse.ok) {
                console.log(`[VOID-ALL] ✅ JobShipment ${shipmentId} deleted successfully${attempt > 1 ? ` (succeeded on attempt ${attempt})` : ''}`)
                return { success: true } // Success, exit retry loop
              } else {
                const deleteError = await deleteResponse.text()

                if (attempt < MAX_RETRIES) {
                  console.warn(`[VOID-ALL] ⚠️  Failed to delete JobShipment ${shipmentId} (attempt ${attempt}/${MAX_RETRIES}), retrying...`)
                  await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
                  continue
                } else {
                  console.error(`[VOID-ALL] ❌ Failed to delete JobShipment ${shipmentId} after ${MAX_RETRIES} attempts:`, deleteError)
                  return { success: false }
                }
              }
            } catch (error: any) {
              if (attempt < MAX_RETRIES) {
                console.warn(`[VOID-ALL] ⚠️  Exception deleting JobShipment ${shipmentId} (attempt ${attempt}/${MAX_RETRIES}):`, error.message)
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
                continue
              } else {
                console.error(`[VOID-ALL] ❌ Exception deleting JobShipment ${shipmentId} after ${MAX_RETRIES} attempts:`, error.message)
                return { success: false }
              }
            }
          }

          return { success: false }
        })

        const results = await Promise.allSettled(shipmentDeletions)
        results.forEach(r => {
          if (r.status === 'fulfilled' && r.value?.success) {
            deletedShipments++
          } else {
            failedShipments++
          }
        })
      }

      console.log(`[VOID-ALL] 🏁 PACE cleanup completed - Shipments deleted: ${deletedShipments}/${shipmentIdsArray.length} (Cartons cascade deleted)`)
    } else {
      console.log('[VOID-ALL] ⚠️  PACE credentials not available, skipping PACE cleanup')
    }

    // Update batch stats
    if (voidedCount > 0) {
      await db.batchImport.update({
        where: { id: batchId },
        data: {
          successfulRows: { decrement: voidedCount },
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
      message += `. Deleted ${paceShipmentIds.size} PACE shipment(s) (${paceCartonIds.size} carton(s) cascade deleted).`
    }

    return NextResponse.json({
      success: true,
      message,
      voidedCount,
      failedCount,
      totalRows: successRows.length,
      paceShipmentsDeleted: paceShipmentIds.size,
      paceCartonsCascadeDeleted: paceCartonIds.size,
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

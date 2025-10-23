import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { rowId, trackingNumber } = body

    if (!rowId || !trackingNumber) {
      return NextResponse.json({ error: 'Missing rowId or trackingNumber' }, { status: 400 })
    }

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
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Get the row
    const row = await db.batchImportRow.findFirst({
      where: {
        id: rowId,
        batchImportId: id,
      },
    })

    if (!row) {
      return NextResponse.json({ error: 'Row not found' }, { status: 404 })
    }

    if (row.status !== 'SUCCESS') {
      return NextResponse.json({ error: 'Can only void successful labels' }, { status: 400 })
    }

    // Find all rows in the same shipment group (same groupKey)
    // For multi-package shipments, we need to void ALL packages together
    const relatedRows = await db.batchImportRow.findMany({
      where: {
        batchImportId: id,
        groupKey: row.groupKey,
        status: 'SUCCESS',
      },
      orderBy: {
        packageNumber: 'asc',
      },
    })

    // If this is a multi-package shipment, warn the user
    if (relatedRows.length > 1) {
      console.log(`[VOID] Multi-package shipment detected: ${relatedRows.length} packages will be voided together`)
    }

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
      console.warn('[VOID] PACE not configured, skipping PACE cleanup')
    }

    // Collect unique PACE shipment IDs to delete
    const paceShipmentIds = new Set<number>()
    const paceCartonIds = new Set<number>()

    relatedRows.forEach(r => {
      if (r.paceJobShipmentId) paceShipmentIds.add(r.paceJobShipmentId)
      if (r.paceCartonId) paceCartonIds.add(r.paceCartonId)
    })

    // Void all labels in the shipment group
    const voidResults = []
    let voidedCount = 0

    for (const relatedRow of relatedRows) {
      try {
        // Void the label using ShipStation client
        if (relatedRow.shipstationLabelId) {
          const voidData = await shipStationClient.voidLabel(relatedRow.shipstationLabelId)
          voidResults.push({
            rowId: relatedRow.id,
            packageNumber: relatedRow.packageNumber,
            success: true,
            data: voidData,
          })
        } else {
          voidResults.push({
            rowId: relatedRow.id,
            packageNumber: relatedRow.packageNumber,
            success: false,
            error: 'No label ID available',
          })
          continue
        }

        // Update row to mark as voided/cancelled
        await db.batchImportRow.update({
          where: { id: relatedRow.id },
          data: {
            status: 'CANCELLED',
            errorMessage: 'Label voided by user',
            trackingNumber: null,
            labelUrl: null,
          },
        })

        // Also update ShippingLabel record to voided status
        if (relatedRow.trackingNumber) {
          try {
            const updateResult = await db.shippingLabel.updateMany({
              where: {
                trackingNumber: relatedRow.trackingNumber,
                tenantId: membership.tenantId,
              },
              data: {
                status: 'voided',
              },
            })
            console.log(`[VOID] ✅ Updated ${updateResult.count} ShippingLabel(s) to voided for tracking ${relatedRow.trackingNumber}`)

            if (updateResult.count === 0) {
              console.warn(`[VOID] ⚠️  No ShippingLabel found for tracking ${relatedRow.trackingNumber} in tenant ${membership.tenantId}`)
            }
          } catch (labelError) {
            console.error(`[VOID] ❌ Failed to update ShippingLabel:`, labelError)
          }
        } else {
          console.warn(`[VOID] ⚠️  No tracking number on row ${relatedRow.id}`)
        }

        voidedCount++
      } catch (error: any) {
        console.error(`[VOID] Failed to void label for row ${relatedRow.id}:`, error)
        voidResults.push({
          rowId: relatedRow.id,
          packageNumber: relatedRow.packageNumber,
          success: false,
          error: error.message,
        })
      }
    }

    // Delete PACE cartons and shipments
    if (paceCredentials) {
      const authHeader = 'Basic ' + Buffer.from(`${paceCredentials.username}:${paceCredentials.password}`).toString('base64')

      console.log(`[VOID] 🗑️  PACE Cleanup - Cartons: [${Array.from(paceCartonIds)}], Shipments: [${Array.from(paceShipmentIds)}]`)

      // Step 1: Delete cartons first (should cascade delete CartonContent)
      for (const cartonId of paceCartonIds) {
        try {
          const url = `${paceCredentials.url}/DeleteObject/DeleteObject?type=Carton&key=${cartonId}`
          const response = await fetch(url, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
            },
          })

          const responseText = await response.text()
          if (response.ok) {
            console.log(`[VOID] ✅ Carton ${cartonId} deleted - Status: ${response.status}`)
          } else {
            console.error(`[VOID] ❌ Carton ${cartonId} DELETE FAILED - Status: ${response.status}, Response:`, responseText)
          }
        } catch (error: any) {
          console.error(`[VOID] ❌ Exception deleting Carton ${cartonId}:`, error.message)
        }
      }

      // Step 2: Update shipments to "planned" status, then delete them
      for (const shipmentId of paceShipmentIds) {
        try {
          // First, update the shipment to mark it as "planned" (not "actual")
          console.log(`[VOID] 🔄 Updating JobShipment ${shipmentId} to planned status`)
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
            console.error(`[VOID] ❌ Failed to update JobShipment ${shipmentId} to planned:`, updateError)
            continue // Skip deletion if update fails
          }

          console.log(`[VOID] ✅ JobShipment ${shipmentId} updated to planned`)

          // Now delete the shipment
          const deleteUrl = `${paceCredentials.url}/DeleteObject/DeleteObject?type=JobShipment&key=${shipmentId}`
          console.log(`[VOID] 🗑️  Deleting JobShipment ${shipmentId}`)

          const deleteResponse = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
            },
          })

          if (deleteResponse.ok) {
            console.log(`[VOID] ✅ JobShipment ${shipmentId} deleted successfully`)
          } else {
            const deleteError = await deleteResponse.text()
            console.error(`[VOID] ❌ Failed to delete JobShipment ${shipmentId}:`, deleteError)
          }
        } catch (error: any) {
          console.error(`[VOID] ❌ Exception processing JobShipment ${shipmentId}:`, error.message)
        }
      }

      console.log(`[VOID] 🏁 PACE cleanup completed`)
    } else {
      console.log('[VOID] ⚠️  PACE credentials not available, skipping PACE cleanup')
    }

    // Update batch stats
    // Voided labels should move from successful to voided count
    if (voidedCount > 0) {
      await db.batchImport.update({
        where: { id },
        data: {
          successfulRows: { decrement: voidedCount },
          voidedRows: { increment: voidedCount },
        },
      })
    }

    // Build success message
    let message = relatedRows.length > 1
      ? `Voided ${voidedCount} package(s) in multi-package shipment`
      : 'Label voided successfully'

    if (paceCredentials) {
      message += `. Deleted ${paceCartonIds.size} PACE carton(s) and ${paceShipmentIds.size} shipment(s).`
    }

    return NextResponse.json({
      success: true,
      message,
      voidedCount,
      totalPackages: relatedRows.length,
      paceCartonsDeleted: paceCartonIds.size,
      paceShipmentsDeleted: paceShipmentIds.size,
      details: voidResults,
      // Signal to frontend to clear shipments cache
      clearCache: true,
    })
  } catch (error: any) {
    console.error('[API] Batch void error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to void label' },
      { status: 500 }
    )
  }
}

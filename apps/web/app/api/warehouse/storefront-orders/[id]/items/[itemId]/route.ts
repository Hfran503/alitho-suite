import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'
import { updatePaceJobPart, updatePaceCartonContent, updatePaceJobShipment } from '@/lib/pace'

const updateItemSchema = z.object({
  quantity: z.number().int().positive().optional(),
  referenceNumber: z.string().optional().nullable(),
})

/**
 * PATCH /api/warehouse/storefront-orders/[id]/items/[itemId]
 * Update an order item's quantity and/or reference number
 * Handles inventory adjustments and PACE sync
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Check role permissions
    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: orderId, itemId } = await params

    // Get the order with ALL items (needed to determine item position for paceJobPart)
    const order = await db.storefrontOrder.findFirst({
      where: { id: orderId, tenantId: membership.tenantId },
      include: {
        items: {
          orderBy: { id: 'asc' }, // Consistent ordering to match PACE part numbers
          include: {
            item: {
              select: {
                id: true,
                itemCode: true,
                sku: true,
                name: true,
                trackByReference: true,
                canOrderInBulk: true,
                unitsPerBulk: true,
                bulkUnitName: true,
              },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status === 'SHIPPED') {
      return NextResponse.json(
        { error: 'Cannot edit a shipped order' },
        { status: 400 }
      )
    }

    if (order.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot edit a cancelled order' },
        { status: 400 }
      )
    }

    // Find the specific item we're editing and its position
    const itemIndex = order.items.findIndex((item) => item.id === itemId)
    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Order item not found' }, { status: 404 })
    }
    const orderItem = order.items[itemIndex]

    // Auto-infer paceJobPart if missing but order was sent to PACE
    // Part numbers are based on item position: 01, 02, 03, etc.
    let effectivePaceJobPart = orderItem.paceJobPart
    if (order.paceJobNumber && !orderItem.paceJobPart) {
      effectivePaceJobPart = String(itemIndex + 1).padStart(2, '0')
      console.log(`Auto-inferred paceJobPart: ${effectivePaceJobPart} for item at index ${itemIndex}`)

      // Save the inferred paceJobPart for future use
      await db.storefrontOrderItem.update({
        where: { id: itemId },
        data: { paceJobPart: effectivePaceJobPart },
      })
      console.log(`Saved auto-inferred paceJobPart ${effectivePaceJobPart} to database`)
    }

    const body = await request.json()
    const validation = updateItemSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { quantity: newQuantity, referenceNumber: newReferenceNumber } = validation.data
    const currentQuantity = orderItem.quantity
    const currentReferenceNumber = orderItem.referenceNumber

    // Determine what changed
    const quantityChanged = newQuantity !== undefined && newQuantity !== currentQuantity
    const referenceChanged = newReferenceNumber !== undefined && newReferenceNumber !== currentReferenceNumber

    if (!quantityChanged && !referenceChanged) {
      return NextResponse.json({
        success: true,
        message: 'No changes detected',
        data: orderItem,
      })
    }

    // Process changes in a transaction
    const result = await db.$transaction(async (tx) => {
      const inventoryChanges: Array<{
        action: string
        referenceNumber: string | null
        quantity: number
        stockId?: string
      }> = []

      // Case 1: Reference changed (need to release old and reserve new)
      if (referenceChanged) {
        const finalQuantity = newQuantity ?? currentQuantity

        // Release from old reference
        if (currentReferenceNumber) {
          const releasedQty = await releaseReservedStock(
            tx,
            membership.tenantId,
            orderItem.itemId,
            currentQuantity,
            currentReferenceNumber,
            orderItem.lotNumber
          )
          inventoryChanges.push({
            action: 'release',
            referenceNumber: currentReferenceNumber,
            quantity: releasedQty,
          })
        }

        // Reserve from new reference (or no reference)
        const reserveResult = await reserveStock(
          tx,
          membership.tenantId,
          orderItem.itemId,
          finalQuantity,
          newReferenceNumber,
          orderItem.lotNumber
        )

        if (!reserveResult.success) {
          throw new Error(reserveResult.error || 'Failed to reserve stock')
        }

        inventoryChanges.push({
          action: 'reserve',
          referenceNumber: newReferenceNumber || null,
          quantity: finalQuantity,
          stockId: reserveResult.stockId,
        })
      }
      // Case 2: Only quantity changed (same reference)
      else if (quantityChanged && newQuantity !== undefined) {
        const diff = newQuantity - currentQuantity

        if (diff > 0) {
          // Increase: reserve more
          const reserveResult = await reserveStock(
            tx,
            membership.tenantId,
            orderItem.itemId,
            diff,
            currentReferenceNumber,
            orderItem.lotNumber
          )

          if (!reserveResult.success) {
            throw new Error(reserveResult.error || 'Failed to reserve additional stock')
          }

          inventoryChanges.push({
            action: 'reserve_additional',
            referenceNumber: currentReferenceNumber,
            quantity: diff,
            stockId: reserveResult.stockId,
          })
        } else {
          // Decrease: release some
          const releaseAmount = Math.abs(diff)
          const releasedQty = await releaseReservedStock(
            tx,
            membership.tenantId,
            orderItem.itemId,
            releaseAmount,
            currentReferenceNumber,
            orderItem.lotNumber
          )

          inventoryChanges.push({
            action: 'release',
            referenceNumber: currentReferenceNumber,
            quantity: releasedQty,
          })
        }
      }

      // Update the order item
      const updatedItem = await tx.storefrontOrderItem.update({
        where: { id: itemId },
        data: {
          ...(newQuantity !== undefined && { quantity: newQuantity }),
          ...(referenceChanged && { referenceNumber: newReferenceNumber }),
        },
        include: {
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              itemCode: true,
              sellPrice: true,
              canOrderInBulk: true,
              unitsPerBulk: true,
              bulkUnitName: true,
            },
          },
        },
      })

      return {
        orderItem: updatedItem,
        inventoryChanges,
      }
    })

    // PACE Sync: Update JobPart quantity if order has been sent to PACE
    let paceSyncResult: { success: boolean; error?: string } | null = null

    // Debug logging for PACE sync conditions
    console.log('PACE sync check:', {
      paceJobNumber: order.paceJobNumber,
      paceJobPart: effectivePaceJobPart,
      quantityChanged,
      newQuantity,
      willSync: !!(order.paceJobNumber && effectivePaceJobPart && quantityChanged && newQuantity !== undefined),
    })

    if (order.paceJobNumber && effectivePaceJobPart && quantityChanged && newQuantity !== undefined) {
      try {
        // Calculate PACE quantity (bulk orders use carton count)
        const isBulk = orderItem.isBulkOrder && orderItem.item.canOrderInBulk && orderItem.item.unitsPerBulk
        const paceQty = isBulk
          ? Math.round(newQuantity / orderItem.item.unitsPerBulk!)
          : newQuantity

        // Calculate new price
        const unitPrice = orderItem.unitPrice
          ? Number(orderItem.unitPrice)
          : result.orderItem.item.sellPrice
            ? Number(result.orderItem.item.sellPrice)
            : 0
        const newQuotedPrice = unitPrice * newQuantity

        console.log('Syncing quantity to PACE:', {
          job: order.paceJobNumber,
          jobPart: effectivePaceJobPart,
          qtyOrdered: paceQty,
          quotedPrice: newQuotedPrice,
        })

        await updatePaceJobPart({
          job: order.paceJobNumber,
          jobPart: effectivePaceJobPart,
          qtyOrdered: paceQty,
          quotedPrice: newQuotedPrice,
        })

        console.log('PACE JobPart updated successfully')

        // Also update CartonContent quantity and JobShipment special info if available
        if (order.paceResponse && typeof order.paceResponse === 'object') {
          const paceResponse = order.paceResponse as {
            cartonContents?: Array<{
              partNumber: string
              response: { id?: number; cartonContent?: number }
            }>
            jobShipment?: { id?: number; shipment?: number }
          }

          // Update CartonContent quantity
          if (paceResponse.cartonContents && Array.isArray(paceResponse.cartonContents)) {
            // Find the CartonContent for this part number
            const cartonContent = paceResponse.cartonContents.find(
              (cc) => cc.partNumber === effectivePaceJobPart
            )

            if (cartonContent) {
              const cartonContentId = cartonContent.response?.id || cartonContent.response?.cartonContent
              if (cartonContentId) {
                console.log('Updating PACE CartonContent:', {
                  cartonContentId,
                  quantity: paceQty,
                })

                await updatePaceCartonContent(cartonContentId, { quantity: paceQty })
                console.log('PACE CartonContent updated successfully')
              } else {
                console.warn('CartonContent found but no ID available:', cartonContent)
              }
            } else {
              console.warn(`No CartonContent found for part ${effectivePaceJobPart}`)
            }
          }

          // Update JobShipment special information
          const shipmentId = paceResponse.jobShipment?.id || paceResponse.jobShipment?.shipment
          if (shipmentId) {
            // Generate updated special info for all items (matching frontend format)
            const specialInfoLines: string[] = []
            for (const item of order.items) {
              const sku = item.item.sku || item.item.itemCode || ''
              const description = item.item.name || ''
              // Use the new quantity/reference for the item being edited
              const qty = item.id === itemId ? newQuantity : item.quantity
              const refNum = item.id === itemId ? (newReferenceNumber ?? item.referenceNumber) : item.referenceNumber
              const itemIsBulk = item.isBulkOrder && item.item.canOrderInBulk && item.item.unitsPerBulk
              const unitsPerBulk = item.item.unitsPerBulk || 1

              // Build SKU part with optional reference
              const skuPart = refNum ? `${sku} (${refNum})` : sku

              if (itemIsBulk) {
                const bulkQty = Math.round(qty / unitsPerBulk)
                const bulkUnitName = item.item.bulkUnitName || 'Case'
                // Format: SKU (Ref) - Description (Bulk): X Cartons (X x Y = Z units)
                specialInfoLines.push(
                  `${skuPart} - ${description} (Bulk): ${bulkQty} ${bulkUnitName}${bulkQty !== 1 ? 's' : ''} (${bulkQty} x ${unitsPerBulk} = ${qty} units)`
                )
              } else {
                // Format: SKU (Ref) - Description: X units
                specialInfoLines.push(`${skuPart} - ${description}: ${qty} units`)
              }
            }

            // Add order notes if present
            if (order.notes) {
              specialInfoLines.push('')
              specialInfoLines.push(`Notes: ${order.notes}`)
            }

            const newSpecialInfo = specialInfoLines.join('\n')
            console.log('Updating PACE JobShipment special info:', {
              shipmentId,
              specialInfo: newSpecialInfo.substring(0, 100) + '...',
            })

            await updatePaceJobShipment({
              id: shipmentId,
              u_specialinformation: newSpecialInfo,
            })
            console.log('PACE JobShipment special info updated successfully')
          } else {
            console.warn('No JobShipment ID found in paceResponse')
          }
        }

        paceSyncResult = { success: true }
      } catch (paceError) {
        console.error('Failed to sync quantity to PACE:', paceError)
        paceSyncResult = {
          success: false,
          error: paceError instanceof Error ? paceError.message : 'PACE sync failed',
        }
        // Don't fail the request - local update succeeded
      }
    }

    return NextResponse.json({
      success: true,
      data: result.orderItem,
      inventoryChanges: result.inventoryChanges,
      paceSync: paceSyncResult,
    })
  } catch (error) {
    console.error('Error updating order item:', error)
    const message = error instanceof Error ? error.message : 'Failed to update order item'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Reserve stock for an item
 */
async function reserveStock(
  tx: any,
  tenantId: string,
  itemId: string,
  quantity: number,
  referenceNumber: string | null | undefined,
  lotNumber: string | null
): Promise<{ success: boolean; error?: string; stockId?: string }> {
  // Build query for finding available stock
  const stockWhere: any = {
    tenantId,
    itemId,
    available: { gt: 0 },
  }

  // If reference number specified, filter by it
  if (referenceNumber) {
    stockWhere.referenceNumber = referenceNumber
  }
  if (lotNumber) {
    stockWhere.lotNumber = lotNumber
  }

  const stockRecords = await tx.inventoryStock.findMany({
    where: stockWhere,
    orderBy: { createdAt: 'asc' }, // FIFO
  })

  // Calculate total available
  const totalAvailable = stockRecords.reduce((sum: number, s: any) => sum + s.available, 0)

  if (totalAvailable < quantity) {
    const refInfo = referenceNumber ? ` for reference ${referenceNumber}` : ''
    return {
      success: false,
      error: `Insufficient stock${refInfo}. Available: ${totalAvailable}, Requested: ${quantity}`,
    }
  }

  // Reserve from stock records
  let remainingToReserve = quantity
  let lastStockId: string | undefined

  for (const stock of stockRecords) {
    if (remainingToReserve <= 0) break

    const toReserve = Math.min(stock.available, remainingToReserve)

    await tx.inventoryStock.update({
      where: { id: stock.id },
      data: {
        available: { decrement: toReserve },
        reserved: { increment: toReserve },
      },
    })

    lastStockId = stock.id
    remainingToReserve -= toReserve
  }

  return { success: true, stockId: lastStockId }
}

/**
 * Release reserved stock back to available
 */
async function releaseReservedStock(
  tx: any,
  tenantId: string,
  itemId: string,
  quantity: number,
  referenceNumber: string | null,
  lotNumber: string | null
): Promise<number> {
  const stockWhere: any = {
    tenantId,
    itemId,
    reserved: { gt: 0 },
  }

  if (referenceNumber) {
    stockWhere.referenceNumber = referenceNumber
  }
  if (lotNumber) {
    stockWhere.lotNumber = lotNumber
  }

  const stockRecords = await tx.inventoryStock.findMany({
    where: stockWhere,
    orderBy: { createdAt: 'asc' },
  })

  let remainingToRelease = quantity
  let totalReleased = 0

  for (const stock of stockRecords) {
    if (remainingToRelease <= 0) break

    const toRelease = Math.min(stock.reserved, remainingToRelease)

    await tx.inventoryStock.update({
      where: { id: stock.id },
      data: {
        reserved: { decrement: toRelease },
        available: { increment: toRelease },
      },
    })

    totalReleased += toRelease
    remainingToRelease -= toRelease
  }

  return totalReleased
}

/**
 * GET /api/warehouse/storefront-orders/[id]/items/[itemId]
 * Get available references for an item (for the reference dropdown)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const { id: orderId, itemId } = await params

    // Get the order item to find the item ID
    const orderItem = await db.storefrontOrderItem.findFirst({
      where: {
        id: itemId,
        order: { id: orderId, tenantId: membership.tenantId },
      },
      include: {
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
            trackByReference: true,
          },
        },
      },
    })

    if (!orderItem) {
      return NextResponse.json({ error: 'Order item not found' }, { status: 404 })
    }

    // Get available stock grouped by reference number
    const stockByReference = await db.inventoryStock.groupBy({
      by: ['referenceNumber'],
      where: {
        tenantId: membership.tenantId,
        itemId: orderItem.itemId,
        available: { gt: 0 },
      },
      _sum: {
        available: true,
      },
    })

    // Also include currently reserved reference (even if no more available)
    const currentRef = orderItem.referenceNumber
    const references = stockByReference.map((s) => ({
      referenceNumber: s.referenceNumber,
      available: s._sum.available || 0,
      isCurrent: s.referenceNumber === currentRef,
    }))

    // Add current reference if not in list
    if (currentRef && !references.find((r) => r.referenceNumber === currentRef)) {
      references.unshift({
        referenceNumber: currentRef,
        available: 0,
        isCurrent: true,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        orderItem,
        availableReferences: references,
        tracksByReference: orderItem.item.trackByReference,
      },
    })
  } catch (error) {
    console.error('Error fetching order item details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order item details' },
      { status: 500 }
    )
  }
}

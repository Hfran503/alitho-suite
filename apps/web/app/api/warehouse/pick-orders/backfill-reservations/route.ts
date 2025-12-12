import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// POST /api/warehouse/pick-orders/backfill-reservations
// Backfill stock reservations for existing PENDING/IN_PROGRESS pick orders
export async function POST(request: NextRequest) {
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

    // Only admin can run this
    if (!['admin', 'full_admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Find all PENDING and IN_PROGRESS pick orders
    const pickOrders = await db.pickOrder.findMany({
      where: {
        tenantId: membership.tenantId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      include: {
        items: {
          where: { isPicked: false }, // Only unpicked items need reservation
          select: {
            id: true,
            itemId: true,
            referenceNumber: true,
            lotNumber: true,
            requestedQty: true,
            pickedQty: true,
          },
        },
      },
    })

    const results: Array<{
      pickOrderNumber: string
      itemsProcessed: number
      reservationsCreated: number
      errors: string[]
    }> = []

    for (const order of pickOrders) {
      const orderResult = {
        pickOrderNumber: order.pickOrderNumber,
        itemsProcessed: 0,
        reservationsCreated: 0,
        errors: [] as string[],
      }

      for (const item of order.items) {
        orderResult.itemsProcessed++
        const qtyToReserve = item.requestedQty - item.pickedQty

        if (qtyToReserve <= 0) continue

        // Build stock query
        const stockWhere: any = {
          tenantId: membership.tenantId,
          itemId: item.itemId,
          available: { gt: 0 },
        }
        if (item.referenceNumber) stockWhere.referenceNumber = item.referenceNumber
        if (item.lotNumber) stockWhere.lotNumber = item.lotNumber

        // Find stock records to reserve from (FIFO)
        const stockRecords = await db.inventoryStock.findMany({
          where: stockWhere,
          orderBy: { createdAt: 'asc' },
        })

        let remainingToReserve = qtyToReserve

        for (const stock of stockRecords) {
          if (remainingToReserve <= 0) break

          const toReserve = Math.min(stock.available, remainingToReserve)

          try {
            await db.inventoryStock.update({
              where: { id: stock.id },
              data: {
                available: { decrement: toReserve },
                reserved: { increment: toReserve },
              },
            })
            remainingToReserve -= toReserve
            orderResult.reservationsCreated++
          } catch (err) {
            orderResult.errors.push(`Failed to reserve ${toReserve} for stock ${stock.id}`)
          }
        }

        if (remainingToReserve > 0) {
          orderResult.errors.push(
            `Could not fully reserve item ${item.itemId}. Short by ${remainingToReserve}`
          )
        }
      }

      results.push(orderResult)
    }

    const totalReservations = results.reduce((sum, r) => sum + r.reservationsCreated, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)

    return NextResponse.json({
      success: true,
      summary: {
        ordersProcessed: pickOrders.length,
        totalReservations,
        totalErrors,
      },
      details: results,
    })
  } catch (error) {
    console.error('Error backfilling reservations:', error)
    const message = error instanceof Error ? error.message : 'Failed to backfill reservations'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

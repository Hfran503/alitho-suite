import { db } from '../packages/database/src'

async function backfillReservations() {
  console.log('Starting backfill of pick order reservations...\n')

  // Find all PENDING and IN_PROGRESS pick orders
  const pickOrders = await db.pickOrder.findMany({
    where: {
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    include: {
      items: {
        where: { isPicked: false },
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

  console.log(`Found ${pickOrders.length} open pick orders to process\n`)

  let totalReservations = 0
  let totalErrors = 0

  for (const order of pickOrders) {
    console.log(`Processing ${order.pickOrderNumber}...`)
    let orderReservations = 0

    for (const item of order.items) {
      const qtyToReserve = item.requestedQty - item.pickedQty
      if (qtyToReserve <= 0) continue

      // Build stock query
      const stockWhere: any = {
        tenantId: order.tenantId,
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
          orderReservations++
        } catch (err) {
          console.error(`  Error reserving stock ${stock.id}:`, err)
          totalErrors++
        }
      }

      if (remainingToReserve > 0) {
        console.log(`  Warning: Could not fully reserve item ${item.itemId}. Short by ${remainingToReserve}`)
      }
    }

    console.log(`  Reserved ${orderReservations} stock records`)
    totalReservations += orderReservations
  }

  console.log('\n--- Summary ---')
  console.log(`Orders processed: ${pickOrders.length}`)
  console.log(`Total reservations: ${totalReservations}`)
  console.log(`Total errors: ${totalErrors}`)

  await db.$disconnect()
}

backfillReservations()
  .then(() => {
    console.log('\nBackfill complete!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exit(1)
  })

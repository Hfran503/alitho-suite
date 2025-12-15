import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function backfillItemCodes() {
  console.log('Starting backfill of item codes (CSI-XXXX)...\n')

  // Find all inventory items without itemCode, grouped by tenant
  const items = await db.inventoryItem.findMany({
    where: { itemCode: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      tenantId: true,
      sku: true,
      name: true,
    },
  })

  console.log(`Found ${items.length} items without itemCode\n`)

  if (items.length === 0) {
    console.log('Nothing to backfill!')
    await db.$disconnect()
    return
  }

  // Group items by tenant
  const itemsByTenant = items.reduce(
    (acc, item) => {
      if (!acc[item.tenantId]) acc[item.tenantId] = []
      acc[item.tenantId].push(item)
      return acc
    },
    {} as Record<string, typeof items>
  )

  let totalUpdated = 0
  let totalErrors = 0

  for (const [tenantId, tenantItems] of Object.entries(itemsByTenant)) {
    console.log(`Processing tenant ${tenantId} (${tenantItems.length} items)...`)

    // Get the highest existing itemCode number for this tenant
    const existingItem = await db.inventoryItem.findFirst({
      where: {
        tenantId,
        itemCode: { not: null },
      },
      orderBy: { itemCode: 'desc' },
      select: { itemCode: true },
    })

    // Extract number from existing code (e.g., "CSI-0042" -> 42)
    let nextNumber = 1
    if (existingItem?.itemCode) {
      const match = existingItem.itemCode.match(/CSI-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }

    // Update each item with a new itemCode
    for (const item of tenantItems) {
      const itemCode = `CSI-${String(nextNumber).padStart(4, '0')}`

      try {
        await db.inventoryItem.update({
          where: { id: item.id },
          data: { itemCode },
        })
        console.log(`  ${item.sku} -> ${itemCode}`)
        nextNumber++
        totalUpdated++
      } catch (err) {
        console.error(`  Error updating ${item.sku}:`, err)
        totalErrors++
      }
    }
  }

  console.log('\n--- Summary ---')
  console.log(`Total items updated: ${totalUpdated}`)
  console.log(`Total errors: ${totalErrors}`)

  await db.$disconnect()
}

backfillItemCodes()
  .then(() => {
    console.log('\nBackfill complete!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exit(1)
  })

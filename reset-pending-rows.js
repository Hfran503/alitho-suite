// Quick script to reset VOIDED rows back to PENDING
// Run with: node reset-pending-rows.js <batchId>

const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient()

async function main() {
  const batchId = process.argv[2]

  if (!batchId) {
    console.error('Usage: node reset-pending-rows.js <batchId>')
    process.exit(1)
  }

  console.log(`Resetting rows for batch ${batchId}...`)

  // Find all FAILED or CANCELLED rows
  const rows = await db.batchImportRow.findMany({
    where: {
      batchImportId: batchId,
      status: { in: ['FAILED', 'CANCELLED'] }
    }
  })

  console.log(`Found ${rows.length} rows to reset`)

  if (rows.length === 0) {
    console.log('No rows to reset')
    return
  }

  // Reset to PENDING
  const result = await db.batchImportRow.updateMany({
    where: {
      batchImportId: batchId,
      status: { in: ['FAILED', 'CANCELLED'] }
    },
    data: {
      status: 'PENDING',
      errorMessage: null,
      trackingNumber: null,
      labelUrl: null,
      shippingCost: null,
      paceJobShipmentId: null,
      paceCartonId: null,
      shipstationShipmentId: null,
      shipstationLabelId: null,
    }
  })

  console.log(`Reset ${result.count} rows to PENDING`)

  // Update batch status
  await db.batchImport.update({
    where: { id: batchId },
    data: {
      status: 'PROCESSING',
      errorMessage: null,
    }
  })

  console.log('Batch status set to PROCESSING')
  console.log('Done! Now re-queue the batch through the UI or API')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())

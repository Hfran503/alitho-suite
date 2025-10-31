// Quick script to void/cancel pending rows that were never processed
// Run with: node void-pending-rows.js <batchId>

const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient()

async function main() {
  const batchId = process.argv[2]

  if (!batchId) {
    console.error('Usage: node void-pending-rows.js <batchId>')
    process.exit(1)
  }

  console.log(`Voiding pending rows for batch ${batchId}...`)

  // Find all PENDING rows that were never processed
  const rows = await db.batchImportRow.findMany({
    where: {
      batchImportId: batchId,
      status: 'PENDING'
    }
  })

  console.log(`Found ${rows.length} pending rows to void`)

  if (rows.length === 0) {
    console.log('No pending rows to void')
    return
  }

  // Mark them as CANCELLED with a note
  const result = await db.batchImportRow.updateMany({
    where: {
      batchImportId: batchId,
      status: 'PENDING'
    },
    data: {
      status: 'CANCELLED',
      errorMessage: 'Manually cancelled - never processed',
      processedAt: new Date(),
    }
  })

  console.log(`Cancelled ${result.count} pending rows`)

  // Update batch status to COMPLETE
  const batch = await db.batchImport.findUnique({
    where: { id: batchId }
  })

  await db.batchImport.update({
    where: { id: batchId },
    data: {
      status: 'COMPLETE',
      completedAt: new Date(),
      // Note: We don't increment failedRows because these were never attempted
      // They just get removed from the pending count
    }
  })

  console.log('Batch status set to COMPLETE')
  console.log('\nSummary:')
  console.log(`  Total rows: ${batch.totalRows}`)
  console.log(`  Successful: ${batch.successfulRows}`)
  console.log(`  Failed: ${batch.failedRows}`)
  console.log(`  Cancelled: ${result.count}`)
  console.log('\nDone!')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())

// Quick diagnostic script to check batch and row statuses
// Run with: node check-batch-status.js <batchId>

const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient()

async function main() {
  const batchId = process.argv[2]

  if (!batchId) {
    console.error('Usage: node check-batch-status.js <batchId>')
    process.exit(1)
  }

  console.log(`\nChecking batch ${batchId}...\n`)

  // Get batch info
  const batch = await db.batchImport.findUnique({
    where: { id: batchId }
  })

  if (!batch) {
    console.error('Batch not found')
    process.exit(1)
  }

  console.log('Batch Info:')
  console.log(`  Status: ${batch.status}`)
  console.log(`  Total Rows: ${batch.totalRows}`)
  console.log(`  Processed: ${batch.processedRows}`)
  console.log(`  Successful: ${batch.successfulRows}`)
  console.log(`  Failed: ${batch.failedRows}`)

  // Get row counts by status
  const statusCounts = await db.batchImportRow.groupBy({
    by: ['status'],
    where: { batchImportId: batchId },
    _count: { status: true }
  })

  console.log('\nRow Status Breakdown:')
  for (const { status, _count } of statusCounts) {
    console.log(`  ${status}: ${_count.status}`)
  }

  // Get details of non-SUCCESS rows
  const problemRows = await db.batchImportRow.findMany({
    where: {
      batchImportId: batchId,
      status: { not: 'SUCCESS' }
    },
    select: {
      id: true,
      rowNumber: true,
      status: true,
      errorMessage: true,
      trackingNumber: true,
      paceJobShipmentId: true,
      paceCartonId: true,
    },
    orderBy: { rowNumber: 'asc' }
  })

  if (problemRows.length > 0) {
    console.log(`\nDetails of ${problemRows.length} non-SUCCESS rows:`)
    for (const row of problemRows) {
      console.log(`  Row ${row.rowNumber} (${row.id}):`)
      console.log(`    Status: ${row.status}`)
      console.log(`    Tracking: ${row.trackingNumber || 'none'}`)
      console.log(`    PACE Shipment: ${row.paceJobShipmentId || 'none'}`)
      console.log(`    PACE Carton: ${row.paceCartonId || 'none'}`)
      if (row.errorMessage) {
        console.log(`    Error: ${row.errorMessage}`)
      }
      console.log()
    }
  } else {
    console.log('\nAll rows have SUCCESS status')
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())

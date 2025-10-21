import { db } from '@repo/database'
import { queueBatchImport } from '../lib/queue/batch-import-queue'

async function requeuePendingBatches() {
  try {
    console.log('🔍 Finding pending batches...')

    // Find all pending batches
    const pendingBatches = await db.batchImport.findMany({
      where: {
        status: 'PENDING',
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log(`Found ${pendingBatches.length} pending batches`)

    if (pendingBatches.length === 0) {
      console.log('✅ No pending batches to requeue')
      return
    }

    // Requeue each batch
    for (const batch of pendingBatches) {
      console.log(`\n📦 Requeuing batch: ${batch.id}`)
      console.log(`   File: ${batch.fileName}`)
      console.log(`   Tenant: ${batch.tenant.name}`)
      console.log(`   Rows: ${batch.totalRows}`)

      try {
        await queueBatchImport(batch.id, batch.tenantId)
        console.log(`   ✅ Successfully queued`)
      } catch (error) {
        console.error(`   ❌ Failed to queue:`, error)
      }
    }

    console.log(`\n✅ Finished requeuing ${pendingBatches.length} batches`)
  } catch (error) {
    console.error('Error requeuing batches:', error)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

requeuePendingBatches()

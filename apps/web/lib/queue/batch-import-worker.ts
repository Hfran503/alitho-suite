import { Worker, Job } from 'bullmq'
import { db } from '@repo/database'
import { getRedisInstance } from '../redis'
import type { BatchImportJobData } from './batch-import-queue'

// Create the worker - will be initialized async
let _batchImportWorker: Worker<BatchImportJobData> | null = null

async function initWorker() {
  if (_batchImportWorker) return _batchImportWorker

  const connection = await getRedisInstance()

  _batchImportWorker = new Worker<BatchImportJobData>(
    'batch-import',
    async (job: Job<BatchImportJobData>) => {
      const { batchId, tenantId } = job.data

      console.log(`[Worker] Starting batch import: ${batchId}`)

      try {
        await processBatch(batchId, tenantId, (progress) => {
          job.updateProgress(progress)
        })

        console.log(`[Worker] Completed batch import: ${batchId}`)
        return { success: true, batchId }
      } catch (error) {
        console.error(`[Worker] Failed batch import: ${batchId}`, error)

        // Update batch status to CANCELLED so it doesn't stay stuck in PROCESSING
        try {
          await db.batchImport.update({
            where: { id: batchId },
            data: {
              status: 'CANCELLED',
              completedAt: new Date(),
            },
          })
        } catch (updateError) {
          console.error(`[Worker] Failed to update batch status to CANCELLED:`, updateError)
        }

        throw error
      }
    },
    {
      connection,
      concurrency: 5, // Process up to 5 batches simultaneously
      limiter: {
        max: 10, // Max 10 jobs
        duration: 1000, // per second (to avoid rate limiting ShipStation)
      },
    }
  )

  return _batchImportWorker
}

// Initialize worker and get instance
export const getBatchImportWorker = initWorker

// Export worker instance for backwards compatibility
export const batchImportWorker = {
  async on(event: any, handler: (...args: any[]) => void) {
    const worker = await initWorker()
    return worker.on(event as any, handler)
  },
  async close() {
    const worker = await initWorker()
    return worker.close()
  },
}

// Initialize worker event handlers
initWorker().then((worker) => {
  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('[Worker] Error:', err)
  })
})

// Main batch processing function
async function processBatch(
  batchId: string,
  tenantId: string,
  onProgress: (progress: number) => void
) {
  // 1. Get batch and rows
  const batch = await db.batchImport.findUnique({
    where: { id: batchId, tenantId },
    include: {
      rows: {
        where: { status: 'PENDING' },
        orderBy: { rowNumber: 'asc' },
      },
    },
  })

  if (!batch) {
    throw new Error(`Batch ${batchId} not found`)
  }

  console.log(`[Batch ${batchId}] Processing ${batch.rows.length} rows`)

  // 2. Update batch status to PROCESSING
  await db.batchImport.update({
    where: { id: batchId },
    data: {
      status: 'PROCESSING',
      startedAt: new Date(),
    },
  })

  // 3. Group rows by (Job# + Address) for multi-parcel shipments
  const groups = groupRowsByShipment(batch.rows)
  console.log(`[Batch ${batchId}] Grouped into ${groups.length} shipments`)

  let processed = 0
  const total = groups.length
  let successCount = 0
  let failedCount = 0

  // 4. Process shipment groups in parallel (3 at a time to respect rate limits)
  const CONCURRENCY = 3 // Process 3 shipments concurrently (respects 3.33 req/sec limit)

  for (let i = 0; i < groups.length; i += CONCURRENCY) {
    const batch_slice = groups.slice(i, i + CONCURRENCY)

    const results = await Promise.allSettled(
      batch_slice.map(async (group) => {
        try {
          console.log(`[Batch ${batchId}] Processing group ${processed + 1}/${total}`)
          await processShipmentGroup(group, batch)
          return { success: true, count: group.length }
        } catch (error: any) {
          console.error(`[Batch ${batchId}] Failed to process group:`, error.message)
          await markGroupAsFailed(group, error.message)
          return { success: false, count: group.length }
        }
      })
    )

    // Update counters
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successCount += result.value.count
        } else {
          failedCount += result.value.count
        }
      }
      processed++
    }

    onProgress((processed / total) * 100)
  }

  // 5. Update batch final status
  await db.batchImport.update({
    where: { id: batchId },
    data: {
      status: 'COMPLETE',
      completedAt: new Date(),
      processedRows: batch.rows.length,
      successfulRows: successCount,
      failedRows: failedCount,
    },
  })

  console.log(
    `[Batch ${batchId}] Complete: ${successCount} success, ${failedCount} failed`
  )
}

// Group rows by Job# + Address
function groupRowsByShipment(rows: any[]) {
  const grouped = new Map<string, any[]>()

  for (const row of rows) {
    // Create grouping key: Job# + normalized address
    const key = [
      row.jobNumber?.trim(),
      row.shipToAddress1?.trim().toLowerCase(),
      row.shipToCity?.trim().toLowerCase(),
      row.shipToState?.trim().toUpperCase(),
      row.shipToZip?.trim(),
    ]
      .filter(Boolean)
      .join('|')

    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(row)
  }

  // Convert to array and update groupKey on each row
  return Array.from(grouped.entries()).map(([key, rows]) => {
    // Sort by packageNumber to maintain order
    rows.sort((a, b) => (a.packageNumber || 0) - (b.packageNumber || 0))

    // Update groupKey in database for each row
    Promise.all(
      rows.map((row) =>
        db.batchImportRow.update({
          where: { id: row.id },
          data: { groupKey: key },
        })
      )
    )

    return rows
  })
}

// Process a single shipment group (multiple cartons to same address/job)
async function processShipmentGroup(rows: any[], batch: any) {
  const firstRow = rows[0]

  console.log(
    `[Group] Processing ${rows.length} cartons for Job# ${firstRow.jobNumber}`
  )

  // Mark all rows as PROCESSING
  await Promise.all(
    rows.map((row) =>
      db.batchImportRow.update({
        where: { id: row.id },
        data: { status: 'PROCESSING' },
      })
    )
  )

  // 1. Build packages array for ShipStation
  const packages = rows.map((row) => ({
    weight: row.weight,
    length: row.length,
    width: row.width,
    height: row.height,
    weightUnit: 'pound' as const,
    dimensionUnit: 'inch' as const,
    label_messages: {
      reference1: row.reference1 || null,
      reference2: row.reference2 || null,
      reference3: row.reference3 || null,
    },
  }))

  // 2. Build ship to address
  const shipTo = {
    name: firstRow.shipToName || '',
    company: firstRow.shipToCompany || '',
    street1: firstRow.shipToAddress1,
    street2: firstRow.shipToAddress2 || '',
    city: firstRow.shipToCity,
    state: firstRow.shipToState,
    zip: firstRow.shipToZip,
    country: firstRow.shipToCountry || 'US',
    phone: firstRow.shipToPhone || '',
  }

  // 3. Create labels via ShipStation
  const labelResponse = await fetch(
    `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/shipstation/labels/create`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carrierId: batch.carrierId,
        serviceCode: batch.serviceCode,
        shipFrom: batch.fromAddress,
        shipTo,
        packages,
        shipDate: firstRow.shipDate?.toISOString(),
        advancedOptions: {
          bill_to_party: batch.billToParty,
          bill_to_account: batch.billToAccount || undefined,
          bill_to_country_code:
            batch.billToParty === 'third_party' ? batch.billToCountryCode : undefined,
          bill_to_postal_code:
            batch.billToParty === 'third_party' ? batch.billToPostalCode : undefined,
          contains_alcohol: batch.containsAlcohol || undefined,
          saturday_delivery: batch.saturdayDelivery || undefined,
        },
        confirmation: batch.confirmation !== 'none' ? batch.confirmation : undefined,
      }),
    }
  )

  if (!labelResponse.ok) {
    const error = await labelResponse.json()
    throw new Error(error.error || 'Failed to create label')
  }

  const labelData = await labelResponse.json()
  const packagesData = labelData.data.packages || []

  console.log(`[Group] Created ${packagesData.length} labels via ShipStation`)

  // 4. Create JobShipment in PACE
  // Generate a name using ship-to company, but truncate to PACE's 60-character limit
  const shipToCompany = firstRow.shipToCompany || firstRow.shipToName || 'Unknown'
  const jobName = `${firstRow.jobNumber} / ${shipToCompany}`
  const truncatedName = jobName.length > 60 ? jobName.substring(0, 57) + '...' : jobName

  const jobShipmentResponse = await fetch(
    `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/pace/shipments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job: firstRow.jobNumber,
        date: firstRow.shipDate,
        name: truncatedName, // Truncated to 60 chars for PACE, full name used on label
        // Add other JobShipment fields as needed based on your PACE API
      }),
    }
  )

  if (!jobShipmentResponse.ok) {
    throw new Error('Failed to create JobShipment in PACE')
  }

  const jobShipment = await jobShipmentResponse.json()
  const jobShipmentId = jobShipment.data.id

  console.log(`[Group] Created JobShipment #${jobShipmentId} in PACE`)

  // 5. Create cartons in PACE (one per row/package)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const packageData = packagesData[i] || {}

    const trackingNumber =
      packageData.trackingNumber || labelData.data.trackingNumber
    const labelUrl =
      packageData.labelDownload?.href || labelData.data.labelUrl
    const labelId = packageData.labelId || labelData.data.labelId
    const cartonCost =
      packageData.cost || labelData.data.totalCost / packagesData.length

    // Create carton with contents
    const cartonResponse = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/pace/shipments/${jobShipmentId}/create-parcel-carton`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: 1,
          weight: row.weight,
          length: row.length,
          width: row.width,
          height: row.height,
          trackingNumber,
          trackingLink: `https://www.shipengine.com/tracking/${trackingNumber}`,
          carrier: batch.carrier,
          service: batch.service,
          shippingCost: cartonCost,
          shipstationShipmentId: labelData.data.shipmentId,
          shipstationLabelId: labelId,
          labelUrl,
          provider: 'shipstation',
          shipFrom: batch.fromAddress,
          shipTo,
          contents: [
            {
              jobProduct: parseInt(row.itemNumber), // Always JobProduct
              quantity: row.itemQuantity,
            },
          ],
        }),
      }
    )

    if (!cartonResponse.ok) {
      console.error(`[Group] Failed to create carton for row ${row.rowNumber}`)
      continue
    }

    const carton = await cartonResponse.json()

    // Update row with success data
    await db.batchImportRow.update({
      where: { id: row.id },
      data: {
        status: 'SUCCESS',
        trackingNumber,
        trackingUrl: `https://www.shipengine.com/tracking/${trackingNumber}`,
        labelUrl,
        shippingCost: cartonCost,
        paceJobShipmentId: jobShipmentId,
        paceCartonId: carton.data.id,
        shipstationShipmentId: labelData.data.shipmentId,
        shipstationLabelId: labelId,
        processedAt: new Date(),
      },
    })
  }

  // 6. Update JobShipment with aggregated tracking/cost
  await fetch(
    `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/pace/shipments/${jobShipmentId}/update-tracking`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: {
          street1: shipTo.street1,
          street2: shipTo.street2,
          city: shipTo.city,
          state: shipTo.state,
          zip: shipTo.zip,
        },
      }),
    }
  )

  console.log(`[Group] Successfully processed all cartons`)
}

// Mark all rows in a group as failed
async function markGroupAsFailed(rows: any[], errorMessage: string) {
  await Promise.all(
    rows.map((row) =>
      db.batchImportRow.update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          errorMessage,
          processedAt: new Date(),
        },
      })
    )
  )
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] Shutting down gracefully...')
  await batchImportWorker.close()
  const redis = await getRedisInstance()
  await redis.quit()
  await db.$disconnect()
})

export default batchImportWorker

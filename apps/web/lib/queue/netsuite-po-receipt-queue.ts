import { Queue } from 'bullmq'
import { getRedisInstance } from '../redis'

export interface NetsuitePOReceiptJobData {
  poReceiptIntegrationId: string
  uniqueId: string
  attempt: number
}

let poReceiptQueue: Queue<NetsuitePOReceiptJobData> | null = null

/**
 * Get or create the NetSuite PO Receipt queue
 */
export async function getNetsuitePOReceiptQueue() {
  if (!poReceiptQueue) {
    const redis = await getRedisInstance()
    poReceiptQueue = new Queue<NetsuitePOReceiptJobData>('netsuite-po-receipt', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3, // Retry up to 3 times
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 second delay, then exponential backoff
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
          count: 5000, // Keep last 5000 failed jobs
        },
      },
    })

    console.log('✅ NetSuite PO Receipt queue initialized')
  }

  return poReceiptQueue
}

/**
 * Queue a PO Receipt to be sent to NetSuite
 * @param poReceiptIntegrationId - The ID of the POReceiptIntegration record
 * @param uniqueId - The unique ID (poNumber-poLineId-timestamp) for logging
 * @param delayMs - Optional delay before processing (default: 0ms for immediate processing)
 */
export async function queueNetsuitePOReceipt(
  poReceiptIntegrationId: string,
  uniqueId: string,
  delayMs: number = 0
) {
  const queue = await getNetsuitePOReceiptQueue()

  const job = await queue.add(
    `po-receipt-${uniqueId}`,
    {
      poReceiptIntegrationId,
      uniqueId,
      attempt: 1,
    },
    {
      delay: delayMs,
      jobId: `po-receipt-${uniqueId}`, // Use unique job ID to prevent duplicates
    }
  )

  console.log(`📤 Queued PO Receipt ${uniqueId} for NetSuite (Job ID: ${job.id}, Delay: ${delayMs}ms)`)

  return job
}

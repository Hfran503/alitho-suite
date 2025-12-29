import { Queue } from 'bullmq'
import { getRedisInstance } from '../redis'

export interface VendorBillJobData {
  vendorBillIntegrationId: string
  attempt: number
}

let vendorBillQueue: Queue<VendorBillJobData> | null = null

/**
 * Get or create the Vendor Bill queue
 */
export async function getVendorBillQueue() {
  if (!vendorBillQueue) {
    console.log('🔍 [VendorBillQueue] Initializing queue...')
    console.log('🔍 [VendorBillQueue] REDIS_URL from env:', process.env.REDIS_URL ? `${process.env.REDIS_URL.substring(0, 50)}...` : 'NOT SET')
    const redis = await getRedisInstance()
    console.log('🔍 [VendorBillQueue] Redis instance obtained, creating queue...')
    vendorBillQueue = new Queue<VendorBillJobData>('vendor-bill', {
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

    console.log('✅ Vendor Bill queue initialized')
  }

  return vendorBillQueue
}

/**
 * Queue a vendor bill to be processed and sent to PACE
 * @param vendorBillIntegrationId - The ID of the VendorBillIntegration record
 * @param delayMs - Optional delay before processing (default: 0ms for immediate processing)
 */
export async function queueVendorBill(
  vendorBillIntegrationId: string,
  delayMs: number = 0
) {
  const queue = await getVendorBillQueue()

  const job = await queue.add(
    `vendor-bill-${vendorBillIntegrationId}`,
    {
      vendorBillIntegrationId,
      attempt: 1,
    },
    {
      delay: delayMs,
      jobId: `vendor-bill-${vendorBillIntegrationId}`, // Use unique job ID to prevent duplicates
    }
  )

  console.log(`📤 Queued vendor bill ${vendorBillIntegrationId} for PACE (Job ID: ${job.id}, Delay: ${delayMs}ms)`)

  return job
}

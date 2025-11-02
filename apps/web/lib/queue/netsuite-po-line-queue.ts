import { Queue } from 'bullmq'
import { getRedisInstance } from '../redis'

export interface NetsuitePOLineJobData {
  poLineIntegrationId: string
  uniqueId: string
  attempt: number
}

let poLineQueue: Queue<NetsuitePOLineJobData> | null = null

/**
 * Get or create the NetSuite PO Line queue
 */
export async function getNetsuitePOLineQueue() {
  if (!poLineQueue) {
    const redis = await getRedisInstance()
    poLineQueue = new Queue<NetsuitePOLineJobData>('netsuite-po-line', {
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

    console.log('✅ NetSuite PO Line queue initialized')
  }

  return poLineQueue
}

/**
 * Queue a PO Line to be sent to NetSuite
 * @param poLineIntegrationId - The ID of the POLineIntegration record
 * @param uniqueId - The unique ID (poNumber-poLineId) for logging
 * @param delayMs - Optional delay before processing (default: 0ms for immediate processing)
 */
export async function queueNetsuitePOLine(
  poLineIntegrationId: string,
  uniqueId: string,
  delayMs: number = 0
) {
  const queue = await getNetsuitePOLineQueue()

  const job = await queue.add(
    `po-line-${uniqueId}`,
    {
      poLineIntegrationId,
      uniqueId,
      attempt: 1,
    },
    {
      delay: delayMs,
      jobId: `po-line-${uniqueId}`, // Use unique job ID to prevent duplicates
    }
  )

  console.log(`📤 Queued PO Line ${uniqueId} for NetSuite (Job ID: ${job.id}, Delay: ${delayMs}ms)`)

  return job
}

import { Queue } from 'bullmq'
import { getRedisInstance } from '../redis'

let _netsuiteInvoiceQueue: Queue | null = null

// Lazy-loaded queue to avoid Redis initialization during build
const getNetsuiteInvoiceQueue = async () => {
  if (!_netsuiteInvoiceQueue) {
    const redis = await getRedisInstance()
    _netsuiteInvoiceQueue = new Queue('netsuite-invoice', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3, // Retry failed jobs up to 3 times
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 second delay, then exponential backoff
        },
        removeOnComplete: {
          count: 500, // Keep last 500 completed jobs
          age: 7 * 24 * 3600, // Keep completed jobs for 7 days
        },
        removeOnFail: {
          count: 1000, // Keep last 1000 failed jobs for debugging
        },
      },
    })
  }
  return _netsuiteInvoiceQueue
}

// Export for backwards compatibility
export const netsuiteInvoiceQueue = {
  async add(...args: Parameters<Queue['add']>) {
    const queue = await getNetsuiteInvoiceQueue()
    return queue.add(...args)
  },
  async getJob(jobId: string) {
    const queue = await getNetsuiteInvoiceQueue()
    return queue.getJob(jobId)
  },
  async close() {
    const queue = await getNetsuiteInvoiceQueue()
    return queue.close()
  },
  async getJobCounts() {
    const queue = await getNetsuiteInvoiceQueue()
    return queue.getJobCounts()
  },
}

// Job data interface
export interface NetsuiteInvoiceJobData {
  invoiceIntegrationId: string
  invoiceNumber: string
  attempt: number
}

/**
 * Helper function to queue a NetSuite invoice for processing
 * @param invoiceIntegrationId - The ID of the InvoiceIntegration record
 * @param invoiceNumber - The invoice number for logging
 * @param delay - Optional delay in milliseconds before processing
 */
export async function queueNetsuiteInvoice(
  invoiceIntegrationId: string,
  invoiceNumber: string,
  delay = 0
) {
  console.log(`🔄 Queueing NetSuite invoice ${invoiceNumber} for processing...`)

  return await netsuiteInvoiceQueue.add(
    'send-to-netsuite',
    {
      invoiceIntegrationId,
      invoiceNumber,
      attempt: 1,
    } as NetsuiteInvoiceJobData,
    {
      jobId: `invoice-${invoiceIntegrationId}`, // Unique job ID prevents duplicate processing
      delay, // Optional delay
    }
  )
}

/**
 * Helper function to get job status
 */
export async function getNetsuiteInvoiceJobStatus(invoiceIntegrationId: string) {
  const job = await netsuiteInvoiceQueue.getJob(`invoice-${invoiceIntegrationId}`)
  if (!job) return null

  return {
    id: job.id,
    progress: job.progress,
    state: await job.getState(),
    failedReason: job.failedReason,
    returnValue: job.returnvalue,
    attempts: job.attemptsMade,
    data: job.data,
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await netsuiteInvoiceQueue.close()
})

import { Queue } from 'bullmq'
import Redis from 'ioredis'

// Redis connection configuration
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
})

// Create the batch import queue
export const batchImportQueue = new Queue('batch-import', {
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 second delay, then exponential backoff
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // Keep completed jobs for 24 hours
    },
    removeOnFail: {
      count: 1000, // Keep last 1000 failed jobs for debugging
    },
  },
})

// Job data interface
export interface BatchImportJobData {
  batchId: string
  tenantId: string
}

// Helper function to add a batch processing job
export async function queueBatchImport(batchId: string, tenantId: string) {
  return await batchImportQueue.add(
    'process-batch',
    {
      batchId,
      tenantId,
    } as BatchImportJobData,
    {
      jobId: `batch-${batchId}`, // Unique job ID prevents duplicate processing
    }
  )
}

// Helper function to get job status
export async function getBatchJobStatus(batchId: string) {
  const job = await batchImportQueue.getJob(`batch-${batchId}`)
  if (!job) return null

  return {
    id: job.id,
    progress: job.progress,
    state: await job.getState(),
    failedReason: job.failedReason,
    returnValue: job.returnvalue,
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await batchImportQueue.close()
  await connection.quit()
})

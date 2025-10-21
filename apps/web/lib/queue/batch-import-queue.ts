import { Queue } from 'bullmq'
import { getRedisInstance } from '../redis'

let _batchImportQueue: Queue | null = null

// Lazy-loaded queue to avoid Redis initialization during build
const getBatchImportQueue = async () => {
  if (!_batchImportQueue) {
    const redis = await getRedisInstance()
    _batchImportQueue = new Queue('batch-import', {
      connection: redis,
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
  }
  return _batchImportQueue
}

// Export for backwards compatibility
export const batchImportQueue = {
  async add(...args: Parameters<Queue['add']>) {
    const queue = await getBatchImportQueue()
    return queue.add(...args)
  },
  async getJob(jobId: string) {
    const queue = await getBatchImportQueue()
    return queue.getJob(jobId)
  },
  async close() {
    const queue = await getBatchImportQueue()
    return queue.close()
  },
}

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
  const redis = await getRedisInstance()
  await redis.quit()
})

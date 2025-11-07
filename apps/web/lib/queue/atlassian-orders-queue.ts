import { Queue } from 'bullmq';
import { getRedisInstance } from '../redis';

let _atlassianOrdersQueue: Queue | null = null;

// Lazy-loaded queue to avoid Redis initialization during build
const getAtlassianOrdersQueue = async () => {
  if (!_atlassianOrdersQueue) {
    const redis = await getRedisInstance();
    _atlassianOrdersQueue = new Queue('atlassian-orders', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3, // Retry failed jobs up to 3 times
        backoff: {
          type: 'exponential',
          delay: 10000, // Start with 10 second delay for IMAP operations
        },
        removeOnComplete: {
          count: 500, // Keep last 500 completed jobs
          age: 7 * 24 * 3600, // Keep completed jobs for 7 days
        },
        removeOnFail: {
          count: 1000, // Keep last 1000 failed jobs for debugging
        },
      },
    });
  }
  return _atlassianOrdersQueue;
};

// Export for backwards compatibility
export const atlassianOrdersQueue = {
  async add(...args: Parameters<Queue['add']>) {
    const queue = await getAtlassianOrdersQueue();
    return queue.add(...args);
  },
  async getJob(jobId: string) {
    const queue = await getAtlassianOrdersQueue();
    return queue.getJob(jobId);
  },
  async close() {
    const queue = await getAtlassianOrdersQueue();
    return queue.close();
  },
  async getJobCounts() {
    const queue = await getAtlassianOrdersQueue();
    return queue.getJobCounts();
  },
};

// Job data interface
export interface AtlassianOrderJobData {
  tenantId: string;
  folderPath?: string; // Default: 'AtlassianOrders'
  deleteAfterProcessing?: boolean; // Default: true
  reprocessOrderId?: string; // For reprocessing a specific order
}

/**
 * Helper function to queue an Atlassian orders check for a tenant
 * @param tenantId - The tenant ID to process orders for
 * @param folderPath - Optional custom folder path (defaults to 'AtlassianOrders')
 * @param deleteAfterProcessing - Whether to delete emails after successful processing (default: true)
 */
export async function queueAtlassianOrdersCheck(
  tenantId: string,
  folderPath: string = 'AtlassianOrders',
  deleteAfterProcessing: boolean = true
) {
  console.log(`🔄 Queueing Atlassian orders check for tenant ${tenantId}...`);

  return await atlassianOrdersQueue.add(
    'check-emails',
    {
      tenantId,
      folderPath,
      deleteAfterProcessing,
    } as AtlassianOrderJobData,
    {
      jobId: `atlassian-orders-${tenantId}-${Date.now()}`, // Unique job ID with timestamp
    }
  );
}

/**
 * Helper function to schedule recurring checks (e.g., every 15 minutes)
 * @param tenantId - The tenant ID to process orders for
 * @param cronExpression - Cron expression (e.g., 'star/15 * * * *' for every 15 minutes, replace star with *)
 */
export async function scheduleAtlassianOrdersCheck(tenantId: string, cronExpression = '*/15 * * * *') {
  console.log(`📅 Scheduling Atlassian orders check for tenant ${tenantId} with cron: ${cronExpression}`);

  return await atlassianOrdersQueue.add(
    'check-emails',
    {
      tenantId,
      folderPath: 'AtlassianOrders',
      deleteAfterProcessing: true,
    } as AtlassianOrderJobData,
    {
      jobId: `atlassian-orders-recurring-${tenantId}`,
      repeat: {
        pattern: cronExpression,
      },
    }
  );
}

/**
 * Helper function to get job status
 */
export async function getAtlassianOrdersJobStatus(jobId: string) {
  const job = await atlassianOrdersQueue.getJob(jobId);
  if (!job) return null;

  return {
    id: job.id,
    progress: job.progress,
    state: await job.getState(),
    failedReason: job.failedReason,
    returnValue: job.returnvalue,
    attempts: job.attemptsMade,
    data: job.data,
  };
}

/**
 * Helper function to remove recurring schedule
 */
export async function removeAtlassianOrdersSchedule(tenantId: string) {
  const jobId = `atlassian-orders-recurring-${tenantId}`;
  const job = await atlassianOrdersQueue.getJob(jobId);

  if (job) {
    await job.remove();
    console.log(`✓ Removed recurring schedule for tenant ${tenantId}`);
    return true;
  }

  return false;
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await atlassianOrdersQueue.close();
});

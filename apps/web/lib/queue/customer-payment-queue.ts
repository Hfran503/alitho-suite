import { Queue } from 'bullmq'
import { getRedisInstance } from '../redis'

export interface CustomerPaymentJobData {
  customerPaymentIntegrationId: string
  attempt: number
}

let customerPaymentQueue: Queue<CustomerPaymentJobData> | null = null

/**
 * Get or create the Customer Payment queue
 */
export async function getCustomerPaymentQueue() {
  if (!customerPaymentQueue) {
    const redis = await getRedisInstance()
    customerPaymentQueue = new Queue<CustomerPaymentJobData>('customer-payment', {
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

    console.log('✅ Customer Payment queue initialized')
  }

  return customerPaymentQueue
}

/**
 * Queue a customer payment to be processed and sent to PACE
 * @param customerPaymentIntegrationId - The ID of the CustomerPaymentIntegration record
 * @param delayMs - Optional delay before processing (default: 0ms for immediate processing)
 */
export async function queueCustomerPayment(
  customerPaymentIntegrationId: string,
  delayMs: number = 0
) {
  const queue = await getCustomerPaymentQueue()

  const job = await queue.add(
    `customer-payment-${customerPaymentIntegrationId}`,
    {
      customerPaymentIntegrationId,
      attempt: 1,
    },
    {
      delay: delayMs,
      jobId: `customer-payment-${customerPaymentIntegrationId}`, // Use unique job ID to prevent duplicates
    }
  )

  console.log(`📤 Queued customer payment ${customerPaymentIntegrationId} for PACE (Job ID: ${job.id}, Delay: ${delayMs}ms)`)

  return job
}

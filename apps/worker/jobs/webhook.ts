import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'

interface WebhookJobData {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: any
}

async function processWebhook(job: Job<WebhookJobData>) {
  const { url, method, headers = {}, body } = job.data

  console.log(`Sending webhook ${method} to ${url}`)

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(body && { body: JSON.stringify(body) }),
  })

  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}`)
  }

  const result = await response.json().catch(() => ({}))

  return {
    success: true,
    status: response.status,
    result,
  }
}

export function webhookWorker(connection: Redis) {
  return new Worker<WebhookJobData>(
    'webhooks',
    async (job) => {
      const result = await processWebhook(job)
      console.log(`✅ Webhook job ${job.id} completed`)
      return result
    },
    {
      connection,
      concurrency: 5,
    }
  )
}

import { Queue } from 'bullmq'
import { redis } from './redis'

// Create queues for different job types
export const exportQueue = new Queue('exports', {
  connection: redis,
})

export const pdfQueue = new Queue('pdfs', {
  connection: redis,
})

export const emailQueue = new Queue('emails', {
  connection: redis,
})

export const webhookQueue = new Queue('webhooks', {
  connection: redis,
})

// Job enqueue helpers
export async function enqueueExport(data: {
  tenantId: string
  userId: string
  type: 'csv' | 'excel' | 'pdf'
  entityType: string
  filters?: Record<string, any>
}) {
  return await exportQueue.add('export', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  })
}

export async function enqueuePdfGeneration(data: {
  tenantId: string
  entityType: string
  entityId: string
  templateName: string
}) {
  return await pdfQueue.add('generate-pdf', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  })
}

export async function enqueueEmail(data: {
  to: string | string[]
  subject: string
  templateName: string
  templateData: Record<string, any>
}) {
  return await emailQueue.add('send-email', data, {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  })
}

export async function enqueueWebhook(data: {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: any
}) {
  return await webhookQueue.add('webhook', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  })
}

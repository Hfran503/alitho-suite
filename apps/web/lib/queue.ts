import { Queue } from 'bullmq'
import { getRedisInstance } from './redis'

// Lazy-loaded queues to avoid Redis initialization during build
let _exportQueue: Queue | null = null
let _pdfQueue: Queue | null = null
let _emailQueue: Queue | null = null
let _webhookQueue: Queue | null = null

export const getExportQueue = async () => {
  if (!_exportQueue) {
    const redis = await getRedisInstance()
    _exportQueue = new Queue('exports', {
      connection: redis,
    })
  }
  return _exportQueue
}

export const getPdfQueue = async () => {
  if (!_pdfQueue) {
    const redis = await getRedisInstance()
    _pdfQueue = new Queue('pdfs', {
      connection: redis,
    })
  }
  return _pdfQueue
}

export const getEmailQueue = async () => {
  if (!_emailQueue) {
    const redis = await getRedisInstance()
    _emailQueue = new Queue('emails', {
      connection: redis,
    })
  }
  return _emailQueue
}

export const getWebhookQueue = async () => {
  if (!_webhookQueue) {
    const redis = await getRedisInstance()
    _webhookQueue = new Queue('webhooks', {
      connection: redis,
    })
  }
  return _webhookQueue
}

// Backwards compatibility exports
export const exportQueue = {
  async add(...args: Parameters<Queue['add']>) {
    const queue = await getExportQueue()
    return queue.add(...args)
  }
}

export const pdfQueue = {
  async add(...args: Parameters<Queue['add']>) {
    const queue = await getPdfQueue()
    return queue.add(...args)
  }
}

export const emailQueue = {
  async add(...args: Parameters<Queue['add']>) {
    const queue = await getEmailQueue()
    return queue.add(...args)
  }
}

export const webhookQueue = {
  async add(...args: Parameters<Queue['add']>) {
    const queue = await getWebhookQueue()
    return queue.add(...args)
  }
}

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
  templateName?: string
  templateData?: Record<string, any>
  text?: string
  html?: string
  tenantId: string
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

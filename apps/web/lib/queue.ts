import { Queue } from 'bullmq'
import { getRedisInstance } from './redis'

// Lazy-loaded queues to avoid Redis initialization during build
let _exportQueue: Queue | null = null
let _pdfQueue: Queue | null = null
let _emailQueue: Queue | null = null
let _webhookQueue: Queue | null = null

export const getExportQueue = () => {
  if (!_exportQueue) {
    _exportQueue = new Queue('exports', {
      connection: getRedisInstance(),
    })
  }
  return _exportQueue
}

export const getPdfQueue = () => {
  if (!_pdfQueue) {
    _pdfQueue = new Queue('pdfs', {
      connection: getRedisInstance(),
    })
  }
  return _pdfQueue
}

export const getEmailQueue = () => {
  if (!_emailQueue) {
    _emailQueue = new Queue('emails', {
      connection: getRedisInstance(),
    })
  }
  return _emailQueue
}

export const getWebhookQueue = () => {
  if (!_webhookQueue) {
    _webhookQueue = new Queue('webhooks', {
      connection: getRedisInstance(),
    })
  }
  return _webhookQueue
}

// Backwards compatibility exports
export const exportQueue = {
  get add() { return getExportQueue().add.bind(getExportQueue()) }
}

export const pdfQueue = {
  get add() { return getPdfQueue().add.bind(getPdfQueue()) }
}

export const emailQueue = {
  get add() { return getEmailQueue().add.bind(getEmailQueue()) }
}

export const webhookQueue = {
  get add() { return getWebhookQueue().add.bind(getWebhookQueue()) }
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

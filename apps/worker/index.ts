// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv/config')
}

import Redis from 'ioredis'
import { exportWorker } from './jobs/export'
import { pdfWorker } from './jobs/pdf'
import { emailWorker } from './jobs/email'
import { webhookWorker } from './jobs/webhook'

// Debug: Log REDIS_URL to verify it's set
console.log('🔍 REDIS_URL check:', process.env.REDIS_URL?.substring(0, 30) + '...')

const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

// Start all workers
const workers = [
  exportWorker(connection),
  pdfWorker(connection),
  emailWorker(connection),
  webhookWorker(connection),
]

console.log('🚀 Worker started successfully')
console.log(`📋 Running ${workers.length} workers:`)
workers.forEach((worker) => {
  console.log(`   - ${worker.name}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⏹️  SIGTERM received, closing workers...')
  await Promise.all(workers.map((w) => w.close()))
  await connection.quit()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('⏹️  SIGINT received, closing workers...')
  await Promise.all(workers.map((w) => w.close()))
  await connection.quit()
  process.exit(0)
})

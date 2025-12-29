// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  const path = require('path')
  require('dotenv').config({ path: path.join(__dirname, '.env') })
}

import Redis from 'ioredis'
import { getRedisUrl } from './lib/secrets'
import { exportWorker } from './jobs/export'
import { pdfWorker } from './jobs/pdf'
import { emailWorker } from './jobs/email'
import { webhookWorker } from './jobs/webhook'
import { batchImportWorker } from './jobs/batch-import'
import { netsuiteInvoiceWorker } from './jobs/netsuite-invoice'
import { netsuitePOLineWorker } from './jobs/netsuite-po-line'
import { netsuitePOReceiptWorker } from './jobs/netsuite-po-receipt'
import { vendorBillWorker } from './jobs/vendor-bill'
import { customerPaymentWorker } from './jobs/customer-payment'
import { atlassianOrdersWorker } from './jobs/atlassian-orders'

// Debug: Log environment
console.log('🔍 Environment check:')
console.log('   NODE_ENV:', process.env.NODE_ENV || 'development')
console.log('   __dirname:', __dirname)

// Initialize workers with async startup
async function startWorkers() {
  // Fetch Redis URL from AWS Secrets Manager (same source as web app)
  console.log('🔌 Fetching Redis URL...')
  const redisUrl = await getRedisUrl()
  console.log('🔌 Redis URL:', redisUrl.substring(0, 50) + '...')

  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })

  // Start all workers
  const workers = [
    exportWorker(connection),
    pdfWorker(connection),
    emailWorker(connection),
    webhookWorker(connection),
    batchImportWorker(connection),
    netsuiteInvoiceWorker(connection),
    netsuitePOLineWorker(connection),
    netsuitePOReceiptWorker(connection),
    vendorBillWorker(connection),
    customerPaymentWorker(connection),
    atlassianOrdersWorker(connection),
  ]

  console.log('🚀 Worker started successfully')
  console.log(`📋 Running ${workers.length} workers:`)
  workers.forEach((worker) => {
    console.log(`   - ${worker.name}`)
  })

  // Graceful shutdown
  const shutdown = async () => {
    console.log('⏹️  Shutdown signal received, closing workers...')
    await Promise.all(workers.map((w) => w.close()))
    await connection.quit()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

startWorkers().catch((error) => {
  console.error('❌ Failed to start workers:', error)
  process.exit(1)
})

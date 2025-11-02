#!/usr/bin/env tsx

/**
 * Background Worker Process
 *
 * This script runs multiple BullMQ workers:
 * - Batch Import Worker: Processes batch import jobs
 * - NetSuite Invoice Worker: Processes invoice sending to NetSuite
 * - NetSuite PO Line Worker: Processes PO Line sending to NetSuite
 *
 * It should be run as a separate process from the Next.js web server.
 *
 * Usage:
 *   pnpm exec tsx apps/web/scripts/start-worker.ts
 *
 * Or use package.json script:
 *   pnpm worker
 */

import '../lib/queue/batch-import-worker'
import '../lib/queue/netsuite-invoice-worker'
import '../lib/queue/netsuite-po-line-worker'

console.log('🚀 Background Workers started')
console.log('📦 Redis:', process.env.REDIS_HOST || 'localhost')
console.log('📋 Workers:')
console.log('   - Batch Import Worker')
console.log('   - NetSuite Invoice Worker')
console.log('   - NetSuite PO Line Worker')
console.log('⏳ Waiting for jobs...')

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down workers...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down workers...')
  process.exit(0)
})

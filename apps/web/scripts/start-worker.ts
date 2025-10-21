#!/usr/bin/env tsx

/**
 * Batch Import Worker Process
 *
 * This script runs the BullMQ worker that processes batch import jobs.
 * It should be run as a separate process from the Next.js web server.
 *
 * Usage:
 *   pnpm exec tsx apps/web/scripts/start-worker.ts
 *
 * Or add to package.json:
 *   "worker": "tsx apps/web/scripts/start-worker.ts"
 */

import '../lib/queue/batch-import-worker'

console.log('🚀 Batch Import Worker started')
console.log('📦 Redis:', process.env.REDIS_HOST || 'localhost')
console.log('⏳ Waiting for jobs...')

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down worker...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down worker...')
  process.exit(0)
})

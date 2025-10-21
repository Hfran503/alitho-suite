#!/usr/bin/env tsx

/**
 * Apply retry tracking migration directly
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function applyMigration() {
  console.log('🔄 Applying retry tracking migration...')

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "BatchImportRow" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;
    `)
    console.log('✅ Added retryCount column')

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "BatchImportRow" ADD COLUMN IF NOT EXISTS "maxRetries" INTEGER NOT NULL DEFAULT 3;
    `)
    console.log('✅ Added maxRetries column')

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "BatchImportRow" ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);
    `)
    console.log('✅ Added lastAttemptAt column')

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "BatchImportRow" ADD COLUMN IF NOT EXISTS "isTransientError" BOOLEAN NOT NULL DEFAULT false;
    `)
    console.log('✅ Added isTransientError column')

    console.log('\n✅ Migration applied successfully!')
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

applyMigration().catch((err) => {
  console.error(err)
  process.exit(1)
})

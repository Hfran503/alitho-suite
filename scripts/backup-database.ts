#!/usr/bin/env tsx

/**
 * Database backup script
 * Exports all important data to JSON files before running migrations
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(process.cwd(), 'backups', timestamp)

  // Create backup directory
  fs.mkdirSync(backupDir, { recursive: true })

  console.log(`📦 Creating database backup in: ${backupDir}`)

  try {
    // Backup all critical tables
    const tables = [
      'tenant',
      'user',
      'membership',
      'order',
      'orderItem',
      'integration',
      'shipmentTypeMapping',
      'shippingLabel',
      'batchImport',
      'batchImportRow',
      'batchImportMapping',
      'carrierServiceMapping',
      'session',
      'account',
      'verificationToken',
    ]

    for (const table of tables) {
      try {
        // @ts-ignore - Dynamic table access
        const data = await prisma[table].findMany()
        const filePath = path.join(backupDir, `${table}.json`)
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
        console.log(`✅ Backed up ${table}: ${data.length} records`)
      } catch (err: any) {
        console.warn(`⚠️  Could not backup ${table}: ${err.message}`)
      }
    }

    // Create backup metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      tables: tables,
      prismaVersion: require('../package.json').dependencies['@prisma/client'] || 'unknown',
    }
    fs.writeFileSync(
      path.join(backupDir, '_metadata.json'),
      JSON.stringify(metadata, null, 2)
    )

    console.log(`\n✅ Backup completed successfully!`)
    console.log(`📁 Location: ${backupDir}`)

  } catch (error: any) {
    console.error(`❌ Backup failed:`, error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

backupDatabase().catch((err) => {
  console.error(err)
  process.exit(1)
})

import { db } from '@repo/database'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

async function restoreFromBackup(backupDir: string) {
  console.log(`🔄 Restoring database from backup: ${backupDir}`)

  const files = readdirSync(backupDir)

  // Order matters for foreign key constraints
  const orderedTables = [
    'tenant',
    'user',
    'membership',
    'session',
    'account',
    'verificationToken',
    'integration',
    'carrierServiceMapping',
    'shipmentTypeMapping',
    'order',
    'orderItem',
    'batchImport',
    'batchImportMapping',
    'batchImportRow',
    'shippingLabel',
  ]

  for (const table of orderedTables) {
    const filename = `${table}.json`
    if (!files.includes(filename)) {
      console.log(`⏭️  Skipping ${table} (no backup file)`)
      continue
    }

    const filepath = join(backupDir, filename)
    const content = readFileSync(filepath, 'utf-8')
    const data = JSON.parse(content)

    if (data.length === 0) {
      console.log(`⏭️  Skipping ${table} (empty)`)
      continue
    }

    console.log(`📥 Restoring ${table}: ${data.length} records`)

    try {
      // @ts-ignore - Dynamic table access
      await db[table].createMany({
        data: data,
        skipDuplicates: true,
      })
      console.log(`✅ Restored ${table}`)
    } catch (error: any) {
      console.error(`❌ Error restoring ${table}:`, error.message)
      // Continue with other tables
    }
  }

  console.log('🎉 Restore completed!')
}

// Get backup directory from command line
const backupDir = process.argv[2]

if (!backupDir) {
  console.error('Usage: npx tsx scripts/restore-from-json.ts <backup-directory>')
  console.error('Example: npx tsx scripts/restore-from-json.ts backups/2025-10-21T18-43-27-306Z')
  process.exit(1)
}

restoreFromBackup(backupDir)
  .then(() => {
    console.log('Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

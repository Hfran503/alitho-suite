import { PrismaClient } from '@prisma/client'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'

const prisma = new PrismaClient()

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations')

function calculateChecksum(migrationSql: string): string {
  return createHash('sha256').update(migrationSql).digest('hex')
}

async function markMigrationsAsApplied() {
  try {
    console.log('Reading migrations from file system...\n')

    // Get all migration directories
    const migrationDirs = readdirSync(MIGRATIONS_DIR)
      .filter(name => name !== '.gitkeep' && name !== 'migration_lock.toml')
      .sort()

    console.log(`Found ${migrationDirs.length} migrations in file system:\n`)

    // Get currently applied migrations
    const appliedMigrations = await prisma.$queryRaw<Array<{
      migration_name: string
      finished_at: Date | null
      rolled_back_at: Date | null
    }>>`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE rolled_back_at IS NULL
    `

    const appliedNames = new Set(
      appliedMigrations
        .filter(m => m.finished_at !== null)
        .map(m => m.migration_name)
    )

    console.log(`Applied migrations in database: ${appliedNames.size}\n`)

    // Find migrations that need to be marked as applied
    const migrationsToMark: string[] = []

    for (const migrationDir of migrationDirs) {
      if (!appliedNames.has(migrationDir)) {
        migrationsToMark.push(migrationDir)
        console.log(`  ⚠ ${migrationDir} - NOT APPLIED`)
      } else {
        console.log(`  ✓ ${migrationDir} - already applied`)
      }
    }

    if (migrationsToMark.length === 0) {
      console.log('\n✓ All migrations are already marked as applied')
      return
    }

    console.log(`\n${migrationsToMark.length} migration(s) need to be marked as applied`)
    console.log('\nMarking migrations as applied...\n')

    for (const migrationName of migrationsToMark) {
      const migrationPath = join(MIGRATIONS_DIR, migrationName, 'migration.sql')
      const migrationSql = readFileSync(migrationPath, 'utf-8')
      const checksum = calculateChecksum(migrationSql)

      // Check if migration already exists (even if rolled back)
      const existing = await prisma.$queryRaw<Array<{count: bigint}>>`
        SELECT COUNT(*) as count FROM "_prisma_migrations"
        WHERE migration_name = ${migrationName}
      `

      if (Number(existing[0].count) > 0) {
        // Update existing record
        await prisma.$executeRaw`
          UPDATE "_prisma_migrations"
          SET finished_at = NOW(),
              rolled_back_at = NULL,
              checksum = ${checksum},
              applied_steps_count = 1
          WHERE migration_name = ${migrationName}
        `
      } else {
        // Insert new record
        await prisma.$executeRaw`
          INSERT INTO "_prisma_migrations" (
            id,
            checksum,
            finished_at,
            migration_name,
            logs,
            rolled_back_at,
            started_at,
            applied_steps_count
          ) VALUES (
            gen_random_uuid()::text,
            ${checksum},
            NOW(),
            ${migrationName},
            NULL,
            NULL,
            NOW(),
            1
          )
        `
      }

      console.log(`  ✓ Marked ${migrationName} as applied`)
    }

    console.log('\n✓ All migrations are now marked as applied')
    console.log('You can now run future migrations with: pnpm db:migrate')

  } catch (error) {
    console.error('Error marking migrations as applied:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

markMigrationsAsApplied()
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nFailed:', error)
    process.exit(1)
  })

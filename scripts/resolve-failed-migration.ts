import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resolveFailedMigration() {
  try {
    console.log('Checking for failed migrations...')

    // Query the _prisma_migrations table to see the failed migration
    const failedMigrations = await prisma.$queryRaw<Array<{
      id: string
      checksum: string
      finished_at: Date | null
      migration_name: string
      logs: string | null
      rolled_back_at: Date | null
      started_at: Date
      applied_steps_count: number
    }>>`
      SELECT * FROM "_prisma_migrations"
      WHERE finished_at IS NULL
      AND rolled_back_at IS NULL
      ORDER BY started_at DESC
    `

    if (failedMigrations.length === 0) {
      console.log('✓ No failed migrations found')
      return
    }

    console.log(`Found ${failedMigrations.length} failed migration(s):`)
    failedMigrations.forEach(m => {
      console.log(`  - ${m.migration_name} (started: ${m.started_at})`)
      if (m.logs) {
        console.log(`    Logs: ${m.logs}`)
      }
    })

    console.log('\nMarking failed migrations as rolled back...')

    // Mark the failed migration as rolled back
    for (const migration of failedMigrations) {
      await prisma.$executeRaw`
        UPDATE "_prisma_migrations"
        SET rolled_back_at = NOW(),
            finished_at = NOW()
        WHERE migration_name = ${migration.migration_name}
        AND finished_at IS NULL
      `
      console.log(`✓ Marked ${migration.migration_name} as rolled back`)
    }

    console.log('\n✓ All failed migrations resolved')
    console.log('You can now run migrations again with: pnpm db:migrate')

  } catch (error) {
    console.error('Error resolving failed migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

resolveFailedMigration()
  .then(() => {
    console.log('Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed:', error)
    process.exit(1)
  })

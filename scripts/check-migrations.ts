import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkMigrations() {
  try {
    console.log('Checking applied migrations in production database...\n')

    const migrations = await prisma.$queryRaw<Array<{
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
      ORDER BY started_at ASC
    `

    console.log(`Total migrations in database: ${migrations.length}\n`)

    migrations.forEach(m => {
      const status = m.rolled_back_at
        ? '✗ ROLLED BACK'
        : m.finished_at
          ? '✓ APPLIED'
          : '⚠ IN PROGRESS'

      console.log(`${status} - ${m.migration_name}`)
      console.log(`   Started: ${m.started_at}`)
      if (m.finished_at) {
        console.log(`   Finished: ${m.finished_at}`)
      }
      if (m.rolled_back_at) {
        console.log(`   Rolled back: ${m.rolled_back_at}`)
      }
      console.log()
    })

  } catch (error) {
    console.error('Error checking migrations:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkMigrations()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed:', error)
    process.exit(1)
  })

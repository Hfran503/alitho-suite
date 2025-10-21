/**
 * Cleanup Orphaned Sessions Script (Raw SQL)
 *
 * This script removes sessions that belong to users that no longer exist in the database
 * using raw SQL to bypass foreign key constraints.
 *
 * Run this with: pnpm tsx scripts/cleanup-orphaned-sessions-raw.ts
 */

import { db } from '@repo/database'

async function cleanupOrphanedSessionsRaw() {
  console.log('🔍 Searching for orphaned sessions using raw SQL...\n')

  try {
    // Find sessions where the userId doesn't exist in the User table
    const orphanedSessions = await db.$queryRaw<
      Array<{ id: string; userId: string; expires: Date; sessionToken: string }>
    >`
      SELECT s.id, s."userId", s.expires, s."sessionToken"
      FROM "Session" s
      LEFT JOIN "User" u ON s."userId" = u.id
      WHERE u.id IS NULL
    `

    if (orphanedSessions.length === 0) {
      console.log('✅ No orphaned sessions found!')
      return
    }

    console.log(`🗑️  Found ${orphanedSessions.length} orphaned session(s):\n`)
    orphanedSessions.forEach(session => {
      const isExpired = new Date(session.expires) < new Date()
      console.log(`  Session ID: ${session.id}`)
      console.log(`  User ID: ${session.userId} (USER DOES NOT EXIST)`)
      console.log(`  Expires: ${new Date(session.expires).toISOString()} ${isExpired ? '(EXPIRED)' : '(ACTIVE)'}`)
      console.log(`  Token: ${session.sessionToken.substring(0, 30)}...`)
      console.log('')
    })

    // Delete orphaned sessions using raw SQL
    console.log('🧹 Deleting orphaned sessions...')

    const sessionIds = orphanedSessions.map(s => s.id)

    const result = await db.$executeRaw`
      DELETE FROM "Session"
      WHERE id = ANY(${sessionIds})
    `

    console.log(`✅ Successfully deleted ${result} orphaned session(s)!`)

    // Verify cleanup
    const remainingOrphaned = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "Session" s
      LEFT JOIN "User" u ON s."userId" = u.id
      WHERE u.id IS NULL
    `

    const count = Number(remainingOrphaned[0].count)
    if (count === 0) {
      console.log('✨ All orphaned sessions have been cleaned up!')
    } else {
      console.log(`⚠️  Warning: ${count} orphaned session(s) still remain`)
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  } finally {
    await db.$disconnect()
  }
}

// Run the cleanup
cleanupOrphanedSessionsRaw()
  .then(() => {
    console.log('\n✨ Cleanup completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Cleanup failed:', error)
    process.exit(1)
  })

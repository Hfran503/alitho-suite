/**
 * Cleanup Orphaned Sessions Script
 *
 * This script removes sessions that belong to users that no longer exist in the database.
 * Run this with: pnpm tsx scripts/cleanup-orphaned-sessions.ts
 */

import { db } from '@repo/database'

async function cleanupOrphanedSessions() {
  console.log('🔍 Searching for orphaned sessions...')

  try {
    // Get all sessions
    const allSessions = await db.session.findMany({
      select: {
        id: true,
        userId: true,
        expires: true,
        sessionToken: true,
      },
    })

    console.log(`📊 Found ${allSessions.length} total sessions`)

    // Get all user IDs
    const allUsers = await db.user.findMany({
      select: {
        id: true,
      },
    })

    const userIds = new Set(allUsers.map(u => u.id))
    console.log(`👥 Found ${userIds.size} users in database`)

    // Find orphaned sessions (sessions whose userId doesn't exist)
    const orphanedSessions = allSessions.filter(session => !userIds.has(session.userId))

    if (orphanedSessions.length === 0) {
      console.log('✅ No orphaned sessions found!')
      return
    }

    console.log(`\n🗑️  Found ${orphanedSessions.length} orphaned session(s):`)
    orphanedSessions.forEach(session => {
      const isExpired = session.expires < new Date()
      console.log(`  - Session ID: ${session.id}`)
      console.log(`    User ID: ${session.userId}`)
      console.log(`    Expires: ${session.expires.toISOString()} ${isExpired ? '(EXPIRED)' : '(ACTIVE)'}`)
      console.log(`    Token: ${session.sessionToken.substring(0, 20)}...`)
      console.log('')
    })

    // Delete orphaned sessions using raw SQL to bypass foreign key constraints
    console.log('🧹 Deleting orphaned sessions...')

    const sessionIds = orphanedSessions.map(s => s.id)

    // Use deleteMany which should work even with missing foreign keys
    const result = await db.session.deleteMany({
      where: {
        id: {
          in: sessionIds,
        },
      },
    })

    console.log(`✅ Successfully deleted ${result.count} orphaned session(s)!`)

  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  }
}

// Run the cleanup
cleanupOrphanedSessions()
  .then(() => {
    console.log('\n✨ Cleanup completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Cleanup failed:', error)
    process.exit(1)
  })

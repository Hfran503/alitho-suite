/**
 * List Users and Sessions Script
 *
 * This script lists all users and their sessions to help debug session issues.
 * Run this with: pnpm tsx scripts/list-users-and-sessions.ts
 */

import { db } from '@repo/database'

async function listUsersAndSessions() {
  console.log('👥 Listing all users and their sessions...\n')

  try {
    // Get all users with their memberships and sessions
    const users = await db.user.findMany({
      include: {
        memberships: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        sessions: {
          select: {
            id: true,
            expires: true,
            sessionToken: true,
          },
        },
      },
    })

    console.log(`📊 Found ${users.length} user(s):\n`)

    users.forEach((user, index) => {
      const activeSessions = user.sessions.filter(s => s.expires > new Date())
      const expiredSessions = user.sessions.filter(s => s.expires <= new Date())

      console.log(`${index + 1}. User:`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Name: ${user.name || '(no name)'}`)
      console.log(`   Email Verified: ${user.emailVerified ? 'Yes' : 'No'}`)
      console.log(`   Memberships: ${user.memberships.length}`)
      user.memberships.forEach(m => {
        console.log(`     - Tenant: ${m.tenant.name} (${m.tenant.id})`)
        console.log(`       Role: ${m.role}`)
      })
      console.log(`   Active Sessions: ${activeSessions.length}`)
      activeSessions.forEach(s => {
        console.log(`     - ID: ${s.id}`)
        console.log(`       Expires: ${s.expires.toISOString()}`)
        console.log(`       Token: ${s.sessionToken.substring(0, 20)}...`)
      })
      if (expiredSessions.length > 0) {
        console.log(`   Expired Sessions: ${expiredSessions.length}`)
      }
      console.log('')
    })

    // Summary
    console.log('\n📈 Summary:')
    const totalUsers = users.length
    const usersWithMemberships = users.filter(u => u.memberships.length > 0).length
    const usersWithoutMemberships = users.filter(u => u.memberships.length === 0).length
    const usersWithActiveSessions = users.filter(u => u.sessions.some(s => s.expires > new Date())).length

    console.log(`   Total Users: ${totalUsers}`)
    console.log(`   Users with Memberships: ${usersWithMemberships}`)
    console.log(`   Users without Memberships: ${usersWithoutMemberships}`)
    console.log(`   Users with Active Sessions: ${usersWithActiveSessions}`)

    if (usersWithoutMemberships > 0) {
      console.log('\n⚠️  Warning: Found users without any tenant memberships!')
      const usersWithoutMembershipsButWithSessions = users.filter(
        u => u.memberships.length === 0 && u.sessions.some(s => s.expires > new Date())
      )
      if (usersWithoutMembershipsButWithSessions.length > 0) {
        console.log(`   ${usersWithoutMembershipsButWithSessions.length} of them have active sessions:`)
        usersWithoutMembershipsButWithSessions.forEach(u => {
          console.log(`   - ${u.email} (ID: ${u.id})`)
        })
      }
    }

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  }
}

// Run the script
listUsersAndSessions()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error)
    process.exit(1)
  })

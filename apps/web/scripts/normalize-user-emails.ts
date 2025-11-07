import { db } from '@repo/database'

/**
 * Migration script to normalize all user emails to lowercase
 *
 * This script:
 * 1. Finds all users with emails that aren't lowercase
 * 2. Checks for potential duplicates after normalization
 * 3. Updates emails to lowercase
 *
 * Run with: npx tsx scripts/normalize-user-emails.ts
 */

async function main() {
  console.log('🔍 Finding users with non-lowercase emails...\n')

  // Get all users
  const allUsers = await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
    },
  })

  console.log(`Found ${allUsers.length} total users`)

  // Find users that need normalization
  const usersToUpdate = allUsers.filter((user: { id: string; email: string; name: string | null }) => {
    const normalized = user.email.toLowerCase().trim()
    return user.email !== normalized
  })

  if (usersToUpdate.length === 0) {
    console.log('\n✅ All user emails are already normalized!')
    return
  }

  console.log(`\n📋 Found ${usersToUpdate.length} user(s) with non-lowercase emails:\n`)

  // Check for potential duplicates
  const emailMap = new Map<string, typeof allUsers>()
  const duplicates: Array<{ email: string; users: typeof allUsers }> = []

  allUsers.forEach((user: { id: string; email: string; name: string | null }) => {
    const normalized = user.email.toLowerCase().trim()
    if (!emailMap.has(normalized)) {
      emailMap.set(normalized, [])
    }
    emailMap.get(normalized)!.push(user)
  })

  // Find any normalized emails that would create duplicates
  emailMap.forEach((users, normalizedEmail) => {
    if (users.length > 1) {
      duplicates.push({ email: normalizedEmail, users })
    }
  })

  if (duplicates.length > 0) {
    console.error('⚠️  WARNING: Found potential duplicate emails after normalization:\n')
    duplicates.forEach(({ email, users }) => {
      console.error(`   "${email}" would match:`)
      users.forEach((user: { id: string; email: string; name: string | null }) => {
        console.error(`     - ${user.email} (${user.name}, ID: ${user.id})`)
      })
      console.error()
    })
    console.error('❌ Cannot proceed with normalization due to duplicates.')
    console.error('   Please manually resolve these duplicates first:\n')
    console.error('   1. Decide which account to keep')
    console.error('   2. Migrate data from duplicate accounts')
    console.error('   3. Delete or rename duplicate accounts\n')
    process.exit(1)
  }

  // Show users that will be updated
  console.log('The following emails will be normalized:\n')
  usersToUpdate.forEach((user: { id: string; email: string; name: string | null }) => {
    const normalized = user.email.toLowerCase().trim()
    console.log(`   ${user.email} → ${normalized}`)
    console.log(`   (${user.name}, ID: ${user.id})\n`)
  })

  // Confirm before proceeding (in production, you might want to add a prompt)
  console.log(`\n🔄 Updating ${usersToUpdate.length} user email(s)...\n`)

  // Update each user
  let successCount = 0
  let errorCount = 0

  for (const user of usersToUpdate) {
    try {
      const normalizedEmail = user.email.toLowerCase().trim()
      await db.user.update({
        where: { id: user.id },
        data: { email: normalizedEmail },
      })
      console.log(`✓ Updated: ${user.email} → ${normalizedEmail}`)
      successCount++
    } catch (error) {
      console.error(`✗ Failed to update ${user.email}:`, error)
      errorCount++
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✅ Migration complete!`)
  console.log(`   - Successfully updated: ${successCount} user(s)`)
  if (errorCount > 0) {
    console.log(`   - Failed to update: ${errorCount} user(s)`)
  }
  console.log(`${'='.repeat(60)}\n`)
}

main()
  .catch((error) => {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })

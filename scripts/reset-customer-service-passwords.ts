import { PrismaClient } from '@prisma/client'
import bcryptjs from 'bcryptjs'

const prisma = new PrismaClient()

async function resetCustomerServicePasswords() {
  try {
    console.log('🔍 Finding customer_service users...')

    // Find all memberships with customer_service role
    const memberships = await prisma.membership.findMany({
      where: {
        role: 'customer_service',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    console.log(`\n📋 Found ${memberships.length} customer_service users:`)
    memberships.forEach((membership, index) => {
      console.log(`  ${index + 1}. ${membership.user.name} (${membership.user.email})`)
    })

    if (memberships.length === 0) {
      console.log('\n❌ No customer_service users found.')
      return
    }

    console.log('\n🔐 Resetting passwords...')

    const newPassword = 'Calitho94520@@'
    const hashedPassword = await bcryptjs.hash(newPassword, 10)

    // Get unique user IDs
    const userIds = [...new Set(memberships.map(m => m.user.id))]

    // Update all customer_service users with the new password
    const result = await prisma.user.updateMany({
      where: {
        id: {
          in: userIds,
        },
      },
      data: {
        password: hashedPassword,
      },
    })

    console.log(`\n✅ Successfully reset passwords for ${result.count} customer_service users`)
    console.log(`\n📝 New password for all customer_service users: ${newPassword}`)
    console.log('\n⚠️  Please advise users to change their password after first login.')

  } catch (error) {
    console.error('❌ Error resetting passwords:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
resetCustomerServicePasswords()
  .then(() => {
    console.log('\n✨ Password reset complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

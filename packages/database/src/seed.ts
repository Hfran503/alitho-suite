import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Skip seeding in production - tenants and users should be created through the app
  if (process.env.NODE_ENV === 'production') {
    console.log('⏭️  Skipping seed in production environment')
    console.log('🎉 Seeding complete!')
    return
  }

  // For development/testing only - check if we should create demo data
  const existingTenants = await prisma.tenant.count()
  if (existingTenants > 0) {
    console.log(`⏭️  Skipping seed - ${existingTenants} tenant(s) already exist`)
    console.log('🎉 Seeding complete!')
    return
  }

  console.log('ℹ️  No tenants found - this is a fresh database')
  console.log('ℹ️  Create your first tenant through the app or manually in the database')
  console.log('🎉 Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

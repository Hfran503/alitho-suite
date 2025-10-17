import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Company',
      slug: 'demo',
      plan: 'pro',
      status: 'active',
    },
  })

  console.log('✅ Created tenant:', tenant.slug)

  // Create admin user
  const adminPasswordHash = await hash('password123', 10)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: adminPasswordHash,
      passwordResetRequired: false,
    },
  })

  console.log('✅ Created admin user:', adminUser.email)

  // Create admin membership
  await prisma.membership.upsert({
    where: {
      userId_tenantId: {
        userId: adminUser.id,
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      tenantId: tenant.id,
      role: 'full_admin',
    },
  })

  console.log('✅ Created admin membership')

  // Create test user with temporary password
  const tempPasswordHash = await hash('temp123', 10)
  const tempUser = await prisma.user.upsert({
    where: { email: 'testuser@example.com' },
    update: {},
    create: {
      email: 'testuser@example.com',
      name: 'Test User',
      password: tempPasswordHash,
      passwordResetRequired: true, // ← This forces password change
    },
  })

  console.log('✅ Created test user with temporary password:', tempUser.email)

  // Create test user membership
  await prisma.membership.upsert({
    where: {
      userId_tenantId: {
        userId: tempUser.id,
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      userId: tempUser.id,
      tenantId: tenant.id,
      role: 'customer_service',
    },
  })

  console.log('✅ Created test user membership')

  // Verify data was created
  console.log('\n📊 Database verification:')
  const tenantCount = await prisma.tenant.count()
  const userCount = await prisma.user.count()
  const membershipCount = await prisma.membership.count()
  console.log(`   Tenants: ${tenantCount}`)
  console.log(`   Users: ${userCount}`)
  console.log(`   Memberships: ${membershipCount}`)

  // Show admin user details for debugging
  const adminWithMembership = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
    include: { memberships: { include: { tenant: true } } }
  })
  console.log(`\n👤 Admin user verification:`)
  console.log(`   ID: ${adminWithMembership?.id}`)
  console.log(`   Email: ${adminWithMembership?.email}`)
  console.log(`   Memberships: ${adminWithMembership?.memberships.length}`)
  if (adminWithMembership?.memberships.length) {
    console.log(`   Tenant: ${adminWithMembership.memberships[0].tenant.name}`)
    console.log(`   Role: ${adminWithMembership.memberships[0].role}`)
  }

  // Create sample orders (only if they don't exist)
  const existingOrders = await prisma.order.count({
    where: { tenantId: tenant.id }
  })

  if (existingOrders === 0) {
    for (let i = 1; i <= 5; i++) {
      await prisma.order.create({
        data: {
          orderNumber: `ORD-${String(i).padStart(5, '0')}`,
          status: ['pending', 'processing', 'shipped'][i % 3],
          customerName: `Customer ${i}`,
          customerEmail: `customer${i}@example.com`,
          customerPhone: `+1-555-${String(i).padStart(4, '0')}`,
          subtotal: 100 * i,
          tax: 10 * i,
          total: 110 * i,
          currency: 'USD',
          tenantId: tenant.id,
          items: {
            create: [
              {
                name: `Product ${i}A`,
                sku: `SKU-${i}A`,
                quantity: 1,
                unitPrice: 50 * i,
                total: 50 * i,
              },
              {
                name: `Product ${i}B`,
                sku: `SKU-${i}B`,
                quantity: 1,
                unitPrice: 50 * i,
                total: 50 * i,
              },
            ],
          },
        },
      })
    }
    console.log('✅ Created 5 sample orders')
  } else {
    console.log(`✅ Sample orders already exist (${existingOrders} found)`)
  }

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

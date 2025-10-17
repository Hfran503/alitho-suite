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

  // Create demo user
  const passwordHash = await hash('password123', 10)
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      password: passwordHash,
    },
  })

  console.log('✅ Created user:', user.email)

  // Create membership
  await prisma.membership.upsert({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      tenantId: tenant.id,
      role: 'owner',
    },
  })

  console.log('✅ Created membership')

  // Create sample orders
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

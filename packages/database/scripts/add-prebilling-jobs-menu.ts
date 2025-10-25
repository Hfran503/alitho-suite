import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding Prebilling Jobs menu item...')

  // Get the first tenant
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    throw new Error('No tenant found. Please create a tenant first.')
  }
  console.log(`Using tenant: ${tenant.name} (${tenant.id})`)

  // Add Prebilling Jobs menu item
  const prebillingJobsMenu = await prisma.menuConfiguration.upsert({
    where: {
      tenantId_menuKey: {
        tenantId: tenant.id,
        menuKey: 'prebilling-jobs'
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      menuKey: 'prebilling-jobs',
      label: 'Prebilling Jobs',
      href: '/prebilling-jobs',
      icon: 'clipboard-check',
      parentKey: null,
      order: 4,
      visibleToRoles: ['full_admin', 'admin', 'customer_service', 'estimators'],
      isActive: true,
    },
  })

  console.log('✅ Added Prebilling Jobs menu item:', prebillingJobsMenu)
}

main()
  .catch((e) => {
    console.error('Error adding menu item:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Initializing menu configuration with icons...')

  // Get the first tenant
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    throw new Error('No tenant found. Please create a tenant first.')
  }
  console.log(`Using tenant: ${tenant.name} (${tenant.id})`)

  // Delete existing menu configurations to start fresh
  await prisma.menuConfiguration.deleteMany({})
  console.log('Cleared existing menu configurations')

  // Create default menu structure with icons
  const menuItems = [
    {
      menuKey: 'dashboard',
      label: 'Dashboard',
      href: '/dashboard',
      icon: 'home',
      parentKey: null,
      order: 0,
      visibleToRoles: ['full_admin', 'admin', 'customer_service', 'estimator', 'logistics', 'accounting'],
      isActive: true
    },
    {
      menuKey: 'shipments',
      label: 'Shipments',
      href: '/shipments',
      icon: 'package',
      parentKey: null,
      order: 1,
      visibleToRoles: ['full_admin', 'admin', 'customer_service', 'logistics'],
      isActive: true
    },
    {
      menuKey: 'shipments-all',
      label: 'All Shipments',
      href: '/shipments',
      icon: 'list',
      parentKey: 'shipments',
      order: 0,
      visibleToRoles: ['full_admin', 'admin', 'customer_service', 'logistics'],
      isActive: true
    },
    {
      menuKey: 'shipments-manual-label',
      label: 'Manual Label',
      href: '/shipments/manual-label',
      icon: 'plus',
      parentKey: 'shipments',
      order: 1,
      visibleToRoles: ['full_admin', 'admin', 'customer_service'],
      isActive: true
    },
    {
      menuKey: 'shipments-track',
      label: 'Track Labels',
      href: '/shipment-track',
      icon: 'search',
      parentKey: 'shipments',
      order: 2,
      visibleToRoles: ['full_admin', 'admin', 'customer_service', 'logistics'],
      isActive: true
    },
    {
      menuKey: 'batch-import',
      label: 'Batch Import',
      href: '/batch-import',
      icon: 'upload',
      parentKey: null,
      order: 2,
      visibleToRoles: ['full_admin', 'admin'],
      isActive: true
    },
    {
      menuKey: 'batch-import-new',
      label: 'New Import',
      href: '/batch-import',
      icon: 'plus',
      parentKey: 'batch-import',
      order: 0,
      visibleToRoles: ['full_admin', 'admin'],
      isActive: true
    },
    {
      menuKey: 'batch-import-track',
      label: 'Track Batches',
      href: '/batch-import/batches',
      icon: 'search',
      parentKey: 'batch-import',
      order: 1,
      visibleToRoles: ['full_admin', 'admin'],
      isActive: true
    },
    {
      menuKey: 'open-jobs',
      label: 'Open Jobs',
      href: '/open-jobs',
      icon: 'briefcase',
      parentKey: null,
      order: 3,
      visibleToRoles: ['full_admin', 'admin', 'customer_service', 'estimator'],
      isActive: true
    },
    {
      menuKey: 'rate-estimates',
      label: 'Rate Estimates',
      href: '/rates/estimate',
      icon: 'dollar',
      parentKey: null,
      order: 4,
      visibleToRoles: ['full_admin', 'admin', 'estimator'],
      isActive: true
    },
    {
      menuKey: 'settings',
      label: 'Settings',
      href: '/settings',
      icon: 'settings',
      parentKey: null,
      order: 5,
      visibleToRoles: ['full_admin', 'admin'],
      isActive: true
    }
  ]

  // Insert all menu items
  for (const item of menuItems) {
    await prisma.menuConfiguration.create({
      data: {
        ...item,
        tenantId: tenant.id
      }
    })
    console.log(`Created menu item: ${item.label} (${item.icon})`)
  }

  console.log('✅ Menu configuration initialized successfully!')
}

main()
  .catch((e) => {
    console.error('Error initializing menu:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

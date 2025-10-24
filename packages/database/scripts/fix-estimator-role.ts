import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Fixing estimator role name in menu configurations...')

  // Find all menu configurations that have 'estimator' in visibleToRoles
  const menuItems = await prisma.menuConfiguration.findMany({
    where: {
      visibleToRoles: {
        has: 'estimator'
      }
    }
  })

  console.log(`Found ${menuItems.length} menu items to update`)

  // Update each menu item to replace 'estimator' with 'estimators'
  for (const item of menuItems) {
    const updatedRoles = item.visibleToRoles.map(role =>
      role === 'estimator' ? 'estimators' : role
    )

    await prisma.menuConfiguration.update({
      where: { id: item.id },
      data: { visibleToRoles: updatedRoles }
    })

    console.log(`✓ Updated ${item.label} (${item.menuKey})`)
  }

  console.log('✅ All menu configurations updated successfully!')
}

main()
  .catch((e) => {
    console.error('Error fixing estimator role:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

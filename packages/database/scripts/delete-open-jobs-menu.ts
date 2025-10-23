import { db } from '../src/index'

async function main() {
  // Delete the open-jobs menu item from all tenants
  const result = await db.menuConfiguration.deleteMany({
    where: {
      menuKey: 'open-jobs'
    }
  })

  console.log(`✅ Deleted ${result.count} menu configuration(s) with menuKey 'open-jobs'`)
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(() => db.$disconnect())

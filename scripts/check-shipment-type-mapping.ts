/**
 * Script to check and display ShipmentTypeMapping configuration
 *
 * Usage: npx tsx scripts/check-shipment-type-mapping.ts
 */

import { db } from '@repo/database'

async function main() {
  console.log('🔍 Checking ShipmentTypeMapping configuration...\n')

  const mappings = await db.shipmentTypeMapping.findMany({
    include: {
      tenant: {
        select: {
          name: true,
        },
      },
    },
  })

  if (mappings.length === 0) {
    console.log('⚠️  NO SHIPMENT TYPE MAPPINGS FOUND!')
    console.log('\nThis means shipmentType will NOT be updated when creating or canceling labels.')
    console.log('\nTo fix this, you need to create ShipmentTypeMapping records in the database.')
    console.log('\nExample:')
    console.log(`
await db.shipmentTypeMapping.create({
  data: {
    tenantId: 'your-tenant-id',
    plannedTypeId: 1,  // PACE ID for "UPS Ground - Planned"
    plannedTypeName: 'UPS Ground - Planned',
    completedTypeId: 2,  // PACE ID for "UPS Ground - Completed"
    completedTypeName: 'UPS Ground - Completed',
  },
})
    `)
  } else {
    console.log(`✅ Found ${mappings.length} shipment type mapping(s):\n`)

    for (const mapping of mappings) {
      console.log(`Tenant: ${mapping.tenant.name} (${mapping.tenantId})`)
      console.log(`  Planned:   ${mapping.plannedTypeName} (ID: ${mapping.plannedTypeId})`)
      console.log(`  Completed: ${mapping.completedTypeName} (ID: ${mapping.completedTypeId})`)
      console.log('')
    }

    console.log('✅ Shipment type mapping is configured correctly.')
  }

  await db.$disconnect()
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Update labels for shipment 58926 that were voided
  const result = await prisma.shippingLabel.updateMany({
    where: {
      paceShipmentId: 58926,
      status: 'active',
    },
    data: {
      status: 'voided',
    },
  })

  console.log(`Updated ${result.count} labels to voided status`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

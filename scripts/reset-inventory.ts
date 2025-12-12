import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetInventory() {
  console.log('Starting inventory reset...')

  try {
    // Delete in correct order to respect foreign key constraints

    // 1. Delete all inventory transactions
    const deletedTransactions = await prisma.inventoryTransaction.deleteMany({})
    console.log(`Deleted ${deletedTransactions.count} inventory transactions`)

    // 2. Delete all inventory stock records
    const deletedStock = await prisma.inventoryStock.deleteMany({})
    console.log(`Deleted ${deletedStock.count} inventory stock records`)

    // 3. Delete all receiving items
    const deletedReceivingItems = await prisma.receivingItem.deleteMany({})
    console.log(`Deleted ${deletedReceivingItems.count} receiving items`)

    // 4. Delete all receiving records
    const deletedReceiving = await prisma.receivingRecord.deleteMany({})
    console.log(`Deleted ${deletedReceiving.count} receiving records`)

    console.log('\n✅ Inventory reset complete! All quantities are now zero.')
  } catch (error) {
    console.error('Error resetting inventory:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

resetInventory()

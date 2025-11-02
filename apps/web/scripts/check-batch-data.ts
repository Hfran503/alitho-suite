import { db } from '@repo/database'

async function checkBatchData() {
  try {
    const batches = await db.batchImport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        fileName: true,
        status: true,
        carrierId: true,
        carrierCode: true,
        serviceCode: true,
        carrier: true,
        service: true,
        createdAt: true,
      },
    })

    console.log('\n📦 Recent Batches:\n')
    batches.forEach((batch: typeof batches[number], index: number) => {
      console.log(`${index + 1}. Batch ID: ${batch.id}`)
      console.log(`   File: ${batch.fileName}`)
      console.log(`   Status: ${batch.status}`)
      console.log(`   Created: ${batch.createdAt.toLocaleString()}`)
      console.log(`   Carrier ID: ${batch.carrierId}`)
      console.log(`   Carrier Code: ${batch.carrierCode}`)
      console.log(`   Service Code: ${batch.serviceCode}`)
      console.log(`   Carrier Name: ${batch.carrier}`)
      console.log(`   Service Name: ${batch.service}`)
      console.log('')
    })
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await db.$disconnect()
  }
}

checkBatchData()

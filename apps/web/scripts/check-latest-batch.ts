import { db } from '@repo/database'

async function checkLatestBatch() {
  try {
    const batch = await db.batchImport.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fromAddress: true,
        carrierId: true,
        carrierCode: true,
        serviceCode: true,
        carrier: true,
        service: true,
      },
    })

    if (!batch) {
      console.log('No batches found')
      return
    }

    console.log('\n📦 Latest Batch Data:')
    console.log('ID:', batch.id)
    console.log('carrierId:', batch.carrierId)
    console.log('carrierCode:', batch.carrierCode)
    console.log('serviceCode:', batch.serviceCode)
    console.log('carrier:', batch.carrier)
    console.log('service:', batch.service)
    console.log('\nfromAddress (raw):', batch.fromAddress)

    if (batch.fromAddress) {
      try {
        const parsed = JSON.parse(String(batch.fromAddress))
        console.log('\nfromAddress (parsed):')
        console.log(JSON.stringify(parsed, null, 2))
      } catch (e) {
        console.log('fromAddress is not valid JSON')
      }
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await db.$disconnect()
  }
}

checkLatestBatch()

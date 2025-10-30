import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPaceApiCredentials } from '@/lib/secrets'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url: paceApiUrl, username, password } = await getPaceApiCredentials()
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')

    // Step 1: Find all parts for estimate 19828
    console.log('Finding parts for estimate 19828...')
    const partsResponse = await fetch(
      `${paceApiUrl}/FindObjects/find?type=EstimatePart&xpath=${encodeURIComponent('@estimate = 19828')}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
        },
      }
    )

    if (!partsResponse.ok) {
      const errorText = await partsResponse.text()
      return NextResponse.json({ error: 'Failed to find parts', details: errorText }, { status: 500 })
    }

    const partIds: string[] = await partsResponse.json()
    console.log(`Found ${partIds.length} parts:`, partIds)

    // Step 2: For each part, find its EstimateQuantity objects
    const results = []
    for (const partId of partIds) {
      console.log(`\n--- Searching quantities for part ${partId} ---`)

      // Find EstimateQuantity objects for this part
      const xpath = `@estimatePart = ${partId}`
      const qtyFindResponse = await fetch(
        `${paceApiUrl}/FindObjects/find?type=EstimateQuantity&xpath=${encodeURIComponent(xpath)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: authHeader,
          },
        }
      )

      if (!qtyFindResponse.ok) {
        console.error(`Failed to find quantities for part ${partId}`)
        results.push({
          partId,
          error: 'Failed to find quantities',
        })
        continue
      }

      const quantityIds: string[] = await qtyFindResponse.json()
      console.log(`Found ${quantityIds.length} quantity IDs for part ${partId}:`, quantityIds)

      // Read each quantity to get pricing data
      const quantities = []
      for (const qtyId of quantityIds) {
        const qtyReadResponse = await fetch(
          `${paceApiUrl}/ReadObject/readEstimateQuantity?primaryKey=${qtyId}`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              Authorization: authHeader,
            },
            body: '',
          }
        )

        if (qtyReadResponse.ok) {
          const qtyData = await qtyReadResponse.json()
          console.log(`Quantity ${qtyId} data:`, {
            id: qtyData.id,
            estimatePart: qtyData.estimatePart,
            displayQuantity: qtyData.displayQuantity,
            price: qtyData.price,
            quotedPrice: qtyData.quotedPrice,
            cost: qtyData.cost,
            grandTotal: qtyData.grandTotal,
          })
          quantities.push(qtyData)
        } else {
          console.error(`Failed to read quantity ${qtyId}`)
        }
      }

      results.push({
        partId,
        quantityCount: quantities.length,
        quantities,
      })
    }

    return NextResponse.json({
      success: true,
      estimateId: 19828,
      partCount: partIds.length,
      parts: results,
    })
  } catch (error) {
    console.error('Error testing quantities:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

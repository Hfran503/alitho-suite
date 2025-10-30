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

    const estimateId = 19828

    // Step 1: Calculate the estimate
    console.log(`Calculating estimate ${estimateId}...`)
    const calculateResponse = await fetch(
      `${paceApiUrl}/InvokeAction/calculateEstimate?estimatePrimaryKey=${estimateId}`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
        },
      }
    )

    if (!calculateResponse.ok) {
      const errorText = await calculateResponse.text()
      return NextResponse.json({ error: 'Failed to calculate', details: errorText }, { status: 500 })
    }

    const calculatedEstimate = await calculateResponse.json()
    console.log('Estimate calculated, state:', calculatedEstimate.state)

    // Step 2: Find all parts
    const partsResponse = await fetch(
      `${paceApiUrl}/FindObjects/find?type=EstimatePart&xpath=${encodeURIComponent(`@estimate = ${estimateId}`)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
        },
      }
    )

    const partIds: string[] = await partsResponse.json()
    console.log(`Found ${partIds.length} parts`)

    // Step 3: For each part, get quantities with pricing
    const partsWithPricing = []
    for (const partId of partIds) {
      // Find quantities
      const qtyFindResponse = await fetch(
        `${paceApiUrl}/FindObjects/find?type=EstimateQuantity&xpath=${encodeURIComponent(`@estimatePart = ${partId}`)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: authHeader,
          },
        }
      )

      const quantityIds: string[] = await qtyFindResponse.json()
      console.log(`Part ${partId}: Found ${quantityIds.length} quantities`)

      // Read each quantity
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

          // Extract key pricing info
          const pricingInfo = {
            id: qtyData.id,
            quantityOrdered: qtyData.quantityOrdered,
            price: qtyData.price,
            quotedPrice: qtyData.quotedPrice,
            cost: qtyData.cost,
            grandTotal: qtyData.grandTotal,
            positionState: qtyData.positionState,
            priceDirty: qtyData.priceDirty,
          }

          console.log(`Quantity ${qtyId} pricing:`, pricingInfo)
          quantities.push(pricingInfo)
        }
      }

      partsWithPricing.push({
        partId,
        quantityCount: quantities.length,
        quantities,
      })
    }

    return NextResponse.json({
      success: true,
      estimateId,
      state: calculatedEstimate.state,
      parts: partsWithPricing,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

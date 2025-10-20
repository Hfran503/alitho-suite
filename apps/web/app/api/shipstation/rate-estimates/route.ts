import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getShipStationClient } from '@/lib/shipstation'

// POST /api/shipstation/rate-estimates - Get rate estimates
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Check if ShipStation integration is enabled
    const integration = await db.integration.findUnique({
      where: {
        tenantId_provider: {
          tenantId: membership.tenantId,
          provider: 'shipstation',
        },
      },
      select: {
        enabled: true,
        config: true,
      },
    })

    if (!integration?.enabled) {
      return NextResponse.json(
        { error: 'ShipStation integration is not enabled' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { fromAddress, toAddress, cartons, shipDate, confirmation, residential } = body

    // Validate required fields
    if (!fromAddress || !toAddress || !cartons || cartons.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: fromAddress, toAddress, or cartons' },
        { status: 400 }
      )
    }

    // Get ShipStation client
    const client = await getShipStationClient(membership.tenantId)

    // Get carrier IDs from config
    const configCarrierIds = (integration.config as any)?.carrierIds || []

    // Build rate estimate requests (one per carton)
    const rateEstimates = []

    for (let i = 0; i < cartons.length; i++) {
      const carton = cartons[i]

      // Validate weight
      if (!carton.weight || parseFloat(carton.weight) <= 0) {
        return NextResponse.json(
          { error: `Carton ${i + 1}: Weight is required and must be greater than 0` },
          { status: 400 }
        )
      }

      const estimateRequest: any = {
        from_country_code: fromAddress.countryCode || 'US',
        from_postal_code: fromAddress.postalCode,
        from_city_locality: fromAddress.city,
        from_state_province: fromAddress.state,
        to_country_code: toAddress.countryCode || 'US',
        to_postal_code: toAddress.postalCode,
        to_city_locality: toAddress.city,
        to_state_province: toAddress.state,
        weight: {
          value: parseFloat(carton.weight),
          unit: 'pound',
        },
        ship_date: shipDate ? new Date(shipDate).toISOString() : new Date().toISOString(),
        confirmation: confirmation || 'none',
        address_residential_indicator: residential || 'unknown',
      }

      // Add dimensions if provided
      if (carton.length && carton.width && carton.height) {
        const length = parseFloat(carton.length)
        const width = parseFloat(carton.width)
        const height = parseFloat(carton.height)

        if (!isNaN(length) && !isNaN(width) && !isNaN(height) && length > 0 && width > 0 && height > 0) {
          estimateRequest.dimensions = {
            unit: 'inch',
            length,
            width,
            height,
          }
        }
      }

      // Add carrier IDs if configured
      if (configCarrierIds.length > 0) {
        estimateRequest.carrier_ids = configCarrierIds
      }

      rateEstimates.push(estimateRequest)
    }

    console.log('Rate estimate requests:', JSON.stringify(rateEstimates, null, 2))

    // Get rate estimates from ShipStation for each carton
    const allRates: any[] = []

    for (let i = 0; i < rateEstimates.length; i++) {
      try {
        const response = await fetch('https://api.shipengine.com/v1/rates/estimate', {
          method: 'POST',
          headers: {
            'API-Key': (client as any).apiKey || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(rateEstimates[i]),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          console.error(`Rate estimate error for carton ${i + 1}:`, error)
          // Continue with other cartons even if one fails
          continue
        }

        const data = await response.json()

        // Add carton information to each rate
        if (Array.isArray(data)) {
          data.forEach((rate: any) => {
            allRates.push({
              ...rate,
              cartonIndex: i,
            })
          })
        }
      } catch (err) {
        console.error(`Error getting rate estimate for carton ${i + 1}:`, err)
        // Continue with other cartons
      }
    }

    // Group rates by carrier and service, summing costs for multi-carton shipments
    const ratesByService = new Map<string, any>()

    allRates.forEach((rate) => {
      const key = `${rate.carrier_id}-${rate.service_code}`

      if (!ratesByService.has(key)) {
        ratesByService.set(key, {
          carrierId: rate.carrier_id,
          carrierCode: rate.carrier_code,
          serviceCode: rate.service_code,
          carrier: rate.carrier_friendly_name || rate.carrier_nickname || rate.carrier_code,
          service: rate.service_type,
          amount: 0,
          shippingAmount: 0,
          insuranceAmount: 0,
          confirmationAmount: 0,
          otherAmount: 0,
          currency: rate.shipping_amount?.currency || 'usd',
          deliveryDays: rate.delivery_days,
          estimatedDeliveryDate: rate.estimated_delivery_date,
          cartonCount: 0,
        })
      }

      const existing = ratesByService.get(key)
      existing.amount += rate.shipping_amount?.amount || 0
      existing.shippingAmount += rate.shipping_amount?.amount || 0
      existing.insuranceAmount += rate.insurance_amount?.amount || 0
      existing.confirmationAmount += rate.confirmation_amount?.amount || 0
      existing.otherAmount += rate.other_amount?.amount || 0
      existing.cartonCount += 1
    })

    // Convert map to array and sort by amount
    const rates = Array.from(ratesByService.values()).sort((a, b) => a.amount - b.amount)

    return NextResponse.json({
      success: true,
      data: {
        rates,
        cartonCount: cartons.length,
      },
    })
  } catch (error: any) {
    console.error('ShipStation rate estimate error:', error)

    // Extract meaningful error message
    let errorMessage = 'Failed to get rate estimates'
    if (error.response?.data?.errors) {
      const errors = error.response.data.errors
      errorMessage = errors.map((e: any) => e.message).join(', ')
    } else if (error.message) {
      errorMessage = error.message
    }

    return NextResponse.json(
      {
        error: `ShipStation API error: ${errorMessage}`,
        details: error.response?.data
      },
      { status: error.response?.status || 500 }
    )
  }
}

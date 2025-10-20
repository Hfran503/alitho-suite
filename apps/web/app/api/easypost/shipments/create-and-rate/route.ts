import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getEasyPostClient } from '@/lib/easypost'

/**
 * POST /api/easypost/shipments/create-and-rate
 * Create an EasyPost shipment and get available rates
 */
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

    const body = await req.json()
    const { fromAddress, toAddress, parcel, parcels } = body

    // Support both single parcel and multiple parcels (multi-piece shipment)
    const parcelList = parcels || (parcel ? [parcel] : null)

    // Validate required fields
    if (!fromAddress || !toAddress || !parcelList) {
      return NextResponse.json(
        { error: 'Missing required fields: fromAddress, toAddress, parcel or parcels' },
        { status: 400 }
      )
    }

    // Validate all parcels have dimensions
    for (const p of parcelList) {
      if (!p.length || !p.width || !p.height || !p.weight) {
        return NextResponse.json(
          { error: 'Each parcel must include length, width, height, and weight' },
          { status: 400 }
        )
      }
    }

    // Get EasyPost client for this tenant
    const easypost = await getEasyPostClient(membership.tenantId)

    // For multi-piece shipments, EasyPost doesn't support automatic rate shopping with parcels array
    // Instead, we'll create individual shipments for each parcel and aggregate rates
    // Then store all shipment IDs for later purchasing

    if (parcelList.length > 1) {
      console.log(`Creating ${parcelList.length} individual shipments for rate shopping...`)

      // Create a shipment for each parcel to get individual rates
      const shipmentPromises = parcelList.map(async (p: any, index: number) => {
        const singleShipmentData = {
          from_address: {
            name: fromAddress.name || fromAddress.company || 'Sender',
            company: fromAddress.company,
            street1: fromAddress.street1 || fromAddress.address1,
            street2: fromAddress.street2 || fromAddress.address2,
            city: fromAddress.city,
            state: fromAddress.state,
            zip: fromAddress.zip,
            country: fromAddress.country || 'US',
            phone: fromAddress.phone,
            email: fromAddress.email,
          },
          to_address: {
            name: toAddress.name || toAddress.contactName || 'Recipient',
            company: toAddress.company,
            street1: toAddress.street1 || toAddress.address1,
            street2: toAddress.street2 || toAddress.address2,
            street3: toAddress.street3 || toAddress.address3,
            city: toAddress.city,
            state: toAddress.state,
            zip: toAddress.zip,
            country: toAddress.country || 'US',
            phone: toAddress.phone,
            email: toAddress.email,
          },
          parcel: {
            length: parseFloat(p.length),
            width: parseFloat(p.width),
            height: parseFloat(p.height),
            weight: parseFloat(p.weight),
          },
        }

        console.log(`Creating shipment ${index + 1} of ${parcelList.length}...`)
        return await easypost.Shipment.create(singleShipmentData)
      })

      const shipments = await Promise.all(shipmentPromises)
      console.log(`Created ${shipments.length} shipments`)

      // Aggregate rates by carrier + service across all shipments
      const rateMap = new Map<string, any>()

      shipments.forEach((ship, index) => {
        console.log(`Shipment ${index + 1} rates count:`, ship.rates?.length || 0)

        if (ship.rates) {
          ship.rates.forEach((rate: any) => {
            const key = `${rate.carrier}:${rate.service}`
            const existing = rateMap.get(key)

            if (existing) {
              // Add this shipment's rate to the total
              existing.rate += parseFloat(rate.rate)
              if (rate.list_rate) existing.listRate += parseFloat(rate.list_rate)
              if (rate.retail_rate) existing.retailRate += parseFloat(rate.retail_rate)
              existing.shipmentIds.push(ship.id)
              existing.rateIds.push(rate.id)
            } else {
              // First shipment with this carrier/service
              rateMap.set(key, {
                id: rate.id, // We'll use the first rate's ID as reference
                carrier: rate.carrier,
                service: rate.service,
                rate: parseFloat(rate.rate), // Negotiated/actual rate you'll pay
                listRate: rate.list_rate ? parseFloat(rate.list_rate) : null, // Published rate
                retailRate: rate.retail_rate ? parseFloat(rate.retail_rate) : null, // Retail/post office rate
                currency: rate.currency,
                deliveryDays: rate.delivery_days,
                deliveryDate: rate.delivery_date,
                deliveryDateGuaranteed: rate.delivery_date_guaranteed,
                estDeliveryDays: rate.est_delivery_days,
                carrierAccountId: rate.carrier_account_id,
                shipmentIds: [ship.id],
                rateIds: [rate.id],
              })
            }
          })
        }
      })

      const aggregatedRates = Array.from(rateMap.values()).sort((a, b) => a.rate - b.rate)
      console.log(`Aggregated ${aggregatedRates.length} rate options`)

      return NextResponse.json({
        success: true,
        data: {
          shipmentId: 'multi:' + shipments.map(s => s.id).join(','), // Special format for multi-piece
          shipmentIds: shipments.map(s => s.id),
          rates: aggregatedRates,
          fromAddress: shipments[0].from_address,
          toAddress: shipments[0].to_address,
          parcels: parcelList,
        },
      })
    }

    // Single parcel - original flow
    const shipmentData = {
      from_address: {
        name: fromAddress.name || fromAddress.company || 'Sender',
        company: fromAddress.company,
        street1: fromAddress.street1 || fromAddress.address1,
        street2: fromAddress.street2 || fromAddress.address2,
        city: fromAddress.city,
        state: fromAddress.state,
        zip: fromAddress.zip,
        country: fromAddress.country || 'US',
        phone: fromAddress.phone,
        email: fromAddress.email,
      },
      to_address: {
        name: toAddress.name || toAddress.contactName || 'Recipient',
        company: toAddress.company,
        street1: toAddress.street1 || toAddress.address1,
        street2: toAddress.street2 || toAddress.address2,
        street3: toAddress.street3 || toAddress.address3,
        city: toAddress.city,
        state: toAddress.state,
        zip: toAddress.zip,
        country: toAddress.country || 'US',
        phone: toAddress.phone,
        email: toAddress.email,
      },
      parcel: {
        length: parseFloat(parcelList[0].length),
        width: parseFloat(parcelList[0].width),
        height: parseFloat(parcelList[0].height),
        weight: parseFloat(parcelList[0].weight),
      },
    }

    // Create the shipment
    console.log('Creating single shipment...')
    const shipment = await easypost.Shipment.create(shipmentData)
    console.log('Shipment created:', shipment.id, 'Rates count:', shipment.rates?.length || 0)

    // Extract and format rates
    const rates = shipment.rates?.map((rate: any) => ({
      id: rate.id,
      carrier: rate.carrier,
      service: rate.service,
      rate: parseFloat(rate.rate), // Negotiated/actual rate you'll pay
      listRate: rate.list_rate ? parseFloat(rate.list_rate) : null, // Published rate
      retailRate: rate.retail_rate ? parseFloat(rate.retail_rate) : null, // Retail/post office rate
      currency: rate.currency,
      deliveryDays: rate.delivery_days,
      deliveryDate: rate.delivery_date,
      deliveryDateGuaranteed: rate.delivery_date_guaranteed,
      estDeliveryDays: rate.est_delivery_days,
      carrierAccountId: rate.carrier_account_id,
    })) || []

    return NextResponse.json({
      success: true,
      data: {
        shipmentId: shipment.id,
        shipmentIds: [shipment.id],
        rates: rates.sort((a, b) => a.rate - b.rate), // Sort by price
        fromAddress: shipment.from_address,
        toAddress: shipment.to_address,
        parcel: shipment.parcel,
      },
    })
  } catch (error: any) {
    console.error('Create and rate shipment error:', error)

    // Handle EasyPost-specific errors
    if (error.statusCode) {
      return NextResponse.json(
        {
          error: 'EasyPost API error',
          message: error.message || 'Failed to create shipment',
          details: error.error?.message,
        },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create shipment and get rates' },
      { status: 500 }
    )
  }
}

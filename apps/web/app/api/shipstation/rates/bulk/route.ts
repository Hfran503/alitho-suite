import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getShipStationClient } from '@/lib/shipstation'

// POST /api/shipstation/rates/bulk - Get bulk shipping rates for multiple destinations
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
    const { shipFrom, destinations, carrierId, serviceCode } = body

    // Validate required fields
    if (!shipFrom || !destinations || destinations.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: shipFrom or destinations' },
        { status: 400 }
      )
    }

    if (!carrierId) {
      return NextResponse.json(
        { error: 'Carrier ID is required for bulk rates' },
        { status: 400 }
      )
    }

    // Get ShipStation client
    const client = await getShipStationClient(membership.tenantId)

    // Get carrier markup configuration (both percent and dollar)
    const carriers = (integration.config as any)?.carriers || []
    const carrierMarkupMap = new Map<string, { percent: number; dollar: number }>()
    carriers.forEach((carrier: any) => {
      if (carrier.id) {
        carrierMarkupMap.set(carrier.id, {
          percent: carrier.estimateRateMarkup || 0,
          dollar: carrier.estimateRateMarkupDollar || 0,
        })
      }
    })

    // Helper to clean string values - convert empty strings to undefined
    const cleanString = (value: any): string | undefined => {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return undefined
      }
      return String(value).trim()
    }

    // Build ship_from object once (same for all shipments)
    const ship_from = {
      name: cleanString(shipFrom.name) || 'Sender',
      phone: cleanString(shipFrom.phone),
      company_name: cleanString(shipFrom.company),
      address_line1: cleanString(shipFrom.street1) || '',
      address_line2: cleanString(shipFrom.street2),
      city_locality: cleanString(shipFrom.city) || '',
      state_province: cleanString(shipFrom.state) || '',
      postal_code: cleanString(shipFrom.zip) || '',
      country_code: cleanString(shipFrom.country) || 'US',
      address_residential_indicator: 'no' as const,
    }

    // Build shipments array for bulk request
    const shipments = destinations.map((dest: any) => {
      const packages = [{
        weight: {
          value: parseFloat(dest.weight) || 1,
          unit: 'pound' as const,
        },
        ...(dest.length && dest.width && dest.height ? {
          dimensions: {
            length: parseFloat(dest.length),
            width: parseFloat(dest.width),
            height: parseFloat(dest.height),
            unit: 'inch' as const,
          }
        } : {}),
      }]

      return {
        ship_to: {
          name: cleanString(dest.name) || 'Recipient',
          phone: cleanString(dest.phone),
          company_name: cleanString(dest.company),
          address_line1: cleanString(dest.street1) || '',
          address_line2: cleanString(dest.street2),
          city_locality: cleanString(dest.city) || '',
          state_province: cleanString(dest.state) || '',
          postal_code: cleanString(dest.zip) || '',
          country_code: cleanString(dest.country) || 'US',
          address_residential_indicator: dest.residential ? 'yes' as const : 'unknown' as const,
        },
        ship_from,
        packages,
        confirmation: 'none' as const,
        // Store destination ID for mapping results back
        external_shipment_id: dest.id,
      }
    })

    // Build rate options
    const rate_options: any = {
      carrier_ids: [carrierId],
    }
    if (serviceCode) {
      rate_options.service_codes = [serviceCode]
    }

    console.log(`[Bulk Rates] Requesting rates for ${shipments.length} shipments`)

    // Submit bulk rate request
    const bulkResponse = await client.getBulkRates({
      shipments,
      rate_options,
    })

    console.log('[Bulk Rates] Initial response:', JSON.stringify(bulkResponse, null, 2))

    // The bulk API is async, so we need to poll for results
    // We'll return the initial response with rate_request_ids and let the frontend poll
    return NextResponse.json({
      success: true,
      data: {
        requests: bulkResponse,
        carrierId,
        serviceCode,
        markup: carrierMarkupMap.get(carrierId) || { percent: 0, dollar: 0 },
      },
    })
  } catch (error: any) {
    console.error('ShipStation bulk rates error:', error)
    return NextResponse.json(
      { error: `ShipStation API error: ${error.message}` },
      { status: 500 }
    )
  }
}

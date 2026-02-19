import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getShipStationClient } from '@/lib/shipstation'

// POST /api/shipstation/rates - Get shipping rates
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
    const { shipFrom, shipTo, packages, carrierIds, serviceCode, residential, confirmation } = body

    // Validate required fields
    if (!shipFrom || !shipTo || !packages || packages.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: shipFrom, shipTo, or packages' },
        { status: 400 }
      )
    }

    // Get ShipStation client
    const client = await getShipStationClient(membership.tenantId)

    // Get carrier IDs from config if not provided
    const configCarrierIds = (integration.config as any)?.carrierIds || []
    const requestCarrierIds = carrierIds || configCarrierIds

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

    // Helper to ensure positive numeric value
    const cleanNumber = (value: any): number => {
      const num = parseFloat(value)
      if (isNaN(num) || num <= 0) {
        throw new Error(`Invalid numeric value: ${value}`)
      }
      return num
    }

    // Build rate request
    const rateRequest = {
      shipment: {
        ship_from: {
          name: cleanString(shipFrom.name) || 'Sender',
          phone: cleanString(shipFrom.phone),
          company_name: cleanString(shipFrom.company),
          address_line1: cleanString(shipFrom.street1) || '',
          address_line2: cleanString(shipFrom.street2),
          city_locality: cleanString(shipFrom.city) || '',
          state_province: cleanString(shipFrom.state) || '',
          postal_code: cleanString(shipFrom.zip) || '',
          country_code: cleanString(shipFrom.country) || 'US',
        },
        ship_to: {
          name: cleanString(shipTo.name) || 'Recipient',
          phone: cleanString(shipTo.phone),
          company_name: cleanString(shipTo.company),
          address_line1: cleanString(shipTo.street1) || '',
          address_line2: cleanString(shipTo.street2),
          city_locality: cleanString(shipTo.city) || '',
          state_province: cleanString(shipTo.state) || '',
          postal_code: cleanString(shipTo.zip) || '',
          country_code: cleanString(shipTo.country) || 'US',
          address_residential_indicator: residential === 'yes' ? 'yes' : residential === 'no' ? 'no' : 'unknown',
        },
        confirmation: confirmation && confirmation !== 'none' ? confirmation : undefined,
        packages: packages.map((pkg: any) => {
          const packageData: any = {
            weight: {
              value: cleanNumber(pkg.weight),
              unit: pkg.weightUnit || 'pound',
            },
          }

          // Only include dimensions if all three are provided and valid
          if (pkg.length && pkg.width && pkg.height) {
            try {
              packageData.dimensions = {
                length: cleanNumber(pkg.length),
                width: cleanNumber(pkg.width),
                height: cleanNumber(pkg.height),
                unit: pkg.dimensionUnit || 'inch',
              }
            } catch (e) {
              // Skip dimensions if any are invalid
              console.warn('Skipping invalid dimensions:', e)
            }
          }

          return packageData
        }),
      },
      rate_options:
        requestCarrierIds.length > 0 || serviceCode
          ? {
              carrier_ids: requestCarrierIds.length > 0 ? requestCarrierIds : undefined,
              service_codes: serviceCode ? [serviceCode] : undefined,
            }
          : undefined,
    }

    // Log the request for debugging
    console.log('ShipStation rate request:', JSON.stringify(rateRequest, null, 2))

    // Get rates from ShipStation
    const ratesResponse = await client.getRates(rateRequest)

    // Transform response to match expected format
    const rates = ratesResponse.rate_response?.rates || []

    return NextResponse.json({
      success: true,
      data: {
        rates: rates.map((rate: any) => {
          // Calculate total amount from all components
          const shippingAmount = rate.shipping_amount?.amount || 0
          const insuranceAmount = rate.insurance_amount?.amount || 0
          const confirmationAmount = rate.confirmation_amount?.amount || 0
          const otherAmount = rate.other_amount?.amount || 0
          const carrierTotal = shippingAmount + insuranceAmount + confirmationAmount + otherAmount
          let totalAmount = carrierTotal

          // Apply markup if configured for this carrier (both percent and dollar)
          const markup = carrierMarkupMap.get(rate.carrier_id)
          let markupAmount = 0
          let processingCost = 0

          if (markup) {
            // Apply percentage markup first (this is the "Markup")
            if (markup.percent > 0) {
              markupAmount = totalAmount * (markup.percent / 100)
              totalAmount = totalAmount + markupAmount
            }
            // Then apply dollar markup (this is the "Processing Fee")
            if (markup.dollar > 0) {
              processingCost = markup.dollar
              totalAmount = totalAmount + processingCost
            }
          }

          const hasProcessingCost = processingCost > 0
          const hasMarkup = markupAmount > 0

          return {
            rateId: rate.rate_id,
            carrierId: rate.carrier_id,
            carrierCode: rate.carrier_code,
            carrierNickname: rate.carrier_nickname,
            serviceCode: rate.service_code,
            serviceType: rate.service_type,
            shipDate: rate.ship_date,
            deliveryDays: rate.delivery_days,
            estimatedDeliveryDate: rate.estimated_delivery_date,
            // Total amount includes all surcharges + markup + processing cost
            amount: totalAmount,
            hasProcessingCost: hasProcessingCost,
            processingCost: processingCost,
            hasMarkup: hasMarkup,
            markupAmount: markupAmount,
            // Component breakdown
            shippingAmount: shippingAmount,
            insuranceAmount: insuranceAmount,
            confirmationAmount: confirmationAmount,
            otherAmount: otherAmount,
            currency: rate.shipping_amount?.currency || 'usd',
            carrier: rate.carrier_friendly_name,
            service: rate.service_type,
            packageType: rate.package_type,
            zone: rate.zone,
            negotiatedRate: rate.negotiated_rate,
            validationStatus: rate.validation_status,
            warningMessages: rate.warning_messages,
            errorMessages: rate.error_messages,
            rateAttributes: rate.rate_attributes, // best_value, cheapest, fastest
            // Detailed breakdown from ShipStation
            rateDetails: rate.rate_details?.map((detail: any) => ({
              type: detail.rate_detail_type,
              description: detail.carrier_description,
              billingCode: detail.carrier_billing_code,
              memo: detail.carrier_memo,
              amount: detail.amount?.amount || 0,
              currency: detail.amount?.currency || 'usd',
              billingSource: detail.billing_source,
            })) || [],
          }
        }),
        invalidRates: ratesResponse.rate_response?.invalid_rates || [],
        rateRequestId: ratesResponse.rate_response?.rate_request_id,
      },
    })
  } catch (error: any) {
    console.error('ShipStation get rates error:', error)

    // Log more details about the error
    if (error.response) {
      console.error('ShipStation API response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      })
    }

    // Extract meaningful error message
    let errorMessage = 'Failed to get shipping rates'
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

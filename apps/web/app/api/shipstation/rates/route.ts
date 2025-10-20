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
    const { shipFrom, shipTo, packages, carrierIds } = body

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

    // Build rate request
    const rateRequest = {
      shipment: {
        ship_from: {
          name: shipFrom.name,
          phone: shipFrom.phone,
          company_name: shipFrom.company,
          address_line1: shipFrom.street1,
          address_line2: shipFrom.street2,
          city_locality: shipFrom.city,
          state_province: shipFrom.state,
          postal_code: shipFrom.zip,
          country_code: shipFrom.country || 'US',
        },
        ship_to: {
          name: shipTo.name,
          phone: shipTo.phone,
          company_name: shipTo.company,
          address_line1: shipTo.street1,
          address_line2: shipTo.street2,
          city_locality: shipTo.city,
          state_province: shipTo.state,
          postal_code: shipTo.zip,
          country_code: shipTo.country || 'US',
        },
        packages: packages.map((pkg: any) => ({
          weight: {
            value: pkg.weight,
            unit: pkg.weightUnit || 'pound',
          },
          dimensions: pkg.length &&
            pkg.width &&
            pkg.height && {
              length: pkg.length,
              width: pkg.width,
              height: pkg.height,
              unit: pkg.dimensionUnit || 'inch',
            },
        })),
      },
      rate_options:
        requestCarrierIds.length > 0
          ? {
              carrier_ids: requestCarrierIds,
            }
          : undefined,
    }

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
          const totalAmount = shippingAmount + insuranceAmount + confirmationAmount + otherAmount

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
            // Total amount includes all surcharges
            amount: totalAmount,
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
    return NextResponse.json(
      { error: error.message || 'Failed to get shipping rates' },
      { status: 500 }
    )
  }
}

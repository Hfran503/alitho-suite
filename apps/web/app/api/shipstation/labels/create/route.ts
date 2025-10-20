import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getShipStationClient } from '@/lib/shipstation'

// POST /api/shipstation/labels/create - Create shipping labels
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
      },
    })

    if (!integration?.enabled) {
      return NextResponse.json(
        { error: 'ShipStation integration is not enabled' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const {
      shipmentId,
      carrierId,
      serviceCode,
      shipFrom,
      shipTo,
      packages,
      labelFormat,
      labelLayout,
      shipDate,
      isReturnLabel,
      rmaNumber,
      chargeEvent,
      outboundLabelId,
    } = body

    // Validate required fields
    if (
      !shipmentId ||
      !carrierId ||
      !serviceCode ||
      !shipFrom ||
      !shipTo ||
      !packages ||
      packages.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: shipmentId, carrierId, serviceCode, shipFrom, shipTo, or packages',
        },
        { status: 400 }
      )
    }

    // Get ShipStation client
    const client = await getShipStationClient(membership.tenantId)

    // Build label request
    const labelRequest: any = {
      shipment: {
        carrier_id: carrierId,
        service_code: serviceCode,
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
          label_messages: pkg.label_messages ? {
            reference1: pkg.label_messages.reference1 || null,
            reference2: pkg.label_messages.reference2 || null,
            reference3: pkg.label_messages.reference3 || null,
          } : undefined,
        })),
      },
      label_format: labelFormat || 'pdf',
      label_layout: labelLayout || '4x6',
    }

    // Add ship date if provided
    if (shipDate) {
      labelRequest.shipment.ship_date = shipDate
    }

    // Add return label options if this is a return label
    if (isReturnLabel) {
      labelRequest.is_return_label = true

      if (rmaNumber) {
        labelRequest.rma_number = rmaNumber
      }

      if (outboundLabelId) {
        labelRequest.outbound_label_id = outboundLabelId
      }

      if (chargeEvent) {
        labelRequest.charge_event = chargeEvent
      }
    }

    // Log the request for debugging
    console.log('ShipStation Label Request:', JSON.stringify(labelRequest, null, 2))

    // Create labels in ShipStation
    const labelResponse = await client.createLabels(labelRequest)

    // Log full response to see all available cost data
    console.log('ShipStation Label Response (costs):', {
      shipment_cost: labelResponse.shipment_cost,
      insurance_cost: labelResponse.insurance_cost,
      confirmation_cost: labelResponse.confirmation_cost,
      other_cost: labelResponse.other_cost,
      packages: labelResponse.packages,
    })

    // Extract individual package information from the ShipStation response
    const responsePackages = labelResponse.packages || []

    console.log('Processing packages from ShipStation response:', {
      packageCount: responsePackages.length,
      packages: responsePackages.map((pkg: any) => ({
        package_id: pkg.package_id,
        tracking_number: pkg.tracking_number,
        sequence: pkg.sequence,
      })),
    })

    // Note: Carton tracking info updates are handled by the modal component
    // which calls /api/pace/shipments/[id]/create-parcel-carton
    // to create cartons with tracking information in the PACE system

    return NextResponse.json({
      success: true,
      data: {
        shipmentId: labelResponse.shipment_id,
        labelId: labelResponse.label_id, // For voiding the label
        trackingNumber: labelResponse.tracking_number, // Primary tracking number
        labelUrl: labelResponse.label_download?.href,
        labelPdf: labelResponse.label_download?.pdf,
        totalCost: labelResponse.shipment_cost?.amount,
        currency: labelResponse.shipment_cost?.currency,
        isReturnLabel: isReturnLabel || false,
        rmaNumber: rmaNumber,
        // Individual packages with their own tracking numbers
        packages: responsePackages.map((pkg: any) => ({
          packageId: pkg.package_id,
          trackingNumber: pkg.tracking_number,
          labelDownload: pkg.label_download,
          // For multi-package shipments, ShipEngine creates one label with multiple packages
          // The label_id is on the parent shipment, not individual packages
          labelId: labelResponse.label_id, // Same label ID for all packages in this shipment
          sequence: pkg.sequence,
          weight: pkg.weight,
          dimensions: pkg.dimensions,
        })),
        // Cost breakdown
        costBreakdown: {
          shipmentCost: labelResponse.shipment_cost?.amount || 0,
          insuranceCost: labelResponse.insurance_cost?.amount || 0,
          confirmationCost: labelResponse.confirmation_cost?.amount || 0,
          otherCost: labelResponse.other_cost?.amount || 0,
        },
      },
    })
  } catch (error: any) {
    console.error('ShipStation create labels error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create shipping labels' },
      { status: 500 }
    )
  }
}

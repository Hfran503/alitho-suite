import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPaceApiCredentials } from '@/lib/secrets'
import { db } from '@repo/database'

/**
 * POST /api/pace/shipments/[id]/create-parcel-carton
 * Create a carton in PACE with tracking information and shipping cost from EasyPost
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shipmentId } = await params
    const body = await req.json()

    const {
      count = 1,
      weight,
      trackingNumber,
      trackingLink,
      carrier,
      service,
      shippingCost,
      length,
      width,
      height,
      contents = [],
      easypostShipmentId, // Store EasyPost shipment ID for later refund/cancellation
      shipstationShipmentId, // Store ShipStation shipment ID for label reprint
      shipstationLabelId, // Store ShipStation label ID for reprint
      labelUrl, // Direct label URL
      shipFrom, // Ship from address
      shipTo, // Ship to address
      provider, // "easypost" or "shipstation"
    } = body

    // Validate required fields
    if (!weight) {
      return NextResponse.json({ error: 'Weight is required' }, { status: 400 })
    }

    if (!trackingNumber) {
      return NextResponse.json(
        { error: 'Tracking number is required' },
        { status: 400 }
      )
    }

    // Get PACE credentials
    const { url: paceUrl, username, password } = await getPaceApiCredentials()

    // Prepare carton data
    const cartonData: any = {
      shipment: parseInt(shipmentId),
      count: count,
      weight: parseFloat(weight),
      trackingNumber: trackingNumber,
      addDefaultContent: false,
    }

    // Add optional fields if provided
    if (trackingLink) {
      cartonData.trackingLink = trackingLink
    }

    // Add dimensions if provided (check if PACE supports these fields)
    if (length && width && height) {
      cartonData.u_length = parseFloat(length)
      cartonData.u_width = parseFloat(width)
      cartonData.u_height = parseFloat(height)
    }

    // Add carrier and service info in note (clean for packing slips - no cost or internal IDs)
    const notesParts = []
    if (carrier) notesParts.push(`Carrier: ${carrier}`)
    if (service) notesParts.push(`Service: ${service}`)

    if (notesParts.length > 0) {
      cartonData.note = notesParts.join(' | ')
    }

    // Store cost in dedicated cost field (not in note)
    if (shippingCost) {
      cartonData.cost = parseFloat(shippingCost)
    }

    // Store EasyPost shipment ID in custom field (not in note)
    if (easypostShipmentId) {
      cartonData.u_easypost_shipment_id = easypostShipmentId
    }

    // Store ShipStation shipment ID in custom field (not in note)
    if (shipstationShipmentId) {
      cartonData.u_shipstation_shipment_id = shipstationShipmentId
    }

    // Note: ShipStation label ID is stored in our ShippingLabel table, not in PACE
    // This allows for voiding/reprinting without cluttering PACE custom fields

    // Create the carton in PACE
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

    const cartonResponse = await fetch(`${paceUrl}/CreateObject/createCarton`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        Accept: 'application/json',
      },
      body: JSON.stringify(cartonData),
    })

    if (!cartonResponse.ok) {
      const errorText = await cartonResponse.text()
      console.error('PACE createCarton error:', errorText)
      return NextResponse.json(
        { error: 'Failed to create carton in PACE', details: errorText },
        { status: cartonResponse.status }
      )
    }

    const cartonResult = await cartonResponse.json()
    const cartonId = cartonResult.id

    console.log('Created carton in PACE:', cartonId)

    // Create carton contents if provided
    const createdContents = []
    for (const content of contents) {
      const contentData: any = {
        carton: cartonId,
        quantity: content.quantity,
      }

      // Handle different content types (component, product, job, part)
      // IMPORTANT: For JobPart references, use jobPartJob field (not job field)
      if (content.jobPartJob && content.jobPart) {
        // This is a JobPart reference - sent from ProcessShipmentParcelModal
        contentData.jobPartJob = content.jobPartJob
        contentData.jobPart = content.jobPart
      } else if (content.job) {
        // For JobPart references that come with content.job + content.jobPart
        if (content.jobPart) {
          contentData.jobPartJob = content.job
          contentData.jobPart = content.jobPart
        } else {
          // This is a Job reference
          contentData.job = content.job
        }
      } else if (content.jobPart) {
        // Legacy: just jobPart without jobPartJob (shouldn't happen anymore)
        contentData.jobPart = content.jobPart
      }

      if (content.jobComponent) {
        contentData.jobComponent = content.jobComponent
      }
      if (content.jobProduct) {
        contentData.jobProduct = content.jobProduct
      }
      if (content.description) {
        contentData.description = content.description
      }

      const contentResponse = await fetch(
        `${paceUrl}/CreateObject/createCartonContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
            Accept: 'application/json',
          },
          body: JSON.stringify(contentData),
        }
      )

      if (!contentResponse.ok) {
        const errorText = await contentResponse.text()
        console.error('PACE createCartonContent error:', errorText)
        // Continue creating other contents even if one fails
        continue
      }

      const contentResult = await contentResponse.json()
      createdContents.push(contentResult)
    }

    // NOTE: We no longer update the shipment here on each carton creation
    // Instead, call /api/pace/shipments/[id]/update-tracking after all cartons are created
    // This ensures the shipment has the total cost and all tracking numbers

    // Save shipping label to database if provider info is available
    if (provider && labelUrl && shipFrom && shipTo) {
      try {
        const session = await getServerSession(authOptions)
        if (session?.user) {
          const membership = await db.membership.findFirst({
            where: { userId: session.user.id },
          })

          if (membership) {
            await db.shippingLabel.create({
              data: {
                tenantId: membership.tenantId,
                paceShipmentId: parseInt(shipmentId),
                paceCartonId: cartonId,
                provider: provider,
                providerShipmentId: provider === 'easypost' ? easypostShipmentId : shipstationShipmentId,
                providerLabelId: provider === 'shipstation' ? shipstationLabelId : null,
                trackingNumber: trackingNumber,
                labelUrl: labelUrl,
                labelFormat: 'pdf',
                carrier: carrier || 'Unknown',
                service: service || 'Unknown',
                shipFrom: shipFrom,
                shipTo: shipTo,
                weight: weight ? parseFloat(weight.toString()) : null,
                length: length ? parseFloat(length.toString()) : null,
                width: width ? parseFloat(width.toString()) : null,
                height: height ? parseFloat(height.toString()) : null,
                cost: shippingCost ? parseFloat(shippingCost.toString()) : 0,
                currency: 'USD',
                status: 'active',
              },
            })
            console.log('Saved shipping label to database for carton:', cartonId)
          }
        }
      } catch (dbError) {
        console.error('Failed to save shipping label to database:', dbError)
        // Don't fail the request if database save fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        cartonId: cartonId,
        carton: cartonResult,
        contents: createdContents,
        trackingNumber: trackingNumber,
        trackingLink: trackingLink,
      },
    })
  } catch (error: any) {
    console.error('Create parcel carton error:', error)
    return NextResponse.json(
      { error: 'Failed to create parcel carton', message: error.message },
      { status: 500 }
    )
  }
}

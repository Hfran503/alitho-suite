import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/database'

/**
 * ShipStation Tracking Webhook Handler
 *
 * This endpoint receives tracking updates from ShipStation/ShipEngine
 * when shipment status changes occur (in transit, delivered, exceptions, etc.)
 *
 * Webhook URL to register in ShipStation (with Basic Auth):
 * https://username:password@calithosuite.com/api/webhooks/shipstation/track
 *
 * Set SHIPSTATION_WEBHOOK_USERNAME and SHIPSTATION_WEBHOOK_PASSWORD in your .env file
 *
 * Event Type: track
 */

interface TrackingEvent {
  occurred_at: string
  carrier_occurred_at: string
  description: string
  city_locality: string
  state_province: string
  postal_code: string
  country_code: string
  company_name: string
  signer: string
  event_code: string
  event_description: string
  carrier_detail_code: string | null
  status_code: string | null
  latitude: number | null
  longitude: number | null
}

interface TrackingWebhookPayload {
  resource_url: string
  resource_type: string
  data: {
    label_url: string | null
    tracking_number: string
    status_code: string
    carrier_detail_code: string | null
    status_description: string
    carrier_status_code: string
    carrier_status_description: string
    ship_date: string
    estimated_delivery_date: string | null
    actual_delivery_date: string | null
    exception_description: string | null
    events: TrackingEvent[]
  }
}

/**
 * Map ShipEngine status codes to human-readable statuses
 */
function mapStatusCode(statusCode: string): string {
  const statusMap: Record<string, string> = {
    'UN': 'unknown',           // Unknown - The carrier has not yet provided status
    'AC': 'accepted',          // Accepted - Package has been accepted by the carrier
    'IT': 'in_transit',        // In Transit - Package is in transit
    'DE': 'delivered',         // Delivered - Package has been delivered
    'EX': 'exception',         // Exception - An exception occurred (weather delay, etc.)
    'AT': 'attempted_delivery', // Attempted Delivery - Delivery was attempted but unsuccessful
    'NY': 'not_yet_in_system', // Not Yet in System - Tracking info not yet available
  }

  return statusMap[statusCode] || 'unknown'
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Basic Authentication
    const authHeader = request.headers.get('authorization')
    const expectedUsername = process.env.SHIPSTATION_WEBHOOK_USERNAME
    const expectedPassword = process.env.SHIPSTATION_WEBHOOK_PASSWORD

    if (expectedUsername && expectedPassword) {
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        console.warn('Webhook received without Basic Auth')
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const base64Credentials = authHeader.split(' ')[1]
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
      const [username, password] = credentials.split(':')

      if (username !== expectedUsername || password !== expectedPassword) {
        console.warn('Webhook received with invalid credentials')
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    // 2. Verify the request is from ShipStation by checking user-agent
    const userAgent = request.headers.get('user-agent') || ''
    if (!userAgent.includes('ShipEngine')) {
      console.warn('Webhook received from non-ShipEngine source:', userAgent)
      return NextResponse.json(
        { success: false, error: 'Invalid user-agent' },
        { status: 401 }
      )
    }

    // Parse the webhook payload
    const payload: TrackingWebhookPayload = await request.json()

    console.log('📦 Received tracking webhook:', {
      tracking_number: payload.data.tracking_number,
      status_code: payload.data.status_code,
      status_description: payload.data.status_description,
    })

    // Find the shipping label by tracking number
    const shippingLabel = await db.shippingLabel.findFirst({
      where: {
        trackingNumber: payload.data.tracking_number,
        provider: 'shipstation',
      },
      include: {
        tenant: true,
      },
    })

    if (!shippingLabel) {
      console.warn(`No shipping label found for tracking number: ${payload.data.tracking_number}`)
      // Return 200 to acknowledge receipt even if we don't have the label
      // This prevents ShipStation from retrying
      return NextResponse.json({
        success: true,
        message: 'Tracking number not found in system'
      })
    }

    // Map the status code to our internal status
    const trackingStatus = mapStatusCode(payload.data.status_code)

    // Prepare metadata with tracking info
    const existingMetadata = (shippingLabel.metadata as any) || {}
    const trackingMetadata = {
      ...existingMetadata,
      tracking: {
        status_code: payload.data.status_code,
        status_description: payload.data.status_description,
        carrier_status_code: payload.data.carrier_status_code,
        carrier_status_description: payload.data.carrier_status_description,
        ship_date: payload.data.ship_date,
        estimated_delivery_date: payload.data.estimated_delivery_date,
        actual_delivery_date: payload.data.actual_delivery_date,
        exception_description: payload.data.exception_description,
        last_event: payload.data.events[0] ? {
          occurred_at: payload.data.events[0].occurred_at,
          carrier_occurred_at: payload.data.events[0].carrier_occurred_at,
          description: payload.data.events[0].description,
          city_locality: payload.data.events[0].city_locality,
          state_province: payload.data.events[0].state_province,
          postal_code: payload.data.events[0].postal_code,
          country_code: payload.data.events[0].country_code,
          event_code: payload.data.events[0].event_code,
          event_description: payload.data.events[0].event_description,
        } : null,
        updated_at: new Date().toISOString(),
      },
    }

    // Update the shipping label with tracking information
    const updatedLabel = await db.shippingLabel.update({
      where: {
        id: shippingLabel.id,
      },
      data: {
        // Update tracking status
        trackingStatus: trackingStatus,
        lastTrackedAt: new Date(),
        // Update the label status if delivered
        ...(payload.data.status_code === 'DE' && {
          status: 'delivered',
        }),
        // Store detailed tracking info in metadata
        metadata: trackingMetadata,
      },
    })

    // Create an audit log entry
    await db.auditLog.create({
      data: {
        action: 'tracking_update',
        entityType: 'ShippingLabel',
        entityId: shippingLabel.id,
        tenantId: shippingLabel.tenantId,
        metadata: {
          tracking_number: payload.data.tracking_number,
          status_code: payload.data.status_code,
          status_description: payload.data.status_description,
          tracking_status: trackingStatus,
          webhook_received_at: new Date().toISOString(),
        },
      },
    })

    console.log('✅ Updated shipping label:', {
      id: updatedLabel.id,
      tracking_number: updatedLabel.trackingNumber,
      status: trackingStatus,
    })

    // TODO: Add custom business logic here
    // Examples:
    // - Send email notification to customer when delivered
    // - Update order status in your system
    // - Trigger alerts for exceptions
    // - Update PACE system if needed

    if (payload.data.status_code === 'DE') {
      // Package was delivered
      console.log('📬 Package delivered:', payload.data.tracking_number)

      // Example: Send email notification
      // const shipTo = updatedLabel.shipTo as any
      // await sendDeliveryNotificationEmail(shipTo.email, updatedLabel)
    }

    if (payload.data.status_code === 'EX') {
      // Exception occurred
      console.log('⚠️ Delivery exception:', {
        tracking_number: payload.data.tracking_number,
        exception: payload.data.exception_description,
      })

      // Example: Send alert to logistics team
      // await sendExceptionAlert(updatedLabel, payload.data.exception_description)
    }

    return NextResponse.json({
      success: true,
      tracking_number: payload.data.tracking_number,
      status: trackingStatus,
    })

  } catch (error) {
    console.error('Error processing tracking webhook:', error)

    // Return 200 even on error to prevent ShipStation from retrying
    // Log the error for manual investigation
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 200 })
  }
}

// Handle GET requests for testing
export async function GET() {
  return NextResponse.json({
    message: 'ShipStation Tracking Webhook Endpoint',
    status: 'active',
    instructions: 'This endpoint receives POST requests from ShipStation with tracking updates.',
    webhook_url: '/api/webhooks/shipstation/track',
    supported_events: ['track'],
  })
}

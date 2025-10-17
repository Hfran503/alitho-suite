import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/pace/fields - Get a sample JobShipment to see actual field names
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paceApiUrl = process.env.PACE_API_URL
    const paceUsername = process.env.PACE_USERNAME
    const pacePassword = process.env.PACE_PASSWORD

    if (!paceApiUrl || !paceUsername || !pacePassword) {
      return NextResponse.json({ error: 'PACE API not configured' }, { status: 500 })
    }

    const authHeader = `Basic ${Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')}`

    // Get a sample shipment ID - try with dot notation for current node
    // PACE XPath might need ./ prefix or specific syntax
    const queryParams = new URLSearchParams({
      type: 'JobShipment',
      xpath: './id > 0',  // Try ./ prefix for current node
      offset: '0',
      limit: '1',
    })

    console.log('Fetching sample JobShipment...')

    const searchResponse = await fetch(
      `${paceApiUrl}/FindObjects/findSortAndLimit?${queryParams.toString()}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([]),
      }
    )

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text()
      return NextResponse.json({
        error: 'Failed to search for shipments',
        details: errorText,
      }, { status: searchResponse.status })
    }

    const shipmentIds = await searchResponse.json()

    if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      return NextResponse.json({
        error: 'No shipments found',
        message: 'Try creating a test shipment in PACE first',
      })
    }

    // Fetch the first shipment to see its fields
    const detailResponse = await fetch(
      `${paceApiUrl}/ReadObject/readJobShipment?primaryKey=${shipmentIds[0]}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: '',
      }
    )

    if (!detailResponse.ok) {
      const errorText = await detailResponse.text()
      return NextResponse.json({
        error: 'Failed to fetch shipment details',
        details: errorText,
      }, { status: detailResponse.status })
    }

    const shipment = await detailResponse.json()

    // Extract all field names
    const fields = Object.keys(shipment).sort()
    const dateFields = fields.filter(f =>
      f.toLowerCase().includes('date') ||
      f.toLowerCase().includes('time')
    )

    return NextResponse.json({
      success: true,
      data: {
        sampleShipmentId: shipmentIds[0],
        totalFields: fields.length,
        allFields: fields,
        dateTimeFields: dateFields,
        sampleShipment: shipment,
      },
    })
  } catch (error) {
    console.error('Fields API error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

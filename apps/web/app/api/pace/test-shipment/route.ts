import { NextRequest, NextResponse } from 'next/server'

// GET /api/pace/test-shipment - Fetch one shipment to inspect its structure
export async function GET(_req: NextRequest) {
  try {
    const paceApiUrl = process.env.PACE_API_URL
    const paceUsername = process.env.PACE_USERNAME
    const pacePassword = process.env.PACE_PASSWORD

    if (!paceApiUrl || !paceUsername || !pacePassword) {
      return NextResponse.json(
        { error: 'PACE API not configured' },
        { status: 500 }
      )
    }

    const authHeader = `Basic ${Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')}`

    // First, get one shipment ID
    const findUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?type=JobShipment&xpath=@id>0&offset=0&limit=1`

    console.log('Fetching shipment IDs...')
    const findResponse = await fetch(findUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ xpath: '@id', descending: true }]),
    })

    if (!findResponse.ok) {
      const errorText = await findResponse.text()
      return NextResponse.json(
        { error: 'Failed to find shipments', details: errorText },
        { status: findResponse.status }
      )
    }

    const shipmentIds: string[] = await findResponse.json()

    if (shipmentIds.length === 0) {
      return NextResponse.json({ error: 'No shipments found' }, { status: 404 })
    }

    const shipmentId = shipmentIds[0]
    console.log('Fetching details for shipment:', shipmentId)

    // Now fetch the full shipment details
    const detailUrl = `${paceApiUrl}/ReadObject/readJobShipment?primaryKey=${shipmentId}`
    const detailResponse = await fetch(detailUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
      body: '',
    })

    if (!detailResponse.ok) {
      const errorText = await detailResponse.text()
      return NextResponse.json(
        { error: 'Failed to read shipment', details: errorText },
        { status: detailResponse.status }
      )
    }

    const shipment = await detailResponse.json()

    // Return all fields to inspect
    return NextResponse.json({
      success: true,
      shipmentId: shipmentId,
      allFields: Object.keys(shipment).sort(),
      sampleData: shipment,
      dateRelatedFields: Object.keys(shipment).filter(key =>
        key.toLowerCase().includes('date') ||
        key.toLowerCase().includes('time')
      ),
    })
  } catch (error) {
    console.error('Test shipment error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

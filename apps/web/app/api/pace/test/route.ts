import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/pace/test - Test PACE API connection
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get PACE API credentials from environment
    const paceApiUrl = process.env.PACE_API_URL
    const paceUsername = process.env.PACE_USERNAME
    const pacePassword = process.env.PACE_PASSWORD

    // Check configuration
    const config = {
      paceApiUrl: paceApiUrl ? 'configured' : 'missing',
      paceUsername: paceUsername ? 'configured' : 'missing',
      pacePassword: pacePassword ? 'configured' : 'missing',
    }

    if (!paceApiUrl || !paceUsername || !pacePassword) {
      return NextResponse.json({
        success: false,
        error: 'PACE API not fully configured',
        config,
      })
    }

    // Prepare Basic Auth header
    const authHeader = `Basic ${Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')}`

    // Test 1: Simple query to get one shipment
    // Try with @ prefix (standard XPath attribute syntax)
    const testXpath = '@id > 0'
    const queryParams = new URLSearchParams({
      type: 'JobShipment',
      xpath: testXpath,
      offset: '0',
      limit: '1',
    })

    const testUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${queryParams.toString()}`

    console.log('Testing PACE API:', {
      url: testUrl,
      hasAuth: !!authHeader,
    })

    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([]),
    })

    const responseText = await response.text()

    let parsedResponse
    try {
      parsedResponse = JSON.parse(responseText)
    } catch {
      parsedResponse = responseText
    }

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'PACE API request failed',
        details: {
          status: response.status,
          statusText: response.statusText,
          url: testUrl,
          response: parsedResponse,
        },
      })
    }

    // If we got shipment IDs, try to fetch one
    const shipmentIds = parsedResponse
    let shipmentDetail = null

    if (Array.isArray(shipmentIds) && shipmentIds.length > 0) {
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

      if (detailResponse.ok) {
        shipmentDetail = await detailResponse.json()
      } else {
        const detailErrorText = await detailResponse.text()
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch shipment details',
          details: {
            shipmentId: shipmentIds[0],
            status: detailResponse.status,
            response: detailErrorText,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'PACE API connection successful',
      data: {
        config: {
          url: paceApiUrl,
          username: paceUsername,
        },
        test: {
          queryUrl: testUrl,
          xpath: testXpath,
          shipmentIdsFound: Array.isArray(shipmentIds) ? shipmentIds.length : 0,
          sampleShipmentId: Array.isArray(shipmentIds) && shipmentIds.length > 0 ? shipmentIds[0] : null,
          sampleShipment: shipmentDetail,
        },
      },
    })
  } catch (error) {
    console.error('PACE test error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

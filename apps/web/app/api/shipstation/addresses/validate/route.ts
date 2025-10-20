import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getShipStationApiKey } from '@/lib/secrets'
import { db } from '@repo/database'

// POST /api/shipstation/addresses/validate - Validate an address using ShipStation
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
    const { address } = body

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    // Validate required fields
    if (!address.address_line1 || !address.city_locality || !address.state_province || !address.postal_code) {
      return NextResponse.json(
        { error: 'Missing required address fields: address_line1, city_locality, state_province, postal_code' },
        { status: 400 }
      )
    }

    const apiKey = await getShipStationApiKey(membership.tenantId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ShipStation API key not configured' },
        { status: 500 }
      )
    }

    // Call ShipStation/ShipEngine address validation API
    const shipStationResponse = await fetch('https://api.shipengine.com/v1/addresses/validate', {
      method: 'POST',
      headers: {
        'API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          name: address.name || '',
          company_name: address.company_name || '',
          address_line1: address.address_line1,
          address_line2: address.address_line2 || '',
          city_locality: address.city_locality,
          state_province: address.state_province,
          postal_code: address.postal_code,
          country_code: address.country_code || 'US',
          phone: address.phone || '',
        },
      ]),
    })

    if (!shipStationResponse.ok) {
      const errorText = await shipStationResponse.text()
      console.error('ShipStation address validation error:', errorText)
      return NextResponse.json(
        { error: 'Failed to validate address', details: errorText },
        { status: shipStationResponse.status }
      )
    }

    const validationResults = await shipStationResponse.json()

    // Return the first result (we only sent one address)
    return NextResponse.json({
      success: true,
      data: validationResults[0],
    })
  } catch (error: any) {
    console.error('Address validation error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

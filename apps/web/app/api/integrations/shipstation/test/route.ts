import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { ShipStationClient } from '@/lib/shipstation'

// POST /api/integrations/shipstation/test - Test ShipStation connection
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
    const { apiKey, mode } = body

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    // Create a temporary client with the provided API key
    const client = new ShipStationClient({ apiKey })

    // Test the connection
    const isValid = await client.testConnection()

    if (isValid) {
      // Optionally fetch account info or carrier list to provide more details
      try {
        const carriers = await client.listCarriers()
        return NextResponse.json({
          success: true,
          message: 'ShipStation connection successful',
          data: {
            valid: true,
            mode: mode || 'test',
            carrierCount: carriers?.carriers?.length || 0,
          },
        })
      } catch (error) {
        // Even if we can't get carriers, the connection test passed
        return NextResponse.json({
          success: true,
          message: 'ShipStation connection successful',
          data: {
            valid: true,
            mode: mode || 'test',
          },
        })
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API key or connection failed',
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Test ShipStation connection error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to test ShipStation connection',
      },
      { status: 500 }
    )
  }
}

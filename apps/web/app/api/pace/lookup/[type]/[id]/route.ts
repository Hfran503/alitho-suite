import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// Allowed lookup types for security
const ALLOWED_TYPES = ['ShipVia', 'ShipmentType', 'ShipProvider', 'Job', 'SalesPerson', 'JobContact', 'Contact'] as const
type LookupType = typeof ALLOWED_TYPES[number]

// Map of object types to their display name field
const NAME_FIELD_MAP: Record<LookupType, string> = {
  ShipVia: 'description',
  ShipmentType: 'description',
  ShipProvider: 'name',
  Job: 'description',
  SalesPerson: 'name',
  JobContact: 'id', // JobContact doesn't have a name field, we use it to get contact
  Contact: 'companyName',
}

// GET /api/pace/lookup/[type]/[id] - Get lookup description for a PACE object
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
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

    // Await params before accessing properties
    const { type, id } = await params

    // Validate type
    if (!ALLOWED_TYPES.includes(type as LookupType)) {
      return NextResponse.json(
        { error: `Invalid lookup type. Allowed types: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate ID (Job uses string IDs, others use numeric)
    if (!id) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      )
    }

    // Validate numeric IDs for numeric types (Job uses string IDs)
    const numericTypes = ['ShipVia', 'ShipmentType', 'ShipProvider', 'SalesPerson', 'JobContact', 'Contact']
    if (numericTypes.includes(type) && isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Invalid ID - must be numeric' },
        { status: 400 }
      )
    }

    // Get PACE API credentials from AWS Secrets Manager or environment
    let paceApiUrl: string
    let paceUsername: string
    let pacePassword: string

    try {
      const credentials = await getPaceApiCredentials()
      paceApiUrl = credentials.url
      paceUsername = credentials.username
      pacePassword = credentials.password
    } catch (error) {
      console.error('Failed to get PACE API credentials:', error)
      return NextResponse.json(
        {
          error: 'PACE API not configured',
          message: error instanceof Error ? error.message : 'Failed to get PACE API credentials'
        },
        { status: 500 }
      )
    }

    // Prepare Basic Auth header
    const authHeader = `Basic ${Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')}`

    // Call PACE API to get lookup details
    const paceUrl = `${paceApiUrl}/ReadObject/read${type}?primaryKey=${id}`

    const response = await fetch(paceUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
      body: '',
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PACE API lookup error:', {
        status: response.status,
        type,
        id,
        response: errorText,
      })

      // If not found, return a more friendly error
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          data: {
            id: Number(id),
            description: `Unknown ${type}`,
          },
        })
      }

      return NextResponse.json(
        {
          error: `Failed to fetch ${type} from PACE API`,
          details: errorText,
        },
        { status: response.status }
      )
    }

    const lookupData = await response.json()

    // Get the appropriate name field for this type
    const nameField = NAME_FIELD_MAP[type as LookupType]
    const displayName = lookupData[nameField] || `${type} ${id}`

    return NextResponse.json({
      success: true,
      data: {
        id: lookupData.id,
        description: displayName, // Normalized to 'description' for consistent API
        name: displayName, // Also include as 'name' for clarity
        active: lookupData.active,
        ...lookupData, // Include all fields for potential future use
      },
    })
  } catch (error) {
    console.error('Get PACE lookup error:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

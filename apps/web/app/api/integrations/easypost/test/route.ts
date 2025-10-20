import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import EasyPost from '@easypost/api'

// POST /api/integrations/easypost/test - Test EasyPost API key
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
    const { apiKey } = body

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    // Test the API key by trying to retrieve the current user
    try {
      const client = new EasyPost(apiKey)

      // Try to retrieve the current user to verify the API key is valid
      // This is a lightweight call that will fail if the API key is invalid
      const user = await client.User.retrieveMe()

      return NextResponse.json({
        success: true,
        message: 'API key is valid',
        data: {
          valid: true,
          accountName: user.name || 'Unknown',
          accountEmail: user.email || 'Unknown',
        },
      })
    } catch (error: any) {
      console.error('EasyPost API key test failed:', error)

      // Check if it's an authentication error
      if (error.statusCode === 401 || error.message?.includes('Unauthorized')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid API key',
            data: { valid: false },
          },
          { status: 400 }
        )
      }

      // Other errors
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to validate API key',
          message: error.message || 'Unknown error',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Test EasyPost integration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

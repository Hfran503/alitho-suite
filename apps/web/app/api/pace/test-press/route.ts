import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPaceApiCredentials } from '@/lib/secrets'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url: paceApiUrl, username, password } = await getPaceApiCredentials()
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')

    // Read EstimatePress 62476
    const pressResponse = await fetch(
      `${paceApiUrl}/ReadObject/readEstimatePress?primaryKey=62476`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
        },
        body: '',
      }
    )

    if (!pressResponse.ok) {
      return NextResponse.json({ error: 'Failed to read press' }, { status: 500 })
    }

    const press = await pressResponse.json()

    return NextResponse.json({
      pressId: press.id,
      estimateQuantity: press.estimateQuantity,
      press: press.press,
      allFields: press,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/database'
import { requireStaff } from '@/lib/authorization'

// GET - Fetch all holiday gift orders (requires staff access)
export async function GET() {
  try {
    const authResult = await requireStaff()
    if (!authResult.authorized) {
      return authResult.error
    }

    const orders = await db.holidayGiftOrder.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ success: true, orders })
  } catch (error) {
    console.error('Error fetching holiday gift orders:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch holiday gift orders' },
      { status: 500 }
    )
  }
}

// POST - Create a new holiday gift order (public endpoint)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { giftId, giftName, firstName, lastName, email, phone, address, city, state, zipCode, country } = body

    // Validate required fields
    if (!giftId || !giftName || !firstName || !lastName || !email || !phone || !address || !city || !state || !zipCode || !country) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create the order
    const order = await db.holidayGiftOrder.create({
      data: {
        giftId,
        giftName,
        firstName,
        lastName,
        email,
        phone,
        address,
        city,
        state,
        zipCode,
        country,
        status: 'pending'
      }
    })

    return NextResponse.json({ success: true, order })
  } catch (error) {
    console.error('Error creating holiday gift order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    )
  }
}

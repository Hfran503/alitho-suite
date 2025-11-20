import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/database'

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

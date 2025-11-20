import { NextResponse } from 'next/server'
import { db } from '@repo/database'

export async function GET() {
  try {
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

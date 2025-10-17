import { NextRequest, NextResponse } from 'next/server'
import { deleteSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    await deleteSession()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'An error occurred during logout' },
      { status: 500 }
    )
  }
}

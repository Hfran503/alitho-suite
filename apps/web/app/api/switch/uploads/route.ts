import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      include: { tenant: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Fetch uploads
    const uploads = await db.switchPdfUpload.findMany({
      where: {
        tenantId: membership.tenantId,
        ...(status && { status }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    })

    // Get total count
    const total = await db.switchPdfUpload.count({
      where: {
        tenantId: membership.tenantId,
        ...(status && { status }),
      },
    })

    return NextResponse.json({
      success: true,
      data: uploads,
      pagination: {
        total,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('Fetch uploads error:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

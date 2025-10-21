import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/batch-import/list - Get all batch imports for the tenant
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tenant ID from membership
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    // Parse pagination params
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    // Get batches with pagination
    const [batches, total] = await Promise.all([
      db.batchImport.findMany({
        where: { tenantId: membership.tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          fileName: true,
          sheetName: true,
          status: true,
          totalRows: true,
          successfulRows: true,
          failedRows: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.batchImport.count({
        where: { tenantId: membership.tenantId },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        batches,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('Error fetching batch imports:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

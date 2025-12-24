import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getTransactions } from '@/lib/services/inventory'

// Inventory transaction type derived from Prisma schema
type InventoryTransactionType = 'RECEIVE' | 'SHIP' | 'ADJUST' | 'TRANSFER' | 'RESERVE' | 'UNRESERVE' | 'DAMAGE' | 'PICK' | 'KIT_ASSEMBLE' | 'KIT_PRODUCE'

// GET /api/warehouse/inventory/transactions - Get transaction history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')
    const locationId = searchParams.get('locationId')
    const type = searchParams.get('type') as InventoryTransactionType | null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const { transactions, total } = await getTransactions(membership.tenantId, {
      itemId: itemId || undefined,
      locationId: locationId || undefined,
      type: type || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      offset: (page - 1) * limit,
    })

    return NextResponse.json({
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}

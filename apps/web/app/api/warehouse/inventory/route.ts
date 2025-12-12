import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/warehouse/inventory - List inventory stock with filters
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
    const search = searchParams.get('search')
    const warehouseId = searchParams.get('warehouseId')
    const locationId = searchParams.get('locationId')
    const lowStock = searchParams.get('lowStock') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // Build where clause - aggregate stock by item
    const whereStock: any = {
      tenantId: membership.tenantId,
    }

    if (locationId) {
      whereStock.locationId = locationId
    }

    if (warehouseId) {
      whereStock.location = {
        warehouseId,
      }
    }

    // Get stock records grouped by item
    const stockRecords = await db.inventoryStock.findMany({
      where: whereStock,
      include: {
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
            category: true,
            isActive: true,
            trackByReference: true,
          },
        },
        location: {
          select: {
            id: true,
            barcode: true,
            name: true,
            warehouseId: true,
            warehouse: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { item: { sku: 'asc' } },
        { location: { barcode: 'asc' } },
      ],
    })

    // Aggregate by item
    const itemMap = new Map<string, {
      item: typeof stockRecords[0]['item']
      totalAvailable: number
      totalReserved: number
      totalDamaged: number
      totalOnHold: number
      totalQuantity: number
      locationCount: number
      locationIds: Set<string>
      locations: Array<{
        location: typeof stockRecords[0]['location']
        available: number
        reserved: number
        damaged: number
        onHold: number
        lotNumber: string | null
        referenceNumber: string | null
      }>
    }>()

    for (const record of stockRecords) {
      const existing = itemMap.get(record.itemId)
      const locationData = {
        location: record.location,
        available: record.available,
        reserved: record.reserved,
        damaged: record.damaged,
        onHold: record.onHold,
        lotNumber: record.lotNumber,
        referenceNumber: record.referenceNumber,
      }

      if (existing) {
        existing.totalAvailable += record.available
        existing.totalReserved += record.reserved
        existing.totalDamaged += record.damaged
        existing.totalOnHold += record.onHold
        existing.totalQuantity += record.available + record.reserved + record.damaged + record.onHold
        existing.locationIds.add(record.locationId)
        existing.locationCount = existing.locationIds.size
        existing.locations.push(locationData)
      } else {
        const locationIds = new Set<string>([record.locationId])
        itemMap.set(record.itemId, {
          item: record.item,
          totalAvailable: record.available,
          totalReserved: record.reserved,
          totalDamaged: record.damaged,
          totalOnHold: record.onHold,
          totalQuantity: record.available + record.reserved + record.damaged + record.onHold,
          locationCount: 1,
          locationIds,
          locations: [locationData],
        })
      }
    }

    let items = Array.from(itemMap.values())

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase()
      items = items.filter(
        (i) =>
          i.item.sku.toLowerCase().includes(searchLower) ||
          i.item.name.toLowerCase().includes(searchLower)
      )
    }

    // Apply low stock filter (items with 0 available)
    if (lowStock) {
      items = items.filter((i) => i.totalAvailable === 0)
    }

    // Get total and apply pagination
    const total = items.length
    const paginatedItems = items.slice(skip, skip + limit)

    // Get item IDs for fetching transactions
    const itemIds = paginatedItems.map((item) => item.item.id)

    // Fetch last 10 transactions for each item
    const recentTransactions = await db.inventoryTransaction.findMany({
      where: {
        tenantId: membership.tenantId,
        itemId: { in: itemIds },
      },
      orderBy: { createdAt: 'desc' },
      take: itemIds.length * 10, // Get enough to have ~10 per item
      select: {
        id: true,
        itemId: true,
        type: true,
        quantity: true,
        previousQty: true,
        newQty: true,
        referenceType: true,
        referenceNumber: true,
        lotNumber: true,
        notes: true,
        createdAt: true,
        location: {
          select: {
            barcode: true,
            name: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    })

    // Group transactions by item (max 10 each)
    const transactionsByItem = new Map<string, typeof recentTransactions>()
    for (const tx of recentTransactions) {
      const existing = transactionsByItem.get(tx.itemId) || []
      if (existing.length < 10) {
        existing.push(tx)
        transactionsByItem.set(tx.itemId, existing)
      }
    }

    // Clean up response (remove Set objects that can't be serialized) and add transactions
    const cleanedItems = paginatedItems.map(({ locationIds, ...rest }) => ({
      ...rest,
      recentTransactions: transactionsByItem.get(rest.item.id) || [],
    }))

    return NextResponse.json({
      success: true,
      data: cleanedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}

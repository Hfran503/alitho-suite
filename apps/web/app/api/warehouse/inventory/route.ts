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
      locations: Array<{
        location: typeof stockRecords[0]['location']
        available: number
        reserved: number
        damaged: number
        onHold: number
        lotNumber: string | null
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
      }

      if (existing) {
        existing.totalAvailable += record.available
        existing.totalReserved += record.reserved
        existing.totalDamaged += record.damaged
        existing.totalOnHold += record.onHold
        existing.totalQuantity += record.available + record.reserved + record.damaged + record.onHold
        existing.locationCount += 1
        existing.locations.push(locationData)
      } else {
        itemMap.set(record.itemId, {
          item: record.item,
          totalAvailable: record.available,
          totalReserved: record.reserved,
          totalDamaged: record.damaged,
          totalOnHold: record.onHold,
          totalQuantity: record.available + record.reserved + record.damaged + record.onHold,
          locationCount: 1,
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

    return NextResponse.json({
      success: true,
      data: paginatedItems,
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

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { isCustomerRole } from '@/lib/roles'

// GET /api/portal/items - List inventory items available for the portal customer
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify customer role
    if (!isCustomerRole((session.user as any).role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get user's paceCustomerId and tenant
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        paceCustomerId: true,
        memberships: {
          select: { tenantId: true },
          take: 1,
        },
      },
    })

    if (!user?.paceCustomerId) {
      return NextResponse.json(
        { error: 'No PACE Customer ID associated with your account' },
        { status: 400 }
      )
    }

    const tenantId = user.memberships[0]?.tenantId
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Find the customer by paceCustomerId
    const customer = await db.warehouseCustomer.findFirst({
      where: { tenantId, paceCustomerId: user.paceCustomerId, isActive: true },
      select: { id: true },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '200')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause - get items belonging to this customer
    const where: any = {
      tenantId,
      customerId: customer.id,
      isActive: true,
      // Exclude KIT_COMPONENT - they can only be ordered as part of a kit
      itemType: { in: ['STANDARD', 'KIT_AND_COMPONENT', 'KIT'] },
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { itemCode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (category) {
      where.category = category
    }

    // Get items with stock information
    const items = await db.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        itemCode: true,
        sku: true,
        name: true,
        description: true,
        category: true,
        sellPrice: true,
        bulkSellPrice: true,
        trackByReference: true,
        canOrderInBulk: true,
        bulkUnitName: true,
        unitsPerBulk: true,
        stockLevels: {
          select: {
            available: true,
            reserved: true,
            referenceNumber: true,
            lotNumber: true,
          },
        },
      },
    })

    // Process items to calculate available quantities
    const processedItems = items.map((item: (typeof items)[number]) => {
      const totalAvailable = item.stockLevels.reduce((sum: number, s: (typeof item.stockLevels)[number]) => sum + s.available, 0)

      // For trackByReference items, group stock by reference number
      let stockByReference: { referenceNumber: string | null; available: number }[] | undefined
      if (item.trackByReference) {
        const refMap = new Map<string | null, number>()
        for (const s of item.stockLevels) {
          const key = s.referenceNumber
          refMap.set(key, (refMap.get(key) || 0) + s.available)
        }
        stockByReference = Array.from(refMap.entries())
          .map(([referenceNumber, available]) => ({ referenceNumber, available }))
          .filter((s) => s.available > 0)
      }

      return {
        id: item.id,
        itemCode: item.itemCode,
        sku: item.sku,
        name: item.name,
        description: item.description,
        category: item.category,
        sellPrice: item.sellPrice,
        bulkSellPrice: item.bulkSellPrice,
        trackByReference: item.trackByReference,
        canOrderInBulk: item.canOrderInBulk,
        bulkUnitName: item.bulkUnitName,
        unitsPerBulk: item.unitsPerBulk,
        available: totalAvailable,
        stockByReference,
      }
    })

    // Get unique categories for filter
    const allCategories = await db.inventoryItem.findMany({
      where: {
        tenantId,
        customerId: customer.id,
        isActive: true,
        category: { not: null },
      },
      distinct: ['category'],
      select: { category: true },
    })

    const categories = allCategories
      .map((c: (typeof allCategories)[number]) => c.category)
      .filter((c): c is string => c !== null)
      .sort()

    return NextResponse.json({
      success: true,
      data: processedItems,
      filters: { categories },
      pagination: {
        limit,
        offset,
        total: processedItems.length,
      },
    })
  } catch (error) {
    console.error('Error fetching portal items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    )
  }
}

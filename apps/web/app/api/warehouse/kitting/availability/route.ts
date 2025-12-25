import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/warehouse/kitting/availability?kitId=xxx
// Returns how many kits can be assembled based on component availability
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
    const kitId = searchParams.get('kitId')

    if (!kitId) {
      return NextResponse.json({ error: 'kitId is required' }, { status: 400 })
    }

    // Get the kit with its components
    const kit = await db.inventoryItem.findFirst({
      where: {
        id: kitId,
        tenantId: membership.tenantId,
        itemType: { in: ['KIT', 'KIT_AND_COMPONENT'] },
      },
      include: {
        kitComponents: {
          include: {
            component: {
              select: { id: true, itemCode: true, sku: true, name: true, isActive: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!kit) {
      return NextResponse.json({ error: 'Kit not found or not a kit type' }, { status: 404 })
    }

    if (kit.kitComponents.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          kit: {
            id: kit.id,
            itemCode: kit.itemCode,
            sku: kit.sku,
            name: kit.name,
          },
          maxAssemblable: 0,
          components: [],
          hasComponents: false,
        },
      })
    }

    // Get available stock for all components
    const componentIds = kit.kitComponents.map((kc: (typeof kit.kitComponents)[number]) => kc.componentId)
    const componentStock = await db.inventoryStock.groupBy({
      by: ['itemId'],
      where: {
        tenantId: membership.tenantId,
        itemId: { in: componentIds },
      },
      _sum: {
        available: true,
      },
    })

    const stockMap = new Map(componentStock.map((s: (typeof componentStock)[number]) => [s.itemId, s._sum.available || 0]))

    // Calculate availability for each component
    const components = kit.kitComponents.map((kc: (typeof kit.kitComponents)[number]) => {
      const available = stockMap.get(kc.componentId) || 0
      const quantity = Number(kc.quantity)
      const canMake = quantity > 0 ? Math.floor(Number(available) / quantity) : 0

      return {
        id: kc.id,
        componentId: kc.componentId,
        component: kc.component,
        quantityPerKit: quantity,
        available,
        canMake,
        isLimiting: false, // Will be set below
      }
    })

    // Find the limiting component (lowest canMake)
    const maxAssemblable = Math.min(...components.map((c: (typeof components)[number]) => c.canMake))

    // Mark limiting components
    components.forEach((c: (typeof components)[number]) => {
      c.isLimiting = c.canMake === maxAssemblable && maxAssemblable < Infinity
    })

    return NextResponse.json({
      success: true,
      data: {
        kit: {
          id: kit.id,
          itemCode: kit.itemCode,
          sku: kit.sku,
          name: kit.name,
        },
        maxAssemblable,
        components,
        hasComponents: true,
      },
    })
  } catch (error) {
    console.error('Error checking kit availability:', error)
    return NextResponse.json(
      { error: 'Failed to check availability' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/warehouse/items/export - Export items to CSV
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

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const activeOnly = searchParams.get('activeOnly') !== 'false'
    const customerId = searchParams.get('customerId')

    // Build where clause
    const where: Record<string, unknown> = {
      tenantId: membership.tenantId,
      ...(activeOnly && { isActive: true }),
      ...(customerId && { customerId }),
    }

    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { upc: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Get all items matching filters
    const items = await db.inventoryItem.findMany({
      where,
      include: {
        customer: {
          select: { name: true, paceCustomerId: true },
        },
      },
      orderBy: { sku: 'asc' },
    })

    // Build CSV
    const headers = [
      'SKU',
      'UPC',
      'Name',
      'Description',
      'Category',
      'Weight',
      'Length',
      'Width',
      'Height',
      'Dimension Unit',
      'Customer',
      'Customer PACE ID',
      'Active',
      'Track By Reference',
    ]

    const escapeCSV = (value: string | null | undefined): string => {
      if (value === null || value === undefined) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = items.map((item: (typeof items)[number]) => {
      const dimensions = item.dimensions as { length?: number; width?: number; height?: number; unit?: string } | null
      return [
        escapeCSV(item.sku),
        escapeCSV(item.upc),
        escapeCSV(item.name),
        escapeCSV(item.description),
        escapeCSV(item.category),
        item.weight?.toString() || '',
        dimensions?.length?.toString() || '',
        dimensions?.width?.toString() || '',
        dimensions?.height?.toString() || '',
        dimensions?.unit || 'in',
        escapeCSV(item.customer?.name),
        escapeCSV(item.customer?.paceCustomerId),
        item.isActive ? 'Yes' : 'No',
        item.trackByReference ? 'Yes' : 'No',
      ].join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')

    // Return as downloadable CSV
    const filename = `inventory-items-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting items:', error)
    return NextResponse.json(
      { error: 'Failed to export items' },
      { status: 500 }
    )
  }
}

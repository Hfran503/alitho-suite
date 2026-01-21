import { NextResponse } from 'next/server'
import { db } from '@repo/database'

export async function GET() {
  try {
    // For now, use the first tenant (can be customized based on subdomain, etc.)
    const defaultTenant = await db.tenant.findFirst()

    if (!defaultTenant) {
      return NextResponse.json({ data: [] })
    }

    const productTypes = await db.productType.findMany({
      where: {
        tenantId: defaultTenant.id,
        isActive: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
        attributes: true,
        imageUrl: true,
      },
    })

    return NextResponse.json({ data: productTypes })
  } catch (error) {
    console.error('Error fetching product types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product types' },
      { status: 500 }
    )
  }
}

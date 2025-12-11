import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/warehouse/asn/generate-number - Generate next ASN number
export async function GET() {
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

    // Generate ASN number
    const year = new Date().getFullYear()
    const lastASN = await db.aSN.findFirst({
      where: {
        tenantId: membership.tenantId,
        asnNumber: { startsWith: `ASN-${year}-` },
      },
      orderBy: { asnNumber: 'desc' },
    })

    let nextNumber = 1
    if (lastASN) {
      const parts = lastASN.asnNumber.split('-')
      const lastNum = parseInt(parts[2] || '0')
      nextNumber = lastNum + 1
    }

    const asnNumber = `ASN-${year}-${nextNumber.toString().padStart(4, '0')}`

    return NextResponse.json({
      success: true,
      data: { asnNumber },
    })
  } catch (error) {
    console.error('Error generating ASN number:', error)
    return NextResponse.json(
      { error: 'Failed to generate ASN number' },
      { status: 500 }
    )
  }
}

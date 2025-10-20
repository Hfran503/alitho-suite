import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// DELETE /api/settings/shipment-types/[id] - Delete a mapping
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    await db.shipmentTypeMapping.delete({
      where: {
        id,
        tenantId: membership.tenantId, // Ensure tenant owns this mapping
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete shipment type mapping error:', error)
    return NextResponse.json(
      { error: 'Failed to delete mapping', message: error.message },
      { status: 500 }
    )
  }
}

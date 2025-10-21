import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

/**
 * DELETE /api/settings/carrier-services/[id]
 * Delete a carrier service mapping
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!membership?.tenantId) {
      return NextResponse.json({ error: 'User has no tenant' }, { status: 400 })
    }

    // Verify mapping belongs to tenant before deleting
    const mapping = await db.carrierServiceMapping.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!mapping) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 })
    }

    // Delete mapping
    await db.carrierServiceMapping.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API] Carrier service mapping DELETE error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete carrier service mapping' },
      { status: 500 }
    )
  }
}

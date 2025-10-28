import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// PUT /api/equipment/[id] - Update equipment
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const { id } = await params

    // Check if equipment exists and belongs to tenant
    const existingEquipment = await db.equipment.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!existingEquipment) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, description, isActive, metadata } = body

    // Update equipment
    const equipment = await db.equipment.update({
      where: {
        id,
      },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(metadata !== undefined && { metadata }),
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: equipment,
    })
  } catch (error) {
    console.error('Update equipment error:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/equipment/[id] - Delete equipment
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const { id } = await params

    // Check if equipment exists and belongs to tenant
    const existingEquipment = await db.equipment.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!existingEquipment) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    // Check if equipment has scheduled jobs
    const scheduledCount = await db.jobSchedule.count({
      where: {
        equipmentId: id,
      },
    })

    if (scheduledCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete equipment with ${scheduledCount} scheduled job(s)` },
        { status: 400 }
      )
    }

    // Delete equipment
    await db.equipment.delete({
      where: {
        id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Equipment deleted successfully',
    })
  } catch (error) {
    console.error('Delete equipment error:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// PUT /api/schedules/[id] - Update a scheduled job
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

    // Check if schedule exists and belongs to tenant
    const existingSchedule = await db.jobSchedule.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!existingSchedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      scheduledDate,
      position,
      status,
      priority,
      notes,
      estimatedHours,
      actualHours,
      assignedToId,
      completedAt,
    } = body

    // Update schedule
    const schedule = await db.jobSchedule.update({
      where: {
        id,
      },
      data: {
        ...(scheduledDate !== undefined && { scheduledDate: new Date(scheduledDate) }),
        ...(position !== undefined && { position }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(notes !== undefined && { notes }),
        ...(estimatedHours !== undefined && { estimatedHours }),
        ...(actualHours !== undefined && { actualHours }),
        ...(assignedToId !== undefined && { assignedToId }),
        ...(completedAt !== undefined && { completedAt: completedAt ? new Date(completedAt) : null }),
        updatedAt: new Date(),
      },
      include: {
        Department: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: schedule,
    })
  } catch (error) {
    console.error('Update schedule error:', error)

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

// DELETE /api/schedules/[id] - Remove a scheduled job
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

    // Check if schedule exists and belongs to tenant
    const existingSchedule = await db.jobSchedule.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!existingSchedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Delete schedule
    await db.jobSchedule.delete({
      where: {
        id,
      },
    })

    // Reorder remaining schedules for this date
    const remainingSchedules = await db.jobSchedule.findMany({
      where: {
        departmentId: existingSchedule.departmentId,
        scheduledDate: existingSchedule.scheduledDate,
        tenantId: membership.tenantId,
      },
      orderBy: {
        position: 'asc',
      },
    })

    // Update positions sequentially
    for (let i = 0; i < remainingSchedules.length; i++) {
      await db.jobSchedule.update({
        where: { id: remainingSchedules[i].id },
        data: { position: i + 1, updatedAt: new Date() },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule deleted successfully',
    })
  } catch (error) {
    console.error('Delete schedule error:', error)

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

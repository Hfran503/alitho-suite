import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { randomBytes } from 'crypto'

function generateId() {
  return randomBytes(12).toString('base64url')
}

// GET /api/schedules - List scheduled jobs with filters
export async function GET(request: Request) {
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

    // Parse query params
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')
    const assignedToId = searchParams.get('assignedToId')

    // Build where clause
    const where: any = {
      tenantId: membership.tenantId,
    }

    if (departmentId) {
      where.departmentId = departmentId
    }

    if (startDate || endDate) {
      where.scheduledDate = {}
      if (startDate) {
        where.scheduledDate.gte = new Date(startDate)
      }
      if (endDate) {
        where.scheduledDate.lte = new Date(endDate)
      }
    }

    if (status) {
      where.status = status
    }

    if (assignedToId) {
      where.assignedToId = assignedToId
    }

    // Fetch scheduled jobs
    const schedules = await db.jobSchedule.findMany({
      where,
      include: {
        Department: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        Equipment: {
          select: {
            id: true,
            name: true,
            description: true,
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
      orderBy: [
        { scheduledDate: 'asc' },
        { position: 'asc' },
      ],
    })

    return NextResponse.json({
      success: true,
      data: schedules,
    })
  } catch (error) {
    console.error('Get schedules error:', error)

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

// POST /api/schedules - Create a new scheduled job
export async function POST(request: Request) {
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

    const body = await request.json()
    const {
      paceJobNumber,
      paceJobData,
      departmentId,
      equipmentId,
      scheduledDate,
      assignedToId,
      priority,
      notes,
      estimatedHours,
    } = body

    if (!paceJobNumber || !departmentId || !scheduledDate) {
      return NextResponse.json(
        { error: 'paceJobNumber, departmentId, and scheduledDate are required' },
        { status: 400 }
      )
    }

    // Verify department belongs to tenant
    const department = await db.department.findFirst({
      where: {
        id: departmentId,
        tenantId: membership.tenantId,
      },
    })

    if (!department) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      )
    }

    // Note: Allowing same job to be scheduled multiple times on different dates/machines
    // Removed duplicate check to support multi-scheduling

    // Verify equipment if provided
    if (equipmentId) {
      const equipment = await db.equipment.findFirst({
        where: {
          id: equipmentId,
          departmentId, // Equipment must belong to the same department
          tenantId: membership.tenantId,
        },
      })

      if (!equipment) {
        return NextResponse.json(
          { error: 'Equipment not found or does not belong to this department' },
          { status: 404 }
        )
      }
    }

    // Get max position for this date/equipment combination
    const maxPositionSchedule = await db.jobSchedule.findFirst({
      where: {
        departmentId,
        equipmentId: equipmentId || null,
        scheduledDate: new Date(scheduledDate),
        tenantId: membership.tenantId,
      },
      orderBy: {
        position: 'desc',
      },
      select: {
        position: true,
      },
    })

    const position = (maxPositionSchedule?.position || 0) + 1

    // Create schedule
    const schedule = await db.jobSchedule.create({
      data: {
        id: generateId(),
        paceJobNumber,
        paceJobData: paceJobData || {},
        departmentId,
        equipmentId: equipmentId || null,
        scheduledDate: new Date(scheduledDate),
        position,
        status: 'scheduled',
        priority: priority || 'medium',
        notes,
        estimatedHours,
        assignedToId,
        tenantId: membership.tenantId,
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
        Equipment: {
          select: {
            id: true,
            name: true,
            description: true,
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
    console.error('Create schedule error:', error)

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

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/departments/[id] - Get a single department
export async function GET(
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

    const department = await db.department.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
      include: {
        jobTypes: {
          orderBy: {
            jobTypeName: 'asc',
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!department) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: department,
    })
  } catch (error) {
    console.error('Get department error:', error)

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

// PUT /api/departments/[id] - Update a department
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

    // Check if department exists and belongs to tenant
    const existingDepartment = await db.department.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!existingDepartment) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, description, color, jobTypes } = body

    // Update department basic fields
    await db.department.update({
      where: {
        id,
      },
      data: {
        name,
        description,
        color,
      },
    })

    // Update job types if provided
    if (jobTypes !== undefined) {
      // Delete all existing job types
      await db.departmentJobType.deleteMany({
        where: {
          departmentId: id,
        },
      })

      // Create new job types
      if (jobTypes.length > 0) {
        await db.departmentJobType.createMany({
          data: jobTypes.map((jt: { paceJobTypeId: number; jobTypeName: string }) => ({
            departmentId: id,
            paceJobTypeId: jt.paceJobTypeId,
            jobTypeName: jt.jobTypeName,
          })),
        })
      }
    }

    // Fetch updated department with all relations
    const updatedDepartment = await db.department.findUnique({
      where: {
        id,
      },
      include: {
        jobTypes: {
          orderBy: {
            jobTypeName: 'asc',
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedDepartment,
    })
  } catch (error) {
    console.error('Update department error:', error)

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

// DELETE /api/departments/[id] - Delete a department
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

    // Check if department exists and belongs to tenant
    const existingDepartment = await db.department.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!existingDepartment) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      )
    }

    // Delete department (cascade will delete related jobTypes and members)
    await db.department.delete({
      where: {
        id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Department deleted successfully',
    })
  } catch (error) {
    console.error('Delete department error:', error)

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

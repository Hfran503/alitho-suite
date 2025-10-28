import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/departments - List all departments
export async function GET() {
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

    // Fetch all departments for this tenant
    const departments = await db.department.findMany({
      where: {
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
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      data: departments,
    })
  } catch (error) {
    console.error('Get departments error:', error)

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

// POST /api/departments - Create a new department
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
    const { name, description, color, jobTypes } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Department name is required' },
        { status: 400 }
      )
    }

    // Create department with job types
    const department = await db.department.create({
      data: {
        name,
        description,
        color,
        tenantId: membership.tenantId,
        jobTypes: jobTypes
          ? {
              create: jobTypes.map((jt: { paceJobTypeId: number; jobTypeName: string }) => ({
                paceJobTypeId: jt.paceJobTypeId,
                jobTypeName: jt.jobTypeName,
              })),
            }
          : undefined,
      },
      include: {
        jobTypes: true,
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
      data: department,
    })
  } catch (error) {
    console.error('Create department error:', error)

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

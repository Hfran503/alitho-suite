import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/equipment - List all equipment (optionally filtered by department)
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

    const where: any = {
      tenantId: membership.tenantId,
    }

    if (departmentId) {
      where.departmentId = departmentId
    }

    // Fetch equipment
    const equipment = await db.equipment.findMany({
      where,
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      data: equipment,
    })
  } catch (error) {
    console.error('Get equipment error:', error)

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

// POST /api/equipment - Create new equipment
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
    const { name, description, departmentId, metadata } = body

    if (!name || !departmentId) {
      return NextResponse.json(
        { error: 'Name and departmentId are required' },
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

    // Create equipment
    const equipment = await db.equipment.create({
      data: {
        name,
        description,
        departmentId,
        metadata,
        tenantId: membership.tenantId,
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
    console.error('Create equipment error:', error)

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

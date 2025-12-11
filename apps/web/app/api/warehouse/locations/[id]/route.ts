import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const updateLocationSchema = z.object({
  zone: z.string().optional(),
  aisle: z.string().optional(),
  rack: z.string().optional(),
  shelf: z.string().optional(),
  bin: z.string().optional(),
  barcode: z.string().min(1).optional(),
  name: z.string().optional().nullable(),
  locationType: z.enum(['RECEIVING', 'STORAGE', 'SHIPPING', 'STAGING', 'QUARANTINE']).optional(),
  maxCapacity: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
})

// GET /api/warehouse/locations/[id] - Get a single location
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const location = await db.warehouseLocation.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: location,
    })
  } catch (error) {
    console.error('Error fetching location:', error)
    return NextResponse.json(
      { error: 'Failed to fetch location' },
      { status: 500 }
    )
  }
}

// PATCH /api/warehouse/locations/[id] - Update a location
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Check if location exists and belongs to this tenant
    const existingLocation = await db.warehouseLocation.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!existingLocation) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = updateLocationSchema.parse(body)

    // If barcode is being changed, check uniqueness
    if (validatedData.barcode && validatedData.barcode !== existingLocation.barcode) {
      const barcodeExists = await db.warehouseLocation.findUnique({
        where: {
          tenantId_barcode: {
            tenantId: membership.tenantId,
            barcode: validatedData.barcode,
          },
        },
      })

      if (barcodeExists) {
        return NextResponse.json(
          { error: 'A location with this barcode already exists' },
          { status: 400 }
        )
      }
    }

    // Update the location
    const location = await db.warehouseLocation.update({
      where: { id },
      data: validatedData,
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: location,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating location:', error)
    return NextResponse.json(
      { error: 'Failed to update location' },
      { status: 500 }
    )
  }
}

// DELETE /api/warehouse/locations/[id] - Delete a location
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Check if location exists and belongs to this tenant
    const existingLocation = await db.warehouseLocation.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!existingLocation) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    // TODO: Check if location has inventory before deleting
    // For now, we'll soft-delete by setting isActive to false instead of hard delete
    // This preserves data integrity for any related records

    await db.warehouseLocation.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      message: 'Location deactivated successfully',
    })
  } catch (error) {
    console.error('Error deleting location:', error)
    return NextResponse.json(
      { error: 'Failed to delete location' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const bulkCreateSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  locationType: z.enum(['RECEIVING', 'STORAGE', 'SHIPPING', 'STAGING', 'QUARANTINE']).default('STORAGE'),
  // Pattern-based generation
  zoneStart: z.string().optional(),
  zoneEnd: z.string().optional(),
  aisleStart: z.string().optional(),
  aisleEnd: z.string().optional(),
  rackStart: z.string().optional(),
  rackEnd: z.string().optional(),
  shelfStart: z.string().optional(),
  shelfEnd: z.string().optional(),
  binStart: z.string().optional(),
  binEnd: z.string().optional(),
  // Barcode format (e.g., "{zone}-{aisle}-{rack}-{shelf}-{bin}")
  barcodeFormat: z.string().default('{zone}-{aisle}-{rack}-{shelf}-{bin}'),
})

// Helper to generate range (works for letters and numbers)
function generateRange(start: string, end: string): string[] {
  if (!start || !end) return ['']

  const startNum = parseInt(start)
  const endNum = parseInt(end)

  // If both are numbers
  if (!isNaN(startNum) && !isNaN(endNum)) {
    const results: string[] = []
    const padLength = start.length
    for (let i = startNum; i <= endNum; i++) {
      results.push(i.toString().padStart(padLength, '0'))
    }
    return results
  }

  // If both are single letters
  if (start.length === 1 && end.length === 1) {
    const startCode = start.toUpperCase().charCodeAt(0)
    const endCode = end.toUpperCase().charCodeAt(0)
    const results: string[] = []
    for (let i = startCode; i <= endCode; i++) {
      results.push(String.fromCharCode(i))
    }
    return results
  }

  // Single value
  return [start]
}

// POST /api/warehouse/locations/bulk - Bulk create locations
export async function POST(request: NextRequest) {
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
    const validatedData = bulkCreateSchema.parse(body)

    // Verify the warehouse belongs to this tenant
    const warehouse = await db.warehouse.findFirst({
      where: {
        id: validatedData.warehouseId,
        tenantId: membership.tenantId,
      },
    })

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      )
    }

    // Generate all combinations
    const zones = generateRange(validatedData.zoneStart || '', validatedData.zoneEnd || '')
    const aisles = generateRange(validatedData.aisleStart || '', validatedData.aisleEnd || '')
    const racks = generateRange(validatedData.rackStart || '', validatedData.rackEnd || '')
    const shelves = generateRange(validatedData.shelfStart || '', validatedData.shelfEnd || '')
    const bins = generateRange(validatedData.binStart || '', validatedData.binEnd || '')

    const locationsToCreate: Array<{
      tenantId: string
      warehouseId: string
      zone: string | null
      aisle: string | null
      rack: string | null
      shelf: string | null
      bin: string | null
      barcode: string
      locationType: 'RECEIVING' | 'STORAGE' | 'SHIPPING' | 'STAGING' | 'QUARANTINE'
    }> = []

    const existingBarcodes = new Set<string>()

    // Get all existing barcodes for this tenant
    const existingLocations = await db.warehouseLocation.findMany({
      where: { tenantId: membership.tenantId },
      select: { barcode: true },
    })
    existingLocations.forEach((loc: (typeof existingLocations)[number]) => existingBarcodes.add(loc.barcode))

    // Generate locations
    for (const zone of zones) {
      for (const aisle of aisles) {
        for (const rack of racks) {
          for (const shelf of shelves) {
            for (const bin of bins) {
              // Generate barcode from format
              let barcode = validatedData.barcodeFormat
                .replace('{zone}', zone)
                .replace('{aisle}', aisle)
                .replace('{rack}', rack)
                .replace('{shelf}', shelf)
                .replace('{bin}', bin)

              // Remove empty segments and clean up multiple dashes
              barcode = barcode.replace(/--+/g, '-').replace(/^-|-$/g, '')

              // Skip if barcode already exists
              if (existingBarcodes.has(barcode)) {
                continue
              }

              existingBarcodes.add(barcode)

              locationsToCreate.push({
                tenantId: membership.tenantId,
                warehouseId: validatedData.warehouseId,
                zone: zone || null,
                aisle: aisle || null,
                rack: rack || null,
                shelf: shelf || null,
                bin: bin || null,
                barcode,
                locationType: validatedData.locationType,
              })
            }
          }
        }
      }
    }

    if (locationsToCreate.length === 0) {
      return NextResponse.json(
        { error: 'No new locations to create. All barcodes may already exist.' },
        { status: 400 }
      )
    }

    // Limit bulk creation to prevent timeout
    if (locationsToCreate.length > 1000) {
      return NextResponse.json(
        { error: `Too many locations to create at once (${locationsToCreate.length}). Maximum is 1000.` },
        { status: 400 }
      )
    }

    // Create all locations in a transaction
    const result = await db.warehouseLocation.createMany({
      data: locationsToCreate,
    })

    return NextResponse.json({
      success: true,
      data: {
        created: result.count,
        skipped: (zones.length * aisles.length * racks.length * shelves.length * bins.length) - result.count,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error bulk creating locations:', error)
    return NextResponse.json(
      { error: 'Failed to create locations' },
      { status: 500 }
    )
  }
}

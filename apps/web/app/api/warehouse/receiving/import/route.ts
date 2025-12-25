import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { startReceiving, recordItem, completeReceiving } from '@/lib/services/receiving'

// GET /api/warehouse/receiving/import - Download CSV template
export async function GET() {
  const headers = [
    'SKU',
    'Description',
    'Expected Qty',
    'Received Qty',
    'Damaged Qty',
    'Lot Number',
    'Reference Number (PO#)',
    'Location Barcode',
    'Expiration Date',
    'Notes',
  ]

  // Sample data rows
  const sampleRows = [
    ['SKU001', 'Sample Item 1', '100', '100', '0', 'LOT-2024-001', 'PO-12345', 'A-01-01', '2025-12-31', 'Good condition'],
    ['SKU002', 'Sample Item 2', '50', '48', '2', '', 'PO-12345', 'A-01-02', '', 'Minor damage on 2 units'],
  ]

  const csv = [headers.join(','), ...sampleRows.map(row => row.join(','))].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="receiving-import-template.csv"',
    },
  })
}

// POST /api/warehouse/receiving/import - Import receiving from CSV
export async function POST(request: NextRequest) {
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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const autoComplete = formData.get('autoComplete') === 'true'
    const defaultLocationBarcode = formData.get('defaultLocation') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split('\n').map(line => line.trim()).filter(line => line)

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file must have a header row and at least one data row' }, { status: 400 })
    }

    // Parse header
    const headerLine = lines[0]
    const headers = parseCSVLine(headerLine)
    const headerMap: Record<string, number> = {}

    headers.forEach((header, index) => {
      const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (normalized === 'sku') headerMap['sku'] = index
      else if (normalized === 'description' || normalized === 'desc') headerMap['description'] = index
      else if (normalized.includes('expected') && normalized.includes('qty')) headerMap['expectedQty'] = index
      else if (normalized.includes('received') && normalized.includes('qty')) headerMap['receivedQty'] = index
      else if (normalized.includes('damaged') && normalized.includes('qty')) headerMap['damagedQty'] = index
      else if (normalized.includes('lot')) headerMap['lotNumber'] = index
      else if (normalized.includes('ref') || normalized.includes('po')) headerMap['referenceNumber'] = index
      else if (normalized.includes('location') || normalized === 'barcode') headerMap['locationBarcode'] = index
      else if (normalized.includes('expir') || normalized.includes('expdate')) headerMap['expirationDate'] = index
      else if (normalized === 'notes' || normalized === 'note') headerMap['notes'] = index
    })

    if (headerMap['sku'] === undefined) {
      return NextResponse.json({ error: 'CSV must have a SKU column' }, { status: 400 })
    }
    if (headerMap['receivedQty'] === undefined) {
      return NextResponse.json({ error: 'CSV must have a Received Qty column' }, { status: 400 })
    }

    // Get default location and warehouse if provided
    let defaultLocationId: string | null = null
    let warehouseId: string | null = null

    if (defaultLocationBarcode) {
      const defaultLocation = await db.warehouseLocation.findFirst({
        where: {
          tenantId: membership.tenantId,
          barcode: defaultLocationBarcode,
        },
      })
      if (defaultLocation) {
        defaultLocationId = defaultLocation.id
        warehouseId = defaultLocation.warehouseId
      }
    }

    // If no warehouse from location, get the first warehouse
    if (!warehouseId) {
      const firstWarehouse = await db.warehouse.findFirst({
        where: { tenantId: membership.tenantId },
      })
      if (!firstWarehouse) {
        return NextResponse.json({ error: 'No warehouse found. Please create a warehouse first.' }, { status: 400 })
      }
      warehouseId = firstWarehouse.id
    }

    // Parse rows
    const results: Array<{
      row: number
      sku: string
      status: 'success' | 'error'
      message?: string
    }> = []

    // Create a receiving record for all items
    const receivingRecord = await startReceiving({
      tenantId: membership.tenantId,
      warehouseId: warehouseId!,
      userId: session.user.id,
      notes: `Imported from CSV on ${new Date().toLocaleDateString()}`,
    })

    if (!receivingRecord) {
      return NextResponse.json({ error: 'Failed to create receiving record' }, { status: 500 })
    }

    let successCount = 0
    let errorCount = 0

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line.trim()) continue

      const values = parseCSVLine(line)
      const rowNum = i + 1

      const getValue = (key: string): string => {
        const idx = headerMap[key]
        return idx !== undefined ? (values[idx] || '').trim() : ''
      }

      const sku = getValue('sku')
      if (!sku) {
        results.push({ row: rowNum, sku: '', status: 'error', message: 'SKU is required' })
        errorCount++
        continue
      }

      const receivedQtyStr = getValue('receivedQty')
      const receivedQty = parseNumber(receivedQtyStr)
      if (isNaN(receivedQty) || receivedQty < 0) {
        results.push({ row: rowNum, sku, status: 'error', message: 'Invalid received quantity' })
        errorCount++
        continue
      }

      // Get description - either from CSV or from existing item
      let description = getValue('description')
      if (!description) {
        // Try to get from existing item
        const existingItem = await db.inventoryItem.findFirst({
          where: { tenantId: membership.tenantId, sku },
          select: { name: true },
        })
        description = existingItem?.name || sku
      }

      const expectedQty = parseNumber(getValue('expectedQty')) || 0
      const damagedQty = parseNumber(getValue('damagedQty')) || 0
      const lotNumber = getValue('lotNumber') || undefined
      const referenceNumber = getValue('referenceNumber') || undefined
      const expirationDateStr = getValue('expirationDate')
      const expirationDate = expirationDateStr ? new Date(expirationDateStr) : undefined
      const notes = getValue('notes') || undefined

      // Get location
      let locationId: string | undefined = defaultLocationId || undefined
      const locationBarcode = getValue('locationBarcode')
      if (locationBarcode) {
        const location = await db.warehouseLocation.findFirst({
          where: {
            tenantId: membership.tenantId,
            barcode: locationBarcode,
          },
        })
        if (location) {
          locationId = location.id
        } else {
          results.push({ row: rowNum, sku, status: 'error', message: `Location "${locationBarcode}" not found` })
          errorCount++
          continue
        }
      }

      if (!locationId) {
        results.push({ row: rowNum, sku, status: 'error', message: 'No location specified and no default location provided' })
        errorCount++
        continue
      }

      try {
        await recordItem({
          receivingRecordId: receivingRecord.id,
          sku,
          description,
          expectedQty,
          receivedQty,
          damagedQty,
          putAwayLocationId: locationId,
          lotNumber,
          expirationDate,
          referenceNumber,
          notes,
        })

        results.push({ row: rowNum, sku, status: 'success' })
        successCount++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add item'
        results.push({ row: rowNum, sku, status: 'error', message })
        errorCount++
      }
    }

    // Auto-complete if requested and there were successful items
    let completed = false
    if (autoComplete && successCount > 0) {
      try {
        await completeReceiving({
          receivingRecordId: receivingRecord.id,
          tenantId: membership.tenantId,
          userId: session.user.id,
        })
        completed = true
      } catch (error) {
        // Don't fail the whole import if completion fails
        console.error('Failed to auto-complete receiving:', error)
      }
    }

    return NextResponse.json({
      success: true,
      receivingRecordId: receivingRecord.id,
      completed,
      summary: {
        total: results.length,
        success: successCount,
        errors: errorCount,
      },
      results,
    })
  } catch (error) {
    console.error('Error importing receiving:', error)
    return NextResponse.json(
      { error: 'Failed to import receiving' },
      { status: 500 }
    )
  }
}

// Helper function to parse CSV line (handles quoted values)
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

// Helper function to parse numbers with thousand separators (e.g., "3,150" -> 3150)
function parseNumber(value: string): number {
  if (!value) return NaN
  // Remove commas and other thousand separators, then parse
  const cleaned = value.replace(/,/g, '').trim()
  return parseInt(cleaned, 10)
}

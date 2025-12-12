import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, InventoryTransactionType } from '@repo/database'

// GET /api/warehouse/inventory/import - Download CSV template
export async function GET() {
  const headers = [
    'SKU',
    'Location Barcode',
    'Quantity',
    'Type',
    'Lot Number',
    'Reference Number (PO#)',
    'Notes',
  ]

  // Sample data rows with explanations
  const sampleRows = [
    ['SKU001', 'A-01-01', '100', 'SET', '', 'PO-12345', 'Initial stock setup'],
    ['SKU002', 'A-01-02', '50', 'ADD', 'LOT-2024-001', 'PO-12346', 'Adding inventory'],
    ['SKU003', 'A-01-03', '10', 'REMOVE', '', '', 'Cycle count adjustment'],
  ]

  const instructions = [
    '# Inventory Import Template',
    '# ',
    '# Type options:',
    '#   SET - Set the stock to this exact quantity (overwrites current)',
    '#   ADD - Add this quantity to current stock',
    '#   REMOVE - Subtract this quantity from current stock',
    '# ',
    '# SKU must exist in the system',
    '# Location Barcode must exist in the system',
    '# Reference Number (PO#) is required for items with "Track by Reference" enabled',
    '#',
  ]

  const csv = [...instructions, headers.join(','), ...sampleRows.map(row => row.join(','))].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="inventory-adjustment-import-template.csv"',
    },
  })
}

// POST /api/warehouse/inventory/import - Import stock adjustments from CSV
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

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const text = await file.text()
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')) // Skip empty lines and comments

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
      else if (normalized.includes('location') || normalized === 'barcode') headerMap['locationBarcode'] = index
      else if (normalized === 'quantity' || normalized === 'qty') headerMap['quantity'] = index
      else if (normalized === 'type' || normalized === 'adjustmenttype') headerMap['type'] = index
      else if (normalized.includes('lot')) headerMap['lotNumber'] = index
      else if (normalized.includes('ref') || normalized.includes('po')) headerMap['referenceNumber'] = index
      else if (normalized === 'notes' || normalized === 'note') headerMap['notes'] = index
    })

    if (headerMap['sku'] === undefined) {
      return NextResponse.json({ error: 'CSV must have a SKU column' }, { status: 400 })
    }
    if (headerMap['locationBarcode'] === undefined) {
      return NextResponse.json({ error: 'CSV must have a Location Barcode column' }, { status: 400 })
    }
    if (headerMap['quantity'] === undefined) {
      return NextResponse.json({ error: 'CSV must have a Quantity column' }, { status: 400 })
    }

    // Parse rows
    const results: Array<{
      row: number
      sku: string
      status: 'success' | 'error'
      message?: string
      adjustment?: { previous: number; new: number }
    }> = []

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

      const locationBarcode = getValue('locationBarcode')
      if (!locationBarcode) {
        results.push({ row: rowNum, sku, status: 'error', message: 'Location is required' })
        errorCount++
        continue
      }

      const quantityStr = getValue('quantity')
      const quantity = parseNumber(quantityStr)
      if (isNaN(quantity) || quantity < 0) {
        results.push({ row: rowNum, sku, status: 'error', message: 'Invalid quantity' })
        errorCount++
        continue
      }

      const typeStr = getValue('type').toUpperCase() || 'SET'
      if (!['SET', 'ADD', 'REMOVE'].includes(typeStr)) {
        results.push({ row: rowNum, sku, status: 'error', message: 'Invalid type. Use SET, ADD, or REMOVE' })
        errorCount++
        continue
      }

      const lotNumber = getValue('lotNumber') || null
      const referenceNumber = getValue('referenceNumber') || null
      const notes = getValue('notes') || `Import adjustment: ${typeStr} ${quantity}`

      // Find the item
      const item = await db.inventoryItem.findFirst({
        where: { tenantId: membership.tenantId, sku },
      })

      if (!item) {
        results.push({ row: rowNum, sku, status: 'error', message: `Item with SKU "${sku}" not found` })
        errorCount++
        continue
      }

      // Check if item requires reference tracking
      if (item.trackByReference && !referenceNumber) {
        results.push({ row: rowNum, sku, status: 'error', message: 'Reference Number (PO#) is required for this item' })
        errorCount++
        continue
      }

      // Find the location
      const location = await db.warehouseLocation.findFirst({
        where: { tenantId: membership.tenantId, barcode: locationBarcode },
      })

      if (!location) {
        results.push({ row: rowNum, sku, status: 'error', message: `Location "${locationBarcode}" not found` })
        errorCount++
        continue
      }

      try {
        // Perform the adjustment in a transaction
        const result = await db.$transaction(async (tx) => {
          // Get or create stock record
          let stock = await tx.inventoryStock.findFirst({
            where: {
              tenantId: membership.tenantId,
              itemId: item.id,
              locationId: location.id,
              lotNumber: lotNumber,
              referenceNumber: referenceNumber,
            },
          })

          const previousQty = stock?.available || 0
          let newQty: number

          switch (typeStr) {
            case 'SET':
              newQty = quantity
              break
            case 'ADD':
              newQty = previousQty + quantity
              break
            case 'REMOVE':
              newQty = previousQty - quantity
              if (newQty < 0) {
                throw new Error(`Cannot remove ${quantity}. Only ${previousQty} available.`)
              }
              break
            default:
              newQty = quantity
          }

          if (!stock) {
            // Create new stock record
            stock = await tx.inventoryStock.create({
              data: {
                tenantId: membership.tenantId,
                itemId: item.id,
                locationId: location.id,
                lotNumber: lotNumber,
                referenceNumber: referenceNumber,
                available: newQty,
                reserved: 0,
                damaged: 0,
                onHold: 0,
              },
            })
          } else {
            // Update existing stock
            stock = await tx.inventoryStock.update({
              where: { id: stock.id },
              data: { available: newQty },
            })
          }

          // Create transaction record
          const transactionType: InventoryTransactionType = typeStr === 'REMOVE' ? 'ADJUST' : 'ADJUST'
          const adjustmentQty = newQty - previousQty

          await tx.inventoryTransaction.create({
            data: {
              tenantId: membership.tenantId,
              itemId: item.id,
              locationId: location.id,
              type: transactionType,
              quantity: adjustmentQty,
              previousQty,
              newQty,
              referenceType: 'IMPORT',
              lotNumber: lotNumber,
              referenceNumber: referenceNumber,
              userId: session.user.id,
              notes,
            },
          })

          return { previousQty, newQty }
        })

        results.push({
          row: rowNum,
          sku,
          status: 'success',
          adjustment: { previous: result.previousQty, new: result.newQty },
        })
        successCount++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to adjust stock'
        results.push({ row: rowNum, sku, status: 'error', message })
        errorCount++
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        success: successCount,
        errors: errorCount,
      },
      results,
    })
  } catch (error) {
    console.error('Error importing inventory adjustments:', error)
    return NextResponse.json(
      { error: 'Failed to import inventory adjustments' },
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

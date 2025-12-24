import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { normalizeCategory } from '@/lib/warehouse/constants'

interface ImportResult {
  row: number
  sku: string
  status: 'created' | 'updated' | 'error'
  message?: string
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"'
      i++ // Skip next quote
    } else if (char === '"') {
      inQuotes = !inQuotes
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

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim())
  const rows = lines.slice(1).map((line) => parseCSVLine(line))

  return { headers, rows }
}

// POST /api/warehouse/items/import - Import items from CSV
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

    // Only admin, full_admin, warehouse can import
    const allowedRoles = ['admin', 'full_admin', 'warehouse']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const updateExisting = formData.get('updateExisting') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const content = await file.text()
    const { headers, rows } = parseCSV(content)

    if (headers.length === 0) {
      return NextResponse.json({ error: 'Empty or invalid CSV file' }, { status: 400 })
    }

    // Map header names to indices
    const headerMap: Record<string, number> = {}

    headers.forEach((header, index) => {
      // Normalize header names
      const normalized = header.replace(/[^a-z0-9]/g, ' ').trim()
      if (normalized.includes('sku')) headerMap['sku'] = index
      else if (normalized.includes('upc')) headerMap['upc'] = index
      else if (normalized === 'name' || normalized.includes('item name') || normalized.includes('product name')) headerMap['name'] = index
      else if (normalized.includes('description') || normalized.includes('desc')) headerMap['description'] = index
      else if (normalized.includes('category') || normalized.includes('cat')) headerMap['category'] = index
      else if (normalized.includes('weight') || normalized.includes('wt')) headerMap['weight'] = index
      else if (normalized.includes('length') || normalized.includes('len')) headerMap['length'] = index
      else if (normalized.includes('width') || normalized.includes('wd')) headerMap['width'] = index
      else if (normalized.includes('height') || normalized.includes('ht')) headerMap['height'] = index
      else if (normalized.includes('dimension unit') || normalized.includes('dim unit')) headerMap['dimensionUnit'] = index
      else if (normalized.includes('customer pace') || normalized.includes('pace id')) headerMap['customerPaceId'] = index
      else if (normalized.includes('customer') && !normalized.includes('pace')) headerMap['customerName'] = index
      else if (normalized.includes('active')) headerMap['active'] = index
      else if (normalized.includes('track') && normalized.includes('ref')) headerMap['trackByReference'] = index
    })

    // Validate required headers
    if (headerMap['sku'] === undefined) {
      return NextResponse.json({ error: 'CSV must have a SKU column' }, { status: 400 })
    }
    if (headerMap['name'] === undefined) {
      return NextResponse.json({ error: 'CSV must have a Name column' }, { status: 400 })
    }

    // Get existing SKUs for this tenant (only items with SKUs)
    const existingItems = await db.inventoryItem.findMany({
      where: { tenantId: membership.tenantId, sku: { not: null } },
      select: { id: true, sku: true },
    })
    const existingSkuMap = new Map(
      existingItems
        .filter((item: (typeof existingItems)[number]): item is { id: string; sku: string } => item.sku !== null)
        .map((item: { id: string; sku: string }) => [item.sku.toLowerCase(), item.id])
    )

    // Get customer mapping if customer pace IDs are provided
    const customerMap = new Map<string, string>()
    if (headerMap['customerPaceId'] !== undefined) {
      const customers = await db.warehouseCustomer.findMany({
        where: { tenantId: membership.tenantId, isActive: true },
        select: { id: true, paceCustomerId: true },
      })
      customers.forEach((c: (typeof customers)[number]) => customerMap.set(c.paceCustomerId.toLowerCase(), c.id))
    }

    const results: ImportResult[] = []
    let created = 0
    let updated = 0
    let errors = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // 1-indexed, plus header row

      try {
        const getValue = (key: string): string | undefined => {
          const idx = headerMap[key]
          return idx !== undefined ? row[idx] : undefined
        }

        const sku = getValue('sku')
        const name = getValue('name')

        if (!sku || !name) {
          results.push({ row: rowNum, sku: sku || '(empty)', status: 'error', message: 'SKU and Name are required' })
          errors++
          continue
        }

        // Parse numeric values
        const parseNum = (val: string | undefined): number | undefined => {
          if (!val) return undefined
          const num = parseFloat(val)
          return isNaN(num) ? undefined : num
        }

        // Check if SKU exists
        const existingId = existingSkuMap.get(sku.toLowerCase())

        if (existingId && !updateExisting) {
          results.push({ row: rowNum, sku, status: 'error', message: 'SKU already exists (enable update to modify)' })
          errors++
          continue
        }

        // Get customer ID if pace ID provided
        let customerId: string | null = null
        const customerPaceId = getValue('customerPaceId')
        if (customerPaceId) {
          const cId = customerMap.get(customerPaceId.toLowerCase())
          if (cId) {
            customerId = cId
          }
        }

        // Build dimensions object
        const length = parseNum(getValue('length'))
        const width = parseNum(getValue('width'))
        const height = parseNum(getValue('height'))
        const dimensionUnit = getValue('dimensionUnit') || 'in'
        const hasDimensions = length || width || height
        const dimensions = hasDimensions ? { length, width, height, unit: dimensionUnit } : null

        // Parse active status
        const activeVal = getValue('active')?.toLowerCase()
        const isActive = activeVal === 'no' || activeVal === 'false' || activeVal === '0' ? false : true

        // Parse trackByReference
        const trackRefVal = getValue('trackByReference')?.toLowerCase()
        const trackByReference = trackRefVal === 'yes' || trackRefVal === 'true' || trackRefVal === '1' ? true : false

        const itemData = {
          sku,
          upc: getValue('upc') || null,
          name,
          description: getValue('description') || null,
          category: normalizeCategory(getValue('category')),
          weight: parseNum(getValue('weight')) || null,
          dimensions: dimensions ?? null,
          customerId,
          isActive,
          trackByReference,
        }

        if (existingId) {
          // Update existing item
          await db.inventoryItem.update({
            where: { id: existingId },
            data: itemData,
          })
          results.push({ row: rowNum, sku, status: 'updated' })
          updated++
        } else {
          // Create new item
          await db.inventoryItem.create({
            data: {
              ...itemData,
              tenantId: membership.tenantId,
            },
          })
          existingSkuMap.set(sku.toLowerCase(), 'new') // Prevent duplicate creates in same import
          results.push({ row: rowNum, sku, status: 'created' })
          created++
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        results.push({ row: rowNum, sku: row[headerMap['sku']] || '(unknown)', status: 'error', message })
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: rows.length,
        created,
        updated,
        errors,
      },
      results,
    })
  } catch (error) {
    console.error('Error importing items:', error)
    return NextResponse.json(
      { error: 'Failed to import items', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET /api/warehouse/items/import - Get import template
export async function GET() {
  const headers = [
    'SKU',
    'UPC',
    'Name',
    'Description',
    'Category',
    'Weight',
    'Length',
    'Width',
    'Height',
    'Dimension Unit',
    'Customer PACE ID',
    'Active',
    'Track By Reference',
  ]

  const exampleRow = [
    'ITEM-001',
    '012345678901',
    'Example Product',
    'Product description here',
    'raw_materials',
    '1.5',
    '10',
    '8',
    '6',
    'in',
    '',
    'Yes',
    'No',
  ]

  const csv = [headers.join(','), exampleRow.join(',')].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="item-import-template.csv"',
    },
  })
}

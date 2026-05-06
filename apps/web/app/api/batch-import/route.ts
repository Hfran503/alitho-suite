import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { queueBatchImport } from '@/lib/queue/batch-import-queue'

/**
 * Parse date string in various formats (MM/DD/YY, MM/DD/YYYY, YYYY-MM-DD, etc.)
 * Handles 2-digit years by assuming 2000s (e.g., "26" → 2026)
 */
function parseShipDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null

  const trimmed = dateStr.trim()
  if (!trimmed) return null

  // Try MM/DD/YY or MM/DD/YYYY format (US date format)
  const usDateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (usDateMatch) {
    const month = parseInt(usDateMatch[1], 10)
    const day = parseInt(usDateMatch[2], 10)
    let year = parseInt(usDateMatch[3], 10)

    // Convert 2-digit year to 4-digit (assume 2000s for years 00-99)
    if (year < 100) {
      year = 2000 + year
    }

    // Create date (month is 0-indexed in JavaScript)
    const date = new Date(year, month - 1, day)

    // Validate the date is valid
    if (!isNaN(date.getTime()) && date.getMonth() === month - 1) {
      return date
    }
  }

  // Try ISO format (YYYY-MM-DD)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const date = new Date(trimmed)
    if (!isNaN(date.getTime())) {
      return date
    }
  }

  // Fallback to native Date parsing
  const fallbackDate = new Date(trimmed)
  if (!isNaN(fallbackDate.getTime())) {
    return fallbackDate
  }

  console.warn(`[API] Could not parse date: "${dateStr}"`)
  return null
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { fileName, sheetName, rows, shippingConfig, columnMapping, originalData } = body

    // Log first row's shipDate for debugging
    if (rows && rows.length > 0 && rows[0].shipDate) {
      console.log(`[API] First row shipDate received from frontend: "${rows[0].shipDate}" (Type: ${typeof rows[0].shipDate})`)
    }

    if (!fileName || !rows || !shippingConfig) {
      return NextResponse.json(
        { error: 'Missing required fields: fileName, rows, shippingConfig' },
        { status: 400 }
      )
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!membership?.tenantId) {
      return NextResponse.json({ error: 'User has no tenant' }, { status: 400 })
    }

    // Create batch import record
    const batchImport = await db.batchImport.create({
      data: {
        fileName,
        sheetName,
        status: 'PENDING',
        totalRows: rows.length,
        successfulRows: 0,
        failedRows: 0,
        tenantId: membership.tenantId,
        carrierId: shippingConfig.carrierId,
        carrierCode: shippingConfig.carrierCode,
        serviceCode: shippingConfig.serviceCode,
        carrier: shippingConfig.carrier,
        service: shippingConfig.service,
        billToParty: shippingConfig.billToParty || 'sender',
        billToAccount: shippingConfig.billToAccount,
        billToCountryCode: shippingConfig.billToCountryCode,
        billToPostalCode: shippingConfig.billToPostalCode,
        fromAddress: JSON.stringify(shippingConfig.fromAddress),
        containsAlcohol: shippingConfig.containsAlcohol || false,
        saturdayDelivery: shippingConfig.saturdayDelivery || false,
        confirmation: shippingConfig.confirmation || 'none',
        notificationsEmail: shippingConfig.notificationsEmail,
        skipAddressVerification: shippingConfig.skipAddressVerification || false,
        skipLabels: shippingConfig.skipLabels || false,
        columnMapping: columnMapping || {},
        originalData: originalData || null,
        rows: {
          create: rows.map((row: any) => {
            // Parse shipDate using robust parser that handles MM/DD/YY format
            const parsedShipDate = parseShipDate(row.shipDate)
            if (row.shipDate) {
              console.log(`[API] Row ${row.rowNumber} shipDate: "${row.shipDate}" → ${parsedShipDate?.toISOString() ?? 'null'} (${parsedShipDate?.toLocaleDateString() ?? 'invalid'})`)
            }
            return {
            rowNumber: row.rowNumber,
            position: row.position || null,
            status: 'PENDING',
            shipDate: parsedShipDate,
            jobNumber: row.jobNumber,
            shipToName: row.shipToName ? (row.shipToName.length > 60 ? row.shipToName.substring(0, 60) : row.shipToName) : null,
            shipToCompany: row.shipToCompany ? (row.shipToCompany.length > 60 ? row.shipToCompany.substring(0, 60) : row.shipToCompany) : null,
            shipToAddress1: row.shipToAddress1,
            shipToAddress2: row.shipToAddress2,
            shipToCity: row.shipToCity,
            shipToState: row.shipToState,
            shipToZip: row.shipToZip,
            shipToCountry: row.shipToCountry || 'US',
            shipToPhone: row.shipToPhone,
            totalPackages: row.totalPackages,
            packageNumber: row.packageNumber,
            weight: row.weight,
            length: row.length,
            width: row.width,
            height: row.height,
            reference1: row.reference1,
            reference2: row.reference2,
            reference3: row.reference3,
            itemNumber: row.itemNumber,
            itemQuantity: row.itemQuantity,
          }
          }),
        },
      },
    })

    // Queue the batch for processing
    await queueBatchImport(batchImport.id, membership.tenantId)

    return NextResponse.json({
      success: true,
      data: {
        batchId: batchImport.id,
        totalRows: rows.length,
      },
    })
  } catch (error: any) {
    console.error('[API] Batch import create error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create batch import' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { queueBatchImport } from '@/lib/queue/batch-import-queue'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { fileName, sheetName, rows, shippingConfig, columnMapping } = body

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
        columnMapping: columnMapping || {},
        rows: {
          create: rows.map((row: any) => {
            // Log shipDate conversion for debugging
            if (row.shipDate) {
              const parsedDate = new Date(row.shipDate)
              console.log(`[API] Row ${row.rowNumber} shipDate: "${row.shipDate}" → ${parsedDate.toISOString()} (${parsedDate.toLocaleDateString()})`)
            }
            return {
            rowNumber: row.rowNumber,
            status: 'PENDING',
            shipDate: row.shipDate ? new Date(row.shipDate) : null,
            jobNumber: row.jobNumber,
            shipToName: row.shipToName,
            shipToCompany: row.shipToCompany,
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

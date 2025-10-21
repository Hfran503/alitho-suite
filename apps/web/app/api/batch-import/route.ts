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

    if (!fileName || !rows || !shippingConfig) {
      return NextResponse.json(
        { error: 'Missing required fields: fileName, rows, shippingConfig' },
        { status: 400 }
      )
    }

    // Get user's tenant
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    })

    if (!user?.tenantId) {
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
        tenantId: user.tenantId,
        carrierId: shippingConfig.carrier,
        serviceCode: shippingConfig.service,
        billToParty: shippingConfig.billToParty || 'sender',
        billToAccount: shippingConfig.billToAccount,
        fromAddress: shippingConfig.shipFrom,
        containsAlcohol: shippingConfig.containsAlcohol || false,
        saturdayDelivery: shippingConfig.saturdayDelivery || false,
        confirmation: shippingConfig.confirmation || 'none',
        columnMapping: columnMapping || {},
        rows: {
          create: rows.map((row: any) => ({
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
          })),
        },
      },
    })

    // Queue the batch for processing
    await queueBatchImport(batchImport.id, user.tenantId)

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

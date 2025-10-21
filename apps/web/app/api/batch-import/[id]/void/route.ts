import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { rowId, trackingNumber } = body

    if (!rowId || !trackingNumber) {
      return NextResponse.json({ error: 'Missing rowId or trackingNumber' }, { status: 400 })
    }

    // Get user's tenant
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    })

    if (!user?.tenantId) {
      return NextResponse.json({ error: 'User has no tenant' }, { status: 400 })
    }

    // Verify batch belongs to user's tenant
    const batch = await db.batchImport.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Get the row
    const row = await db.batchImportRow.findFirst({
      where: {
        id: rowId,
        batchImportId: id,
      },
    })

    if (!row) {
      return NextResponse.json({ error: 'Row not found' }, { status: 404 })
    }

    if (row.status !== 'SUCCESS') {
      return NextResponse.json({ error: 'Can only void successful labels' }, { status: 400 })
    }

    // Get ShipStation client for this tenant
    const { getShipStationClient } = await import('@/lib/shipstation')

    let shipStationClient
    try {
      shipStationClient = await getShipStationClient(user.tenantId)
    } catch (error: any) {
      return NextResponse.json(
        { error: 'ShipStation not configured for this tenant', details: error.message },
        { status: 400 }
      )
    }

    // Check if we have the ShipStation shipment ID
    if (!row.shipstationShipmentId) {
      return NextResponse.json(
        { error: 'ShipStation shipment ID not found for this row' },
        { status: 400 }
      )
    }

    // Void the label using ShipStation client
    let voidData
    try {
      if (row.shipstationLabelId) {
        voidData = await shipStationClient.voidLabel(row.shipstationLabelId)
      } else {
        throw new Error('No label ID available to void')
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to void label with ShipStation')
    }

    // Update row to mark as voided
    await db.batchImportRow.update({
      where: { id: rowId },
      data: {
        status: 'FAILED',
        errorMessage: 'Label voided by user',
        trackingNumber: null,
        labelUrl: null,
      },
    })

    // Update batch stats
    await db.batchImport.update({
      where: { id },
      data: {
        successfulRows: { decrement: 1 },
        failedRows: { increment: 1 },
      },
    })

    // TODO: Also void/delete the Carton and potentially JobShipment in PACE
    // This depends on business logic - do we keep the records or delete them?

    return NextResponse.json({
      success: true,
      message: 'Label voided successfully',
      data: voidData,
    })
  } catch (error: any) {
    console.error('[API] Batch void error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to void label' },
      { status: 500 }
    )
  }
}

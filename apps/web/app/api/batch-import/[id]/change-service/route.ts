import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getShipStationClient } from '@repo/shared'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: batchId } = await params
    const body = await req.json()
    const { rowId, carrierId, serviceCode } = body

    if (!rowId || !carrierId || !serviceCode) {
      return NextResponse.json(
        { error: 'Missing required fields: rowId, carrierId, serviceCode' },
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

    // Verify batch belongs to tenant
    const batch = await db.batchImport.findFirst({
      where: {
        id: batchId,
        tenantId: membership.tenantId,
      },
      select: {
        id: true,
        fromAddress: true,
      },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Get the row
    const row = await db.batchImportRow.findFirst({
      where: {
        id: rowId,
        batchImportId: batchId,
      },
    })

    if (!row) {
      return NextResponse.json({ error: 'Row not found' }, { status: 404 })
    }

    if (row.status !== 'FAILED') {
      return NextResponse.json(
        { error: 'Can only change service for failed rows' },
        { status: 400 }
      )
    }

    // Create label with new service
    const shipStationClient = await getShipStationClient(membership.tenantId)

    // Parse fromAddress
    let fromAddress
    if (batch.fromAddress) {
      const addr = JSON.parse(batch.fromAddress as string)
      const cleanString = (value: any): string | undefined => {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          return undefined
        }
        return String(value).trim()
      }

      fromAddress = {
        name: cleanString(addr.name) || 'Shipping Manager',
        company_name: cleanString(addr.company || addr.company_name) || 'Calitho',
        address_line1: cleanString(addr.street1 || addr.address_line1) || '2312 Stanwell Dr',
        address_line2: cleanString(addr.street2 || addr.address_line2),
        city_locality: cleanString(addr.city || addr.city_locality) || 'Concord',
        state_province: cleanString(addr.state || addr.state_province) || 'CA',
        postal_code: cleanString(addr.zip || addr.postal_code) || '94520',
        country_code: cleanString(addr.country || addr.country_code) || 'US',
        phone: cleanString(addr.phone) || '9256821111',
      }
    } else {
      fromAddress = {
        name: 'Shipping Manager',
        company_name: 'Calitho',
        address_line1: '2312 Stanwell Dr',
        city_locality: 'Concord',
        state_province: 'CA',
        postal_code: '94520',
        country_code: 'US',
        phone: '9256821111',
      }
    }

    const labelRequest = {
      shipment: {
        carrier_id: carrierId,
        service_code: serviceCode,
        ship_to: {
          name: row.shipToName || '',
          company_name: row.shipToCompany || undefined,
          address_line1: row.shipToAddress1 || '',
          address_line2: row.shipToAddress2 || undefined,
          city_locality: row.shipToCity || '',
          state_province: row.shipToState || '',
          postal_code: row.shipToZip || '',
          country_code: row.shipToCountry || 'US',
          phone: row.shipToPhone || undefined,
        },
        ship_from: fromAddress,
        packages: [
          {
            weight: {
              value: row.weight || 1,
              unit: 'pound' as const,
            },
            dimensions: row.length && row.width && row.height ? {
              length: row.length,
              width: row.width,
              height: row.height,
              unit: 'inch' as const,
            } : undefined,
          },
        ],
      },
      label_format: 'pdf' as const,
      label_layout: '4x6' as const,
    }

    console.log('[change-service] Creating label with new service:', {
      rowId,
      carrierId,
      serviceCode,
    })

    const labelResponse = await shipStationClient.createLabels(labelRequest)

    if (!labelResponse.label_download?.pdf) {
      throw new Error('No label returned from ShipStation')
    }

    const trackingNumber = labelResponse.packages?.[0]?.tracking_number || labelResponse.tracking_number
    const cost = labelResponse.shipment_cost?.amount || 0

    // Update row with new label info and reset to PENDING for processing
    await db.batchImportRow.update({
      where: { id: rowId },
      data: {
        status: 'SUCCESS',
        trackingNumber: trackingNumber,
        labelUrl: labelResponse.label_download.pdf,
        shippingCost: cost,
        shipstationLabelId: labelResponse.packages?.[0]?.label_id || labelResponse.label_id,
        shipstationShipmentId: labelResponse.shipment_id,
        errorMessage: null,
        notes: `Service changed from original to ${serviceCode}`,
        processedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Label created with new service',
      trackingNumber,
      cost,
    })
  } catch (error: any) {
    console.error('[change-service] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to change service' },
      { status: 500 }
    )
  }
}

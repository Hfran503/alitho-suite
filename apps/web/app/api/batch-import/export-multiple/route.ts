import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!membership?.tenantId) {
      return NextResponse.json({ error: 'User has no tenant' }, { status: 400 })
    }

    const body = await req.json()
    const { batchIds } = body

    if (!batchIds || !Array.isArray(batchIds) || batchIds.length === 0) {
      return NextResponse.json({ error: 'No batch IDs provided' }, { status: 400 })
    }

    // Fetch all batches with their rows and original data
    const batches = await db.batchImport.findMany({
      where: {
        id: { in: batchIds },
        tenantId: membership.tenantId,
      },
      include: {
        rows: {
          where: { status: 'SUCCESS' },
          orderBy: { rowNumber: 'asc' },
        },
      },
    })

    if (batches.length === 0) {
      return NextResponse.json({ error: 'No batches found' }, { status: 404 })
    }

    // Fetch carrier mappings to get human-readable names
    const carrierMappings = await db.carrierServiceMapping.findMany({
      where: { tenantId: membership.tenantId },
      select: {
        shipstationCarrierId: true,
        carrierName: true,
      },
    })

    // Build carrier ID to name map
    const carrierIdToName: Record<string, string> = {}
    carrierMappings.forEach((mapping) => {
      carrierIdToName[mapping.shipstationCarrierId] = mapping.carrierName
    })

    // Helper function to format carrier names
    const formatCarrierName = (carrierId: string): string => {
      return carrierIdToName[carrierId] || carrierId
    }

    // Fetch ShipStation integration to get tracking URL templates
    const integration = await db.integration.findFirst({
      where: {
        tenantId: membership.tenantId,
        provider: 'shipstation',
      },
      select: {
        config: true,
      },
    })

    // Helper function to generate tracking URL
    const generateTrackingUrl = (trackingNumber: string, carrierId: string): string => {
      if (!trackingNumber) return ''

      // Try to get template from ShipStation config
      if (integration?.config) {
        const config = integration.config as any
        const carrier = config.carriers?.find((c: any) => c.id === carrierId)
        if (carrier?.trackingUrlTemplate) {
          return carrier.trackingUrlTemplate.replace(/{tracking}/g, trackingNumber)
        }
      }

      // Fallback to generic tracking URL
      return `https://www.shipengine.com/tracking/${trackingNumber}`
    }

    // Collect all successful rows from all batches
    let allSuccessfulRows: any[] = []
    let allHeaders = new Set<string>()
    const newDataHeaders = ['Batch ID', 'Batch File Name', 'Carrier', 'Service', 'Tracking Number', 'Tracking URL', 'Label URL', 'Shipping Cost', 'PACE Shipment ID', 'PACE Carton ID', 'Notes']

    // First pass: collect all unique column headers from original data
    for (const batch of batches) {
      const originalData = batch.originalData as any[] | null
      if (originalData && originalData.length > 0) {
        Object.keys(originalData[0]).forEach((header) => allHeaders.add(header))
      }
    }

    const originalHeaders = Array.from(allHeaders)

    // Second pass: process all successful rows
    for (const batch of batches) {
      const originalData = batch.originalData as any[] | null
      const successfulRows = batch.rows

      if (successfulRows.length === 0) {
        continue
      }

      for (const successRow of successfulRows) {
        // Find the corresponding original row
        const originalRowIndex = successRow.rowNumber - 2 // -2 because row 1 is header, row 2 is index 0
        const originalRow = (originalData && originalData[originalRowIndex]) || {}

        // Create row with all original columns (even if empty for this batch)
        const rowData: any = {}

        // Add original data columns
        for (const header of originalHeaders) {
          const value = originalRow[header]
          rowData[header] = value != null ? String(value) : ''
        }

        // Add new shipping data columns
        rowData['Batch ID'] = batch.id
        rowData['Batch File Name'] = batch.fileName || ''
        rowData['Carrier'] = batch.carrierId ? formatCarrierName(batch.carrierId) : ''
        rowData['Service'] = batch.serviceCode || ''
        rowData['Tracking Number'] = successRow.trackingNumber || ''
        // Generate tracking URL if not present (for backcompat with old batches)
        rowData['Tracking URL'] = successRow.trackingUrl || generateTrackingUrl(successRow.trackingNumber || '', batch.carrierId || '')
        rowData['Label URL'] = successRow.labelUrl || ''
        rowData['Shipping Cost'] = successRow.shippingCost ? successRow.shippingCost.toFixed(2) : ''
        rowData['PACE Shipment ID'] = successRow.paceJobShipmentId ? String(successRow.paceJobShipmentId) : ''
        rowData['PACE Carton ID'] = successRow.paceCartonId ? String(successRow.paceCartonId) : ''
        rowData['Notes'] = successRow.notes || ''

        allSuccessfulRows.push(rowData)
      }
    }

    if (allSuccessfulRows.length === 0) {
      return NextResponse.json({ error: 'No successful rows found in selected batches' }, { status: 404 })
    }

    // Create CSV
    const headers = [...originalHeaders, ...newDataHeaders]

    const escapeCSV = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }

    const csvRows = allSuccessfulRows.map((row) => {
      return headers.map((header) => escapeCSV(row[header] || '')).join(',')
    })

    const csv = [headers.map(escapeCSV).join(','), ...csvRows].join('\n')

    // Return CSV as downloadable file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="batch-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error: any) {
    console.error('[API] Export multiple batches error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export batches' },
      { status: 500 }
    )
  }
}

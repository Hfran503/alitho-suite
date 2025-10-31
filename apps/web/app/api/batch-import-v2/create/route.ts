import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getShipStationApiKey } from '@repo/shared'

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
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!membership?.tenantId) {
      return NextResponse.json({ error: 'User has no tenant' }, { status: 400 })
    }

    // Get ship_from address
    const fromAddress = shippingConfig.fromAddress
    if (!fromAddress) {
      return NextResponse.json(
        { error: 'Missing fromAddress in shipping configuration' },
        { status: 400 }
      )
    }

    // Get ShipStation API key
    const apiKey = await getShipStationApiKey(membership.tenantId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ShipStation API key not configured' },
        { status: 400 }
      )
    }

    // Build ship_from address for ShipEngine
    const shipFrom = {
      name: fromAddress.name,
      company_name: fromAddress.company,
      address_line1: fromAddress.street1,
      address_line2: fromAddress.street2 || '',
      city_locality: fromAddress.city,
      state_province: fromAddress.state,
      postal_code: fromAddress.zip,
      country_code: fromAddress.country || 'US',
      phone: fromAddress.phone || '',
      address_residential_indicator: 'no',
    }

    // Check if warehouse exists for this address
    let warehouse = await db.warehouse.findFirst({
      where: {
        tenantId: membership.tenantId,
        addressLine1: fromAddress.street1,
        cityLocality: fromAddress.city,
        stateProvince: fromAddress.state,
        postalCode: fromAddress.zip,
      },
    })

    // If no warehouse exists, create one in ShipEngine
    if (!warehouse?.shipEngineWarehouseId) {
      console.log('[Batch V2] Creating warehouse in ShipEngine for batch processing')

      const warehouseResponse = await fetch(
        `${process.env.SHIPENGINE_API_URL || 'https://api.shipengine.com'}/v1/warehouses`,
        {
          method: 'POST',
          headers: {
            'API-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: fromAddress.company || fromAddress.name || 'Default Warehouse',
            origin_address: shipFrom,
            return_address: shipFrom,
          }),
        }
      )

      if (!warehouseResponse.ok) {
        const errorData = await warehouseResponse.json()
        console.error('[Batch V2] Failed to create warehouse:', errorData)
        throw new Error(
          errorData.errors?.[0]?.message || errorData.message || 'Failed to create warehouse'
        )
      }

      const warehouseData = await warehouseResponse.json()
      console.log(`[Batch V2] Created ShipEngine warehouse: ${warehouseData.warehouse_id}`)

      // Save or update warehouse in database
      if (warehouse) {
        warehouse = await db.warehouse.update({
          where: { id: warehouse.id },
          data: { shipEngineWarehouseId: warehouseData.warehouse_id },
        })
      } else {
        warehouse = await db.warehouse.create({
          data: {
            name: fromAddress.company || fromAddress.name || 'Default Warehouse',
            shipEngineWarehouseId: warehouseData.warehouse_id,
            companyName: fromAddress.company,
            addressLine1: fromAddress.street1,
            addressLine2: fromAddress.street2 || '',
            cityLocality: fromAddress.city,
            stateProvince: fromAddress.state,
            postalCode: fromAddress.zip,
            countryCode: fromAddress.country || 'US',
            phone: fromAddress.phone || '',
            isDefault: true,
            tenantId: membership.tenantId,
          },
        })
      }
    }

    const warehouseId = warehouse.shipEngineWarehouseId!

    console.log(`[Batch V2] Creating batch with ${rows.length} shipments using warehouse ${warehouseId}`)

    // Group rows by Job# + Address to create shipments
    const shipmentGroups = groupRowsByShipment(rows)
    console.log(`[Batch V2] Grouped into ${shipmentGroups.length} unique shipments`)

    // Create unique batch identifier for external shipment IDs
    const batchTimestamp = Date.now()

    // Create ShipEngine shipments for each group
    const shipmentIds: string[] = []
    const shipmentMap = new Map<string, any>() // Maps groupKey to shipment data

    for (const group of shipmentGroups) {
      const firstRow = group.rows[0]

      // Build packages array
      const packages = group.rows.map((row: any) => ({
        weight: {
          value: row.weight || 1,
          unit: 'pound',
        },
        dimensions: {
          length: row.length || 1,
          width: row.width || 1,
          height: row.height || 1,
          unit: 'inch',
        },
        label_messages: {
          reference1: row.reference1 || '',
          reference2: row.reference2 || '',
          reference3: row.reference3 || '',
        },
      }))

      // Build ship to address
      const shipTo = {
        name: firstRow.shipToName || '',
        company_name: firstRow.shipToCompany || '',
        address_line1: firstRow.shipToAddress1,
        address_line2: firstRow.shipToAddress2 || '',
        city_locality: firstRow.shipToCity,
        state_province: firstRow.shipToState,
        postal_code: firstRow.shipToZip,
        country_code: firstRow.shipToCountry || 'US',
        phone: firstRow.shipToPhone || '',
      }

      // Create shipment via ShipEngine (using /shipments endpoint that expects 'shipments' array)
      const shipmentResponse = await fetch(
        `${process.env.SHIPENGINE_API_URL || 'https://api.shipengine.com'}/v1/shipments`,
        {
          method: 'POST',
          headers: {
            'API-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shipments: [
              {
                carrier_id: shippingConfig.carrierId,
                service_code: shippingConfig.serviceCode,
                external_shipment_id: `${batchTimestamp}-${firstRow.jobNumber}-${group.groupKey}`,
                ship_date: firstRow.shipDate || new Date().toISOString(),
                warehouse_id: warehouseId,
                ship_to: shipTo,
                packages,
                advanced_options: {
                  // Only include bill_to_party if it's third_party, otherwise omit it
                  ...(shippingConfig.billToParty === 'third_party' && {
                    bill_to_party: 'third_party',
                    bill_to_account: shippingConfig.billToAccount,
                    bill_to_country_code: shippingConfig.billToCountryCode,
                    bill_to_postal_code: shippingConfig.billToPostalCode,
                  }),
                  contains_alcohol: shippingConfig.containsAlcohol || false,
                  saturday_delivery: shippingConfig.saturdayDelivery || false,
                },
                confirmation:
                  shippingConfig.confirmation && shippingConfig.confirmation !== 'none'
                    ? shippingConfig.confirmation
                    : undefined,
              },
            ],
          }),
        }
      )

      if (!shipmentResponse.ok) {
        const errorData = await shipmentResponse.json()
        console.error('[Batch V2] Failed to create shipment:', errorData)
        throw new Error(
          errorData.errors?.[0]?.message || errorData.message || 'Failed to create shipment'
        )
      }

      const shipmentData = await shipmentResponse.json()
      // The API returns an array of shipments, get the first one
      const shipment = shipmentData.shipments?.[0] || shipmentData
      const shipmentId = shipment.shipment_id

      shipmentIds.push(shipmentId)
      shipmentMap.set(group.groupKey, {
        shipment_id: shipmentId,
        rows: group.rows,
      })

      console.log(
        `[Batch V2] Created shipment ${shipmentId} for job ${firstRow.jobNumber}`
      )
    }

    // Create ShipEngine batch
    const batchNotes = `${fileName} - ${new Date().toLocaleString()}`
    const batchResponse = await fetch(
      `${process.env.SHIPENGINE_API_URL || 'https://api.shipengine.com'}/v1/batches`,
      {
        method: 'POST',
        headers: {
          'API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_batch_id: `batch-${Date.now()}`,
          batch_notes: batchNotes,
          shipment_ids: shipmentIds,
        }),
      }
    )

    if (!batchResponse.ok) {
      const errorData = await batchResponse.json()
      console.error('[Batch V2] Failed to create batch:', errorData)
      throw new Error(
        errorData.errors?.[0]?.message || errorData.message || 'Failed to create batch'
      )
    }

    const batchData = await batchResponse.json()
    console.log(`[Batch V2] Created ShipEngine batch: ${batchData.batch_id}`)

    // Process the batch immediately
    const processResponse = await fetch(
      `${process.env.SHIPENGINE_API_URL || 'https://api.shipengine.com'}/v1/batches/${batchData.batch_id}/process/labels`,
      {
        method: 'POST',
        headers: {
          'API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ship_date: new Date().toISOString(),
          label_layout: '4x6',
          label_format: 'pdf',
        }),
      }
    )

    if (!processResponse.ok) {
      const errorData = await processResponse.json()
      console.error('[Batch V2] Failed to process batch:', errorData)
      // Don't throw - batch was created, just failed to process
    }

    // Save batch record in our database for tracking
    await db.batchImportV2.create({
      data: {
        shipEngineBatchId: batchData.batch_id,
        externalBatchId: batchData.external_batch_id,
        fileName,
        sheetName,
        status: batchData.status,
        totalShipments: shipmentIds.length,
        tenantId: membership.tenantId,
        shippingConfig: JSON.stringify(shippingConfig),
        columnMapping: columnMapping || {},
        shipmentMapping: JSON.stringify(Array.from(shipmentMap.entries())),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        shipEngineBatchId: batchData.batch_id,
        totalShipments: shipmentIds.length,
        status: batchData.status,
      },
    })
  } catch (error: any) {
    console.error('[Batch V2] Create error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create batch' },
      { status: 500 }
    )
  }
}

// Group rows by Job# + Address
function groupRowsByShipment(rows: any[]) {
  const grouped = new Map<string, any[]>()

  for (const row of rows) {
    // Create grouping key: Job# + normalized address
    const key = [
      row.jobNumber?.trim(),
      row.shipToAddress1?.trim().toLowerCase(),
      row.shipToCity?.trim().toLowerCase(),
      row.shipToState?.trim().toUpperCase(),
      row.shipToZip?.trim(),
    ]
      .filter(Boolean)
      .join('|')

    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(row)
  }

  // Convert to array
  return Array.from(grouped.entries()).map(([key, rows]) => {
    // Sort by packageNumber to maintain order
    rows.sort((a, b) => (a.packageNumber || 0) - (b.packageNumber || 0))
    return { groupKey: key, rows }
  })
}

import { Worker, Job } from 'bullmq'
import type { Redis } from 'ioredis'
import { db } from '@repo/database'
import { getPaceApiCredentials, getShipStationClient } from '@repo/shared'

interface BatchImportJobData {
  batchId: string
  tenantId: string
}

interface BatchRow {
  id: string
  rowNumber: number
  groupKey: string | null
  shipDate: Date | null
  jobNumber: string
  totalPackages: number
  packageNumber: number
  shipToName: string
  shipToCompany: string | null
  shipToAddress1: string
  shipToAddress2: string | null
  shipToCity: string
  shipToState: string
  shipToZip: string
  shipToCountry: string
  shipToPhone: string | null
  weight: number
  length: number | null
  width: number | null
  height: number | null
  reference1: string | null
  reference2: string | null
  reference3: string | null
  itemNumber: string | null
  itemQuantity: number | null
}

interface GroupedShipment {
  groupKey: string
  jobNumber: string
  shipDate: Date | null
  rows: BatchRow[]
}

/**
 * Create a JobShipment in PACE API
 */
async function createPaceJobShipment(
  jobNumber: string,
  shipDate: Date | null,
  shipmentDetails: {
    shipToName: string
    shipToCompany: string | null
    shipToAddress1: string
    shipToAddress2: string | null
    shipToCity: string
    shipToState: string
    shipToZip: string
    shipToPhone: string | null
    trackingNumber?: string
    carrier?: string
    serviceCode?: string
    totalShippingCost?: number
  }
): Promise<{ success: boolean; shipmentId?: string; error?: string }> {
  try {
    console.log(`[PACE] 🚀 Creating JobShipment for job: ${jobNumber}`)

    const credentials = await getPaceApiCredentials()
    console.log(`[PACE] ✓ Got credentials - URL: ${credentials.url}`)

    // Parse name from shipToCompany field (format: "First Last" or "Company Name")
    const fullName = shipmentDetails.shipToCompany || shipmentDetails.shipToName || ''
    const nameParts = fullName.trim().split(/\s+/)
    const contactFirstName = nameParts.length > 0 ? nameParts[0] : ''
    const contactLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''

    const shipmentData: any = {
      job: jobNumber,
      // Contact name (parsed from Ship To Company)
      contactFirstName: contactFirstName || undefined,
      contactLastName: contactLastName || undefined,
      name: fullName || undefined,
      // Ship-to address
      address1: shipmentDetails.shipToAddress1,
      address2: shipmentDetails.shipToAddress2 || undefined,
      city: shipmentDetails.shipToCity,
      state: shipmentDetails.shipToState,
      zip: shipmentDetails.shipToZip,
      phone: shipmentDetails.shipToPhone || undefined,
      // Tracking info (will be added after label creation)
      trackingNumber: shipmentDetails.trackingNumber || undefined,
      // Shipping cost
      cost: shipmentDetails.totalShippingCost || undefined,
    }

    // Add ship date if provided - fix the date parsing
    if (shipDate) {
      // Ensure we have a valid Date object
      const validDate = shipDate instanceof Date ? shipDate : new Date(shipDate)
      // Format: "2024-10-20T14:30:00" (no timezone, no Z)
      shipmentData.dateTime = validDate.toISOString().substring(0, 19)
      console.log(`[PACE] 📅 Ship date: ${shipmentData.dateTime}`)
    } else {
      // Use current date if no ship date provided
      const now = new Date()
      shipmentData.dateTime = now.toISOString().substring(0, 19)
      console.log(`[PACE] 📅 Ship date (default): ${shipmentData.dateTime}`)
    }

    const authHeader = 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')

    console.log(`[PACE] 📤 Sending request to: ${credentials.url}/CreateObject/createJobShipment`)
    console.log(`[PACE] 📦 Request body:`, JSON.stringify(shipmentData, null, 2))

    const response = await fetch(`${credentials.url}/CreateObject/createJobShipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(shipmentData),
    })

    console.log(`[PACE] 📨 Response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[PACE] ❌ PACE API error (${response.status}):`, errorText)
      return {
        success: false,
        error: `PACE API error: ${response.status} - ${errorText}`,
      }
    }

    const result = await response.json() as any
    console.log(`[PACE] 📨 Response body:`, JSON.stringify(result, null, 2))

    const shipmentId = result.id || result.ID || result.shipmentId
    console.log(`[PACE] ✅ Successfully created JobShipment - ID: ${shipmentId}`)

    return {
      success: true,
      shipmentId,
    }
  } catch (error) {
    console.error('[PACE] ❌ Exception creating PACE JobShipment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating JobShipment',
    }
  }
}

/**
 * Create PACE Carton Content (JobProduct items)
 */
async function createPaceCartonContent(
  cartonId: string,
  jobProductId: string,
  quantity: number
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[PACE] 📦 Adding content to Carton ${cartonId}: JobProduct ${jobProductId}, Qty: ${quantity}`)

    const credentials = await getPaceApiCredentials()

    const contentPayload: any = {
      carton: cartonId,
      jobProduct: jobProductId,
      quantity: quantity,
    }

    const authHeader = 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')

    console.log(`[PACE] 📤 Creating carton content:`, JSON.stringify(contentPayload, null, 2))

    const response = await fetch(`${credentials.url}/CreateObject/createCartonContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(contentPayload),
    })

    console.log(`[PACE] 📨 Carton content response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[PACE] ❌ Carton content error (${response.status}):`, errorText)
      return {
        success: false,
        error: `PACE carton content error: ${response.status} - ${errorText}`,
      }
    }

    const result = await response.json() as any
    console.log(`[PACE] ✅ Successfully created Carton Content - ID: ${result.id || result.ID}`)

    return { success: true }
  } catch (error) {
    console.error('[PACE] ❌ Exception creating PACE Carton Content:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating Carton Content',
    }
  }
}

/**
 * Create PACE Carton with content
 */
async function createPaceCarton(
  shipmentId: string,
  cartonData: {
    trackingNumber: string
    weight: number
    length?: number | null
    width?: number | null
    height?: number | null
    jobProductId?: string | null
    itemQuantity?: number | null
    reference1?: string | null
    reference2?: string | null
    reference3?: string | null
  }
): Promise<{ success: boolean; cartonId?: string; error?: string }> {
  try {
    console.log(`[PACE] 📦 Creating Carton for shipment ${shipmentId}, tracking: ${cartonData.trackingNumber}`)

    const credentials = await getPaceApiCredentials()

    const cartonPayload: any = {
      shipment: parseInt(shipmentId), // Use "shipment" not "jobShipment", and parse to int
      trackingNumber: cartonData.trackingNumber,
      weight: cartonData.weight,
      count: 1, // One carton
      quantity: cartonData.itemQuantity || 0, // Total quantity in this carton
      addDefaultContent: false, // We'll add content manually
    }

    // Add dimensions if provided
    if (cartonData.length && cartonData.width && cartonData.height) {
      cartonPayload.length = cartonData.length
      cartonPayload.width = cartonData.width
      cartonPayload.height = cartonData.height
    }

    // Add references if provided
    if (cartonData.reference1) cartonPayload.note1 = cartonData.reference1
    if (cartonData.reference2) cartonPayload.note2 = cartonData.reference2
    if (cartonData.reference3) cartonPayload.note3 = cartonData.reference3

    const authHeader = 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')

    console.log(`[PACE] 📤 Creating carton:`, JSON.stringify(cartonPayload, null, 2))

    const response = await fetch(`${credentials.url}/CreateObject/createCarton`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(cartonPayload),
    })

    console.log(`[PACE] 📨 Carton response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[PACE] ❌ Carton creation error (${response.status}):`, errorText)
      return {
        success: false,
        error: `PACE carton error: ${response.status} - ${errorText}`,
      }
    }

    const result = await response.json() as any
    console.log(`[PACE] 📨 Carton response:`, JSON.stringify(result, null, 2))

    const cartonId = result.id || result.ID
    console.log(`[PACE] ✅ Successfully created Carton - ID: ${cartonId}`)

    // Add carton content if JobProduct ID is provided
    if (cartonId && cartonData.jobProductId && cartonData.itemQuantity) {
      const contentResult = await createPaceCartonContent(
        cartonId.toString(),
        cartonData.jobProductId,
        cartonData.itemQuantity
      )
      if (!contentResult.success) {
        console.warn(`[PACE] ⚠️  Failed to add carton content: ${contentResult.error}`)
        // Don't fail the carton creation, just log warning
      }
    }

    return {
      success: true,
      cartonId: cartonId?.toString(),
    }
  } catch (error) {
    console.error('[PACE] ❌ Exception creating PACE Carton:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating Carton',
    }
  }
}

/**
 * Update PACE JobShipment with tracking information
 * @unused - Currently not used but kept for future use
 */
/*
async function updatePaceJobShipmentTracking(
  shipmentId: string,
  trackingNumber: string,
  _carrier?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[PACE] 📝 Updating JobShipment ${shipmentId} with tracking: ${trackingNumber}`)

    const credentials = await getPaceApiCredentials()

    const updateData: any = {
      id: shipmentId,
      trackingNumber: trackingNumber,
      shipped: true,
    }

    const authHeader = 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')

    const response = await fetch(`${credentials.url}/UpdateObject/updateJobShipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(updateData),
    })

    console.log(`[PACE] 📨 Update response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[PACE] ❌ Update error (${response.status}):`, errorText)
      return {
        success: false,
        error: `PACE update error: ${response.status} - ${errorText}`,
      }
    }

    await response.json()
    console.log(`[PACE] ✅ Successfully updated JobShipment with tracking`)

    return { success: true }
  } catch (error) {
    console.error('[PACE] ❌ Exception updating PACE JobShipment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error updating JobShipment',
    }
  }
}
*/

/**
 * Create shipping labels via ShipStation for a group of packages
 */
async function createShippingLabels(
  tenantId: string,
  batch: any,
  rows: BatchRow[]
): Promise<{
  success: boolean
  labels?: Array<{
    rowId: string
    labelId: string
    shipmentId: string
    trackingNumber: string
    labelUrl: string
    cost: number
  }>
  error?: string
}> {
  try {
    const shipStationClient = await getShipStationClient(tenantId)

    // Build packages array from rows
    const packages = rows.map((row) => ({
      weight: {
        value: row.weight,
        unit: 'pound' as const,
      },
      dimensions: row.length && row.width && row.height ? {
        length: row.length,
        width: row.width,
        height: row.height,
        unit: 'inch' as const,
      } : undefined,
      label_messages: {
        reference1: row.reference1 || undefined,
        reference2: row.reference2 || undefined,
        reference3: row.reference3 || undefined,
      },
    }))

    // Use the first row for ship_to address (all rows in group have same destination)
    const firstRow = rows[0]

    // Parse fromAddress from batch and convert to ShipStation format
    let fromAddress
    if (batch.fromAddress) {
      const addr = JSON.parse(batch.fromAddress)

      // Helper to clean string - convert empty strings to undefined
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
        carrier_id: batch.carrierId,
        service_code: batch.serviceCode,
        ship_to: {
          name: firstRow.shipToName,
          company_name: firstRow.shipToCompany || undefined,
          address_line1: firstRow.shipToAddress1,
          address_line2: firstRow.shipToAddress2 || undefined,
          city_locality: firstRow.shipToCity,
          state_province: firstRow.shipToState,
          postal_code: firstRow.shipToZip,
          country_code: firstRow.shipToCountry || 'US',
          phone: firstRow.shipToPhone || undefined,
        },
        ship_from: fromAddress,
        packages,
      },
      label_format: 'pdf' as 'pdf' | 'zpl' | 'png',
      label_layout: '4x6' as '4x6' | 'letter',
    }

    console.log('[batch-import] ShipStation label request:', JSON.stringify(labelRequest, null, 2))

    let labelResponse
    try {
      labelResponse = await shipStationClient.createLabels(labelRequest)
      console.log('[batch-import] ShipStation label response:', JSON.stringify(labelResponse, null, 2))
    } catch (labelError: any) {
      console.error('[batch-import] ShipStation label creation failed:', labelError.message)
      throw labelError
    }

    // Parse the response and map labels to rows
    const labels = labelResponse.label_download?.pdf ? labelResponse.packages?.map((pkg: any, index: number) => ({
      rowId: rows[index].id,
      labelId: pkg.label_id || labelResponse.label_id,
      shipmentId: labelResponse.shipment_id, // Store shipment ID for voiding
      trackingNumber: pkg.tracking_number || labelResponse.tracking_number,
      labelUrl: labelResponse.label_download.pdf,
      cost: pkg.insurance_cost?.amount || labelResponse.shipment_cost?.amount || 0,
    })) : []

    return {
      success: true,
      labels,
    }
  } catch (error) {
    console.error('Error creating shipping labels:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating labels',
    }
  }
}

/**
 * Process a single shipment group (one or more packages going to same destination)
 */
async function processShipmentGroup(
  tenantId: string,
  batch: any,
  group: GroupedShipment
): Promise<{ successCount: number; failCount: number }> {
  let successCount = 0
  let failCount = 0

  try {
    console.log(`\n[batch-import] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`[batch-import] 📦 Processing group: ${group.groupKey}`)
    console.log(`[batch-import] 📊 Group details:`)
    console.log(`[batch-import]    - Job Number: ${group.jobNumber}`)
    console.log(`[batch-import]    - Ship Date: ${group.shipDate}`)
    console.log(`[batch-import]    - Total Packages: ${group.rows.length}`)
    console.log(`[batch-import]    - Row IDs: ${group.rows.map(r => r.rowNumber).join(', ')}`)

    // Update all rows in group to PROCESSING
    console.log(`[batch-import] 🔄 Updating ${group.rows.length} rows to PROCESSING status...`)
    await db.batchImportRow.updateMany({
      where: {
        id: { in: group.rows.map(r => r.id) },
      },
      data: {
        status: 'PROCESSING',
      },
    })

    // Step 1: Create shipping labels via ShipStation FIRST
    console.log(`[batch-import] 🏷️  Step 1: Creating shipping labels via ShipStation...`)
    const labelsResult = await createShippingLabels(tenantId, batch, group.rows)

    if (!labelsResult.success || !labelsResult.labels || labelsResult.labels.length === 0) {
      console.error(`[batch-import] ❌ Label creation failed: ${labelsResult.error}`)
      // Mark all rows as failed
      await db.batchImportRow.updateMany({
        where: {
          id: { in: group.rows.map(r => r.id) },
        },
        data: {
          status: 'FAILED',
          errorMessage: labelsResult.error || 'No labels returned from ShipStation',
          processedAt: new Date(),
        },
      })
      return { successCount: 0, failCount: group.rows.length }
    }

    console.log(`[batch-import] ✅ Created ${labelsResult.labels.length} shipping labels successfully`)
    console.log(`[batch-import] 📋 Labels:`, labelsResult.labels.map(l => ({
      rowNumber: group.rows.find(r => r.id === l.rowId)?.rowNumber,
      tracking: l.trackingNumber,
      labelId: l.labelId,
      cost: l.cost,
    })))

    // Calculate total shipping cost
    const totalShippingCost = labelsResult.labels.reduce((sum, label) => sum + label.cost, 0)
    console.log(`[batch-import] 💰 Total shipping cost: $${totalShippingCost.toFixed(2)}`)

    // Step 2: Create PACE JobShipment with ALL information (address, tracking, cost)
    console.log(`[batch-import] 📝 Step 2: Creating PACE JobShipment with complete data...`)
    const firstRow = group.rows[0]
    const firstTracking = labelsResult.labels[0].trackingNumber

    const paceResult = await createPaceJobShipment(group.jobNumber, group.shipDate, {
      shipToName: firstRow.shipToName,
      shipToCompany: firstRow.shipToCompany,
      shipToAddress1: firstRow.shipToAddress1,
      shipToAddress2: firstRow.shipToAddress2,
      shipToCity: firstRow.shipToCity,
      shipToState: firstRow.shipToState,
      shipToZip: firstRow.shipToZip,
      shipToPhone: firstRow.shipToPhone,
      trackingNumber: firstTracking,
      totalShippingCost: totalShippingCost,
    })

    if (!paceResult.success) {
      console.error(`[batch-import] ❌ PACE creation failed: ${paceResult.error}`)
      // Mark all rows as failed (labels already created, but no PACE shipment)
      await db.batchImportRow.updateMany({
        where: {
          id: { in: group.rows.map(r => r.id) },
        },
        data: {
          status: 'FAILED',
          errorMessage: `Labels created but PACE failed: ${paceResult.error}`,
          processedAt: new Date(),
        },
      })
      return { successCount: 0, failCount: group.rows.length }
    }

    console.log(`[batch-import] ✅ PACE JobShipment created successfully - ID: ${paceResult.shipmentId}`)

    // Step 3: Create PACE Cartons for each label
    console.log(`[batch-import] 📦 Step 3: Creating PACE Cartons...`)
    const cartonIds = new Map<string, string>() // Map rowId to cartonId

    for (const label of labelsResult.labels) {
      if (!paceResult.shipmentId) continue

      const row = group.rows.find(r => r.id === label.rowId)
      if (!row) continue

      const cartonResult = await createPaceCarton(paceResult.shipmentId, {
        trackingNumber: label.trackingNumber,
        weight: row.weight,
        length: row.length,
        width: row.width,
        height: row.height,
        jobProductId: row.itemNumber, // This is the JobProduct ID from the import file
        itemQuantity: row.itemQuantity,
        reference1: row.reference1,
        reference2: row.reference2,
        reference3: row.reference3,
      })

      if (cartonResult.success && cartonResult.cartonId) {
        cartonIds.set(label.rowId, cartonResult.cartonId)
        console.log(`[batch-import]    - Created carton ${cartonResult.cartonId} for row ${row.rowNumber}`)
      } else {
        console.warn(`[batch-import] ⚠️  Failed to create carton for row ${row.rowNumber}: ${cartonResult.error}`)
        // Don't fail the whole batch - just log warning
      }
    }

    // Step 4: Update each row with its label information
    console.log(`[batch-import] 💾 Step 4: Updating database with label information...`)
    console.log(`[batch-import]    - Labels count: ${labelsResult.labels.length}`)
    console.log(`[batch-import]    - Label row IDs: ${labelsResult.labels.map(l => l.rowId).join(', ')}`)
    console.log(`[batch-import]    - Group row IDs: ${group.rows.map(r => r.id).join(', ')}`)

    for (const label of labelsResult.labels) {
      try {
        const matchingRow = group.rows.find(r => r.id === label.rowId)
        if (!matchingRow) {
          console.error(`[batch-import] ⚠️  Label rowId ${label.rowId} not found in group rows!`)
          failCount++
          continue
        }

        console.log(`[batch-import]    - Updating row ${matchingRow.rowNumber} (ID: ${label.rowId}): ${label.trackingNumber}`)

        const cartonIdStr = cartonIds.get(label.rowId)
        const paceCartonId = cartonIdStr ? parseInt(cartonIdStr) : null
        const paceShipmentId = paceResult.shipmentId ? parseInt(paceResult.shipmentId) : null

        await db.batchImportRow.update({
          where: { id: label.rowId },
          data: {
            status: 'SUCCESS',
            trackingNumber: label.trackingNumber,
            labelUrl: label.labelUrl,
            shippingCost: label.cost,
            shipstationLabelId: label.labelId,
            shipstationShipmentId: label.shipmentId,
            paceJobShipmentId: paceShipmentId,
            paceCartonId: paceCartonId,
            processedAt: new Date(),
          },
        })
        successCount++
      } catch (error) {
        console.error(`[batch-import] ❌ Error updating row ${label.rowId}:`, error)
        console.error(`[batch-import] ❌ Error details:`, JSON.stringify(error, null, 2))
        try {
          // Use updateMany to avoid errors if row doesn't exist
          await db.batchImportRow.updateMany({
            where: { id: label.rowId },
            data: {
              status: 'FAILED',
              errorMessage: error instanceof Error ? error.message : 'Failed to update row',
              processedAt: new Date(),
            },
          })
        } catch (updateError) {
          console.error(`[batch-import] ❌ Failed to mark row as failed:`, updateError)
        }
        failCount++
      }
    }

    console.log(`[batch-import] ✅ Group processing complete - Success: ${successCount}, Failed: ${failCount}`)
    console.log(`[batch-import] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  } catch (error) {
    console.error(`Error processing group ${group.groupKey}:`, error)
    // Mark all rows as failed
    await db.batchImportRow.updateMany({
      where: {
        id: { in: group.rows.map(r => r.id) },
      },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error processing group',
        processedAt: new Date(),
      },
    })
    failCount = group.rows.length
  }

  return { successCount, failCount }
}

/**
 * Group rows by jobNumber + shipDate + destination (multi-package shipments)
 * Only group packages going to the SAME address
 */
function groupRowsByShipment(rows: BatchRow[]): GroupedShipment[] {
  const groups = new Map<string, GroupedShipment>()

  for (const row of rows) {
    // Create group key from jobNumber + shipDate + destination address
    // This ensures only packages going to the SAME address are grouped together
    const dateKey = row.shipDate ? row.shipDate.toISOString().split('T')[0] : 'no-date'
    const addressKey = `${row.shipToAddress1}-${row.shipToCity}-${row.shipToState}-${row.shipToZip}`.toLowerCase()
    const groupKey = `${row.jobNumber}-${dateKey}-${addressKey}`

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        groupKey,
        jobNumber: row.jobNumber,
        shipDate: row.shipDate,
        rows: [],
      })
    }

    groups.get(groupKey)!.rows.push(row)
  }

  return Array.from(groups.values())
}

export function batchImportWorker(connection: Redis) {
  const worker = new Worker<BatchImportJobData>(
    'batch-import',
    async (job: Job<BatchImportJobData>) => {
      console.log(`[batch-import] Processing batch ${job.data.batchId}`)

      try {
        // Fetch batch details
        const batch = await db.batchImport.findUnique({
          where: { id: job.data.batchId },
          include: {
            rows: {
              where: { status: 'PENDING' },
              orderBy: { rowNumber: 'asc' },
            },
          },
        })

        if (!batch) {
          throw new Error(`Batch ${job.data.batchId} not found`)
        }

        console.log(`[batch-import] Found ${batch.rows.length} pending rows to process`)

        // Update batch status to PROCESSING
        await db.batchImport.update({
          where: { id: job.data.batchId },
          data: {
            status: 'PROCESSING',
            startedAt: new Date(),
          },
        })

        // Group rows by shipment (jobNumber + shipDate)
        const shipmentGroups = groupRowsByShipment(batch.rows as any[])
        console.log(`[batch-import] Grouped into ${shipmentGroups.length} shipments`)

        let totalSuccess = 0
        let totalFailed = 0

        // Process each shipment group
        for (const group of shipmentGroups) {
          const result = await processShipmentGroup(job.data.tenantId, batch, group)
          totalSuccess += result.successCount
          totalFailed += result.failCount

          // Update batch progress
          await db.batchImport.update({
            where: { id: job.data.batchId },
            data: {
              processedRows: totalSuccess + totalFailed,
              successfulRows: totalSuccess,
              failedRows: totalFailed,
            },
          })

          // Update job progress
          const progress = Math.round(((totalSuccess + totalFailed) / batch.rows.length) * 100)
          await job.updateProgress(progress)
        }

        // Update batch final status to COMPLETE (all rows processed)
        await db.batchImport.update({
          where: { id: job.data.batchId },
          data: {
            status: 'COMPLETE',
            completedAt: new Date(),
          },
        })

        console.log(`[batch-import] Batch ${job.data.batchId} completed: ${totalSuccess} success, ${totalFailed} failed`)

        return {
          success: true,
          totalRows: batch.rows.length,
          successfulRows: totalSuccess,
          failedRows: totalFailed,
        }
      } catch (error) {
        console.error(`[batch-import] Error processing batch ${job.data.batchId}:`, error)

        // Update batch status to COMPLETE (even if failed - rows will show failure details)
        await db.batchImport.update({
          where: { id: job.data.batchId },
          data: {
            status: 'COMPLETE',
            completedAt: new Date(),
          },
        })

        throw error
      }
    },
    {
      connection,
      concurrency: 3, // Process up to 3 batches concurrently
      limiter: {
        max: 10, // Max 10 jobs
        duration: 1000, // Per second
      },
    }
  )

  worker.on('completed', (job) => {
    console.log(`[batch-import] ✅ Job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[batch-import] ❌ Job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('[batch-import] Worker error:', err)
  })

  return worker
}

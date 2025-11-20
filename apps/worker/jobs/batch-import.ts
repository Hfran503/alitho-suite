import { Worker, Job } from 'bullmq'
import type { Redis } from 'ioredis'
import { db } from '@repo/database'
import { getPaceApiCredentials, getShipStationClient } from '@repo/shared'

/**
 * Determine if an error is transient (retryable) or permanent
 */
function isTransientError(error: Error | string): boolean {
  const errorMessage = typeof error === 'string' ? error : error.message

  const transientPatterns = [
    // Network/timeout errors
    /timeout/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /ENOTFOUND/i,
    /ENETUNREACH/i,
    /socket hang up/i,

    // HTTP status codes
    /503/,  // Service Unavailable
    /502/,  // Bad Gateway
    /504/,  // Gateway Timeout
    /429/,  // Too Many Requests (rate limit)
    /408/,  // Request Timeout

    // Rate limiting
    /rate limit/i,
    /too many requests/i,

    // Temporary API issues
    /temporarily unavailable/i,
    /service unavailable/i,
    /try again/i,
  ]

  return transientPatterns.some(pattern => pattern.test(errorMessage))
}

/**
 * Determine if an error is due to service availability (requires manual service change)
 */
function isServiceAvailabilityError(error: Error | string): boolean {
  const errorMessage = typeof error === 'string' ? error : error.message

  const serviceErrorPatterns = [
    /service.*not available/i,
    /invalid service code/i,
    /carrier does not ship/i,
    /service.*not supported/i,
    /does not support.*destination/i,
    /shipping service.*unavailable/i,
    /not available for.*destination/i,
  ]

  return serviceErrorPatterns.some(pattern => pattern.test(errorMessage))
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(retryCount: number): number {
  // Start with 2 seconds, exponential growth, max 60 seconds
  const baseDelay = 2000
  const maxDelay = 60000
  return Math.min(baseDelay * Math.pow(2, retryCount), maxDelay)
}

interface BatchImportJobData {
  batchId: string
  tenantId: string
}

interface BatchRow {
  id: string
  rowNumber: number
  position: string | null
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
  // Retry tracking
  retryCount: number
  maxRetries: number
  lastAttemptAt: Date | null
  isTransientError: boolean
}

interface GroupedShipment {
  groupKey: string
  jobNumber: string
  shipDate: Date | null
  rows: BatchRow[]
}

/**
 * Look up PACE Ship Via ID from carrier service mapping
 */
async function getPaceShipViaId(
  tenantId: string,
  carrierId: string | null,
  serviceCode: string | null
): Promise<number | null> {
  if (!carrierId || !serviceCode) {
    console.log(`[PACE] ⚠️  No carrier/service info provided, skipping shipVia lookup`)
    return null
  }

  try {
    const mapping = await db.carrierServiceMapping.findFirst({
      where: {
        tenantId,
        shipstationCarrierId: carrierId,
        shipstationServiceCode: serviceCode,
      },
    })

    if (mapping) {
      console.log(`[PACE] ✅ Found shipVia mapping: ${mapping.carrierName} ${mapping.serviceName} → PACE ShipVia ID ${mapping.paceShipViaId}`)
      return mapping.paceShipViaId
    } else {
      console.log(`[PACE] ⚠️  No shipVia mapping found for carrier ${carrierId} / service ${serviceCode}`)
      return null
    }
  } catch (error) {
    console.error(`[PACE] ❌ Error looking up shipVia mapping:`, error)
    return null
  }
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
    shipViaId?: number | null
    billToParty?: string | null
  }
): Promise<{ success: boolean; shipmentId?: string; error?: string }> {
  try {
    console.log(`[PACE] 🚀 Creating JobShipment for job: ${jobNumber}`)

    const credentials = await getPaceApiCredentials()
    console.log(`[PACE] ✓ Got credentials - URL: ${credentials.url}`)

    // Parse contact name from shipToName field (format: "First Last")
    const contactName = shipmentDetails.shipToName || ''
    const nameParts = contactName.trim().split(/\s+/)
    const contactFirstName = nameParts.length > 0 ? nameParts[0] : ''
    const contactLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''

    console.log(`[PACE] 👤 Contact: ${contactFirstName} ${contactLastName}`)
    console.log(`[PACE] 🏢 Company: ${shipmentDetails.shipToCompany || 'N/A'}`)

    const shipmentData: any = {
      job: jobNumber,
      // Contact person name (from shipToName)
      contactFirstName: contactFirstName || undefined,
      contactLastName: contactLastName || undefined,
      // Company name (from shipToCompany)
      name: shipmentDetails.shipToCompany || undefined,
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
      // PACE Shipment Type ID (default: 202)
      shipmentType: 202,
      // PACE Ship Via ID (from carrier service mapping)
      shipVia: shipmentDetails.shipViaId || undefined,
      // Mark as shipped since we have labels and tracking
      shipped: true,
    }

    // Set charges field for third-party billing
    // Note: The exact value must match PACE's enum list
    if (shipmentDetails.billToParty === 'third_party') {
      shipmentData.charges = 'Third Party/Ship Bill To'
      console.log(`[PACE] 💳 Setting charges to 'Third Party/Ship Bill To' for third-party billing`)
    }

    console.log(`[PACE] 📋 Shipment Type ID: ${shipmentData.shipmentType}`)
    if (shipmentData.shipVia) {
      console.log(`[PACE] 🚚 Ship Via ID: ${shipmentData.shipVia}`)
    }

    // Add ship date if provided - PACE expects full ISO 8601 date-time format
    console.log(`[PACE] 🔍 Raw shipDate received:`, shipDate, typeof shipDate)
    if (shipDate) {
      // Ensure we have a valid Date object
      const validDate = shipDate instanceof Date ? shipDate : new Date(shipDate)
      console.log(`[PACE] 🔍 Valid date object:`, validDate, validDate.getTime())
      // Format: "2024-10-20T14:30:00.000Z" (full ISO 8601 with timezone)
      shipmentData.dateTime = validDate.toISOString()
      console.log(`[PACE] 📅 Ship date formatted: ${shipmentData.dateTime}`)
    } else {
      // Use current date if no ship date provided
      const now = new Date()
      shipmentData.dateTime = now.toISOString()
      console.log(`[PACE] 📅 Ship date (default - no date provided): ${shipmentData.dateTime}`)
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

    // Log the dateTime from PACE response to see what it stored
    if (result.dateTime) {
      console.log(`[PACE] 🔍 PACE returned dateTime: ${result.dateTime}`)
    }

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
 * Create PACE Carton Content with retry logic
 */
async function createPaceCartonContentWithRetry(
  cartonId: string,
  jobProductId: string,
  quantity: number,
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string; attempts: number }> {
  let lastError = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[PACE] 🔄 Attempt ${attempt}/${maxRetries} to add content to Carton ${cartonId}`)

    const result = await createPaceCartonContent(cartonId, jobProductId, quantity)

    if (result.success) {
      if (attempt > 1) {
        console.log(`[PACE] ✅ Successfully added content after ${attempt} attempts`)
      }
      return { success: true, attempts: attempt }
    }

    lastError = result.error || 'Unknown error'

    // If it's the last attempt, don't wait
    if (attempt < maxRetries) {
      // Exponential backoff: 1s, 2s, 4s
      const waitTime = Math.pow(2, attempt - 1) * 1000
      console.log(`[PACE] ⏳ Waiting ${waitTime}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  console.error(`[PACE] ❌ Failed to add content after ${maxRetries} attempts: ${lastError}`)
  return {
    success: false,
    error: lastError,
    attempts: maxRetries,
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
    cost?: number | null
  }
): Promise<{
  success: boolean;
  cartonId?: string;
  error?: string;
  contentAdded?: boolean;
  contentWarning?: string;
  retryAttempts?: number;
}> {
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

    // Add cost if provided
    if (cartonData.cost != null && cartonData.cost > 0) {
      cartonPayload.cost = cartonData.cost
      console.log(`[PACE] 💰 Adding cost to carton: $${cartonData.cost}`)
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
    let contentAdded = false
    let contentWarning: string | undefined
    let retryAttempts = 0

    if (cartonId && cartonData.jobProductId && cartonData.itemQuantity) {
      const contentResult = await createPaceCartonContentWithRetry(
        cartonId.toString(),
        cartonData.jobProductId,
        cartonData.itemQuantity,
        3 // Max 3 retry attempts
      )

      retryAttempts = contentResult.attempts

      if (!contentResult.success) {
        contentWarning = `Failed to add product after ${contentResult.attempts} attempts: ${contentResult.error}`
        console.warn(`[PACE] ⚠️  ${contentWarning}`)
      } else {
        contentAdded = true
        if (contentResult.attempts > 1) {
          console.log(`[PACE] ✅ Product added successfully after ${contentResult.attempts} attempts`)
        }
      }
    } else if (cartonId && !cartonData.jobProductId) {
      contentWarning = 'No itemNumber provided - carton created without product'
      console.warn(`[PACE] ⚠️  ${contentWarning}`)
    }

    return {
      success: true,
      cartonId: cartonId?.toString(),
      contentAdded,
      contentWarning,
      retryAttempts,
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
  addressCorrectionNotes?: string[]
}> {
  // Track address corrections for notes
  const addressCorrectionNotes: string[] = []

  try {
    const shipStationClient = await getShipStationClient(tenantId)

    // Use the first row for ship_to address (all rows in group have same destination)
    const firstRow = rows[0]

    // Step 0: Validate the ship-to address BEFORE creating labels
    console.log('[batch-import] 🔍 Step 0: Validating ship-to address...')

    // Helper to normalize zip code to first 5 digits
    const normalizeZip = (zip: string): string => {
      return zip.replace(/[^0-9]/g, '').substring(0, 5)
    }

    // Normalize zip code for validation
    const normalizedZip = normalizeZip(firstRow.shipToZip)

    // Store original address for comparison
    const originalAddress = {
      address1: firstRow.shipToAddress1,
      city: firstRow.shipToCity,
      state: firstRow.shipToState,
      zip: normalizedZip,
    }

    try {
      const validationResult = await shipStationClient.validateAddress({
        name: firstRow.shipToName,
        company_name: firstRow.shipToCompany || undefined,
        address_line1: firstRow.shipToAddress1,
        address_line2: firstRow.shipToAddress2 || undefined,
        city_locality: firstRow.shipToCity,
        state_province: firstRow.shipToState,
        postal_code: normalizedZip,
        country_code: firstRow.shipToCountry || 'US',
        phone: firstRow.shipToPhone || undefined,
      })

      console.log('[batch-import] ✅ Address validation result:', JSON.stringify(validationResult, null, 2))

      // If ShipStation provided a corrected/matched address, use it
      if (validationResult.matched_address) {
        const matched = validationResult.matched_address
        console.log('[batch-import] 📝 ShipStation matched address:')
        console.log(`[batch-import]    Original: ${firstRow.shipToAddress1}, ${firstRow.shipToCity}, ${firstRow.shipToState} ${normalizedZip}`)
        console.log(`[batch-import]    Matched: ${matched.address_line1}, ${matched.city_locality}, ${matched.state_province} ${normalizeZip(matched.postal_code)}`)

        // STRATEGY: Trust customer's address lines (address1, address2), but always apply
        // USPS corrections for City, State, and ZIP since USPS database is authoritative.
        // This avoids false positives from abbreviations (Drive→DR) or suite number formatting.
        // We keep the original address lines as-is and only correct City/State/ZIP.

        // Track meaningful corrections (City, State, ZIP)
        const correctedZip = normalizeZip(matched.postal_code)
        const hasCriticalCorrections = correctedZip !== originalAddress.zip
        const hasMinorCorrections =
          matched.city_locality.toUpperCase() !== originalAddress.city.toUpperCase() ||
          matched.state_province !== originalAddress.state

        if (hasCriticalCorrections) {
          // Critical correction (ZIP code changed)
          if (correctedZip !== originalAddress.zip) {
            addressCorrectionNotes.push(`⚠️ ZIP corrected: ${originalAddress.zip} → ${correctedZip}`)
          }
          if (matched.city_locality.toUpperCase() !== originalAddress.city.toUpperCase()) {
            addressCorrectionNotes.push(`City: ${originalAddress.city} → ${matched.city_locality}`)
          }
          if (matched.state_province !== originalAddress.state) {
            addressCorrectionNotes.push(`State: ${originalAddress.state} → ${matched.state_province}`)
          }
        } else if (hasMinorCorrections) {
          // Minor corrections (just city/state formatting)
          addressCorrectionNotes.push(`✓ Address verified and standardized by USPS`)
        }

        // Update ONLY City, State, and ZIP (NOT address lines)
        firstRow.shipToCity = matched.city_locality
        firstRow.shipToState = matched.state_province
        firstRow.shipToZip = correctedZip

        console.log(`[batch-import] ✅ Address corrections applied: City=${matched.city_locality}, State=${matched.state_province}, ZIP=${correctedZip}`)
      } else if (validationResult.status === 'unverified' || validationResult.status === 'error') {
        const errorMsg = validationResult.messages?.map(m => m.message).join(', ') || 'Address could not be verified'
        console.warn(`[batch-import] ⚠️  Address validation warning: ${errorMsg}`)
        console.warn('[batch-import] ⚠️  No matched address provided - continuing with original address')
        // Normalize the zip code even if validation failed
        firstRow.shipToZip = normalizedZip
      } else {
        console.log('[batch-import] ✅ Address verified successfully')
        // Normalize zip code
        firstRow.shipToZip = normalizedZip
      }
    } catch (validationError: any) {
      console.warn(`[batch-import] ⚠️  Address validation failed: ${validationError.message}`)
      console.warn('[batch-import] Continuing with original address (normalized zip)')
      // Normalize zip code even if validation fails
      firstRow.shipToZip = normalizedZip
    }

    // Check if this is a UPS shipment (UPS doesn't support reference3)
    const isUPS = batch.serviceCode?.toLowerCase().includes('ups') || false

    // Build packages array from rows
    const packages = rows.map((row) => {
      const labelMessages: Record<string, string | undefined> = {
        reference1: row.reference1 || undefined,
        reference2: row.reference2 || undefined,
      }

      // UPS doesn't support reference3
      if (!isUPS && row.reference3) {
        labelMessages.reference3 = row.reference3
      }

      const packageData: any = {
        weight: {
          value: row.weight,
          unit: 'pound' as const,
        },
        label_messages: labelMessages,
      }

      // Use carrier package code if configured, otherwise use custom dimensions
      if (batch.useCarrierPackage && batch.carrierPackageCode) {
        packageData.package_code = batch.carrierPackageCode
        console.log(`[batch-import] 📦 Using carrier package: ${batch.carrierPackageName || batch.carrierPackageCode}`)
      } else if (row.length && row.width && row.height) {
        packageData.dimensions = {
          length: row.length,
          width: row.width,
          height: row.height,
          unit: 'inch' as const,
        }
        console.log(`[batch-import] 📦 Using custom dimensions: ${row.length}x${row.width}x${row.height}`)
      }

      return packageData
    })

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

    // Build advanced options from batch configuration
    const advancedOptions: any = {}

    // Third-party billing
    if (batch.billToParty && batch.billToParty !== 'sender') {
      advancedOptions.bill_to_party = batch.billToParty
      console.log(`[batch-import] 📋 Adding bill_to_party: ${batch.billToParty}`)
    }

    if (batch.billToAccount) {
      advancedOptions.bill_to_account = batch.billToAccount
      console.log(`[batch-import] 📋 Adding bill_to_account: ${batch.billToAccount}`)
    }

    if (batch.billToCountryCode && batch.billToParty === 'third_party') {
      advancedOptions.bill_to_country_code = batch.billToCountryCode
      console.log(`[batch-import] 📋 Adding bill_to_country_code: ${batch.billToCountryCode}`)
    }

    if (batch.billToPostalCode && batch.billToParty === 'third_party') {
      advancedOptions.bill_to_postal_code = batch.billToPostalCode
      console.log(`[batch-import] 📋 Adding bill_to_postal_code: ${batch.billToPostalCode}`)
    }

    // Package options
    if (batch.containsAlcohol) {
      advancedOptions.contains_alcohol = true
      console.log(`[batch-import] 📋 Adding contains_alcohol: true`)
    }

    if (batch.saturdayDelivery) {
      advancedOptions.saturday_delivery = true
      console.log(`[batch-import] 📋 Adding saturday_delivery: true`)
    }

    // Delivery confirmation
    if (batch.confirmation && batch.confirmation !== 'none') {
      advancedOptions.confirmation = batch.confirmation
      console.log(`[batch-import] 📋 Adding confirmation: ${batch.confirmation}`)
    }

    // Notification email
    if (batch.notificationsEmail) {
      advancedOptions.NotificationsEmail = batch.notificationsEmail
      console.log(`[batch-import] 📋 Adding NotificationsEmail: ${batch.notificationsEmail}`)
    }

    const labelRequest: any = {
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

    // Add advanced options if any were configured
    if (Object.keys(advancedOptions).length > 0) {
      labelRequest.shipment.advanced_options = advancedOptions
      console.log(`[batch-import] 📋 Advanced options configured:`, JSON.stringify(advancedOptions, null, 2))
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

    // Get processing cost from carrier configuration
    // Note: Only apply processing cost if sender (you) pays for shipping, not third party
    let processingCostPerCarton = 0
    const isThirdPartyBilling = batch.billToParty === 'third_party'

    if (!isThirdPartyBilling) {
      try {
        const integration = await db.integration.findUnique({
          where: {
            tenantId_provider: {
              tenantId: tenantId,
              provider: 'shipstation',
            },
          },
          select: {
            config: true,
          },
        })

        if (integration?.config) {
          const carriers = (integration.config as any)?.carriers || []
          const carrier = carriers.find((c: any) => c.id === batch.carrierId)
          if (carrier?.estimateRateMarkupDollar) {
            processingCostPerCarton = carrier.estimateRateMarkupDollar
            console.log(`[batch-import] 💵 Processing cost configured: $${processingCostPerCarton.toFixed(2)} per carton`)
          }
        }
      } catch (error) {
        console.error('[batch-import] Error loading processing cost configuration:', error)
      }
    } else {
      console.log(`[batch-import] 💳 Third party billing - skipping processing cost markup`)
    }

    // Parse the response and map labels to rows
    const labels = labelResponse.label_download?.pdf ? (() => {
      const totalCost = labelResponse.shipment_cost?.amount || 0
      const packageCount = labelResponse.packages?.length || 1

      // Calculate total weight across all packages
      const totalWeight = rows.reduce((sum, row) => sum + (row.weight || 0), 0)

      return labelResponse.packages?.map((pkg: any, index: number) => {
        // Use individual package cost if available from ShipStation
        const packageCost = pkg.insured_value?.amount || pkg.package_cost?.amount

        let costPerPackage: number
        if (packageCost) {
          // ShipStation provided individual package cost
          costPerPackage = packageCost
        } else if (totalWeight > 0) {
          // Prorate cost based on package weight
          const packageWeight = rows[index]?.weight || 0
          costPerPackage = (packageWeight / totalWeight) * totalCost
        } else {
          // Equal split if no weight info
          costPerPackage = totalCost / packageCount
        }

        // Add processing cost per carton
        if (processingCostPerCarton > 0) {
          costPerPackage += processingCostPerCarton
        }

        console.log(`[batch-import] 💰 Package ${index + 1}:`, {
          weight: rows[index]?.weight || 0,
          totalWeight,
          carrierCost: `$${(costPerPackage - processingCostPerCarton).toFixed(2)}`,
          processingCost: processingCostPerCarton > 0 ? `$${processingCostPerCarton.toFixed(2)}` : '$0.00',
          totalCost: `$${costPerPackage.toFixed(2)}`,
          totalShipmentCost: `$${totalCost}`,
          method: packageCost ? 'individual' : totalWeight > 0 ? 'weight-based' : 'equal-split',
        })

        return {
          rowId: rows[index].id,
          labelId: pkg.label_id || labelResponse.label_id,
          shipmentId: labelResponse.shipment_id,
          trackingNumber: pkg.tracking_number || labelResponse.tracking_number,
          labelUrl: labelResponse.label_download.pdf,
          cost: costPerPackage,
        }
      })
    })() : []

    return {
      success: true,
      labels,
      addressCorrectionNotes,
    }
  } catch (error) {
    console.error('Error creating shipping labels:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating labels',
      addressCorrectionNotes,
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

    // Check if any rows are retries and apply backoff
    const maxRetryCount = Math.max(...group.rows.map(r => r.retryCount || 0))
    if (maxRetryCount > 0) {
      const backoffDelay = calculateBackoffDelay(maxRetryCount)
      console.log(`[batch-import] ⏳ Retry attempt ${maxRetryCount + 1}, applying backoff: ${backoffDelay}ms`)
      await new Promise(resolve => setTimeout(resolve, backoffDelay))
    }

    // Update all rows in group to PROCESSING
    console.log(`[batch-import] 🔄 Updating ${group.rows.length} rows to PROCESSING status...`)

    // Update each row individually to increment retry count
    for (const row of group.rows) {
      await db.batchImportRow.update({
        where: { id: row.id },
        data: {
          status: 'PROCESSING',
          groupKey: group.groupKey,
          retryCount: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      })
    }

    // Step 1: Create shipping labels via ShipStation FIRST
    console.log(`[batch-import] 🏷️  Step 1: Creating shipping labels via ShipStation...`)
    const labelsResult = await createShippingLabels(tenantId, batch, group.rows)

    if (!labelsResult.success || !labelsResult.labels || labelsResult.labels.length === 0) {
      const errorMsg = labelsResult.error || 'No labels returned from ShipStation'
      console.error(`[batch-import] ❌ Label creation failed: ${errorMsg}`)

      // Determine error type
      const isServiceError = isServiceAvailabilityError(errorMsg)
      const isRetryable = !isServiceError && isTransientError(errorMsg)

      if (isServiceError) {
        console.log(`[batch-import] 🔍 Error type: SERVICE AVAILABILITY (manual service change required)`)
      } else {
        console.log(`[batch-import] 🔍 Error type: ${isRetryable ? 'TRANSIENT (will retry)' : 'PERMANENT (no retry)'}`)
      }

      // Mark all rows as failed
      for (const row of group.rows) {
        await db.batchImportRow.update({
          where: { id: row.id },
          data: {
            status: 'FAILED',
            groupKey: group.groupKey,
            errorMessage: isServiceError
              ? `${errorMsg} - Change service and retry manually`
              : errorMsg,
            isTransientError: isRetryable,
            processedAt: new Date(),
          },
        })
      }
      return { successCount: 0, failCount: group.rows.length }
    }

    console.log(`[batch-import] ✅ Created ${labelsResult.labels.length} shipping labels successfully`)
    console.log(`[batch-import] 📋 Labels:`, labelsResult.labels.map(l => ({
      rowNumber: group.rows.find(r => r.id === l.rowId)?.rowNumber,
      tracking: l.trackingNumber,
      labelId: l.labelId,
      cost: l.cost,
    })))

    // Extract address correction notes from label result
    const addressCorrectionNotes = labelsResult.addressCorrectionNotes || []

    // Calculate total shipping cost
    const totalShippingCost = labelsResult.labels.reduce((sum, label) => sum + label.cost, 0)
    console.log(`[batch-import] 💰 Total shipping cost: $${totalShippingCost.toFixed(2)}`)

    // Look up PACE Ship Via ID from carrier service mapping
    const shipViaId = await getPaceShipViaId(tenantId, batch.carrierId, batch.serviceCode)

    // Step 2: Create PACE JobShipment with ALL information (address, tracking, cost, shipVia)
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
      shipViaId: shipViaId,
      billToParty: batch.billToParty,
    })

    if (!paceResult.success) {
      const errorMsg = `Labels created but PACE failed: ${paceResult.error}`
      console.error(`[batch-import] ❌ PACE creation failed: ${paceResult.error}`)

      // Determine if error is transient (retryable) or permanent
      const isRetryable = isTransientError(paceResult.error || '')
      console.log(`[batch-import] 🔍 Error type: ${isRetryable ? 'TRANSIENT (will retry)' : 'PERMANENT (no retry)'}`)

      // Mark all rows as failed (labels already created, but no PACE shipment)
      for (const row of group.rows) {
        await db.batchImportRow.update({
          where: { id: row.id },
          data: {
            status: 'FAILED',
            groupKey: group.groupKey,
            errorMessage: errorMsg,
            isTransientError: isRetryable,
            processedAt: new Date(),
          },
        })
      }
      return { successCount: 0, failCount: group.rows.length }
    }

    console.log(`[batch-import] ✅ PACE JobShipment created successfully - ID: ${paceResult.shipmentId}`)

    // Step 3: Create PACE Cartons for each label
    console.log(`[batch-import] 📦 Step 3: Creating PACE Cartons...`)
    const cartonIds = new Map<string, string>() // Map rowId to cartonId
    const cartonResults = new Map<string, { cartonId?: string; contentAdded?: boolean; contentWarning?: string; retryAttempts?: number }>() // Store full results

    for (const label of labelsResult.labels) {
      if (!paceResult.shipmentId) continue

      const row = group.rows.find(r => r.id === label.rowId)
      if (!row) continue

      console.log(`[batch-import] 📦 Creating carton for row ${row.rowNumber} with cost: $${label.cost}`)

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
        cost: label.cost, // Add shipping cost from label
      })

      if (cartonResult.success && cartonResult.cartonId) {
        cartonIds.set(label.rowId, cartonResult.cartonId)
        cartonResults.set(label.rowId, {
          cartonId: cartonResult.cartonId,
          contentAdded: cartonResult.contentAdded,
          contentWarning: cartonResult.contentWarning,
          retryAttempts: cartonResult.retryAttempts,
        })
        console.log(`[batch-import]    - Created carton ${cartonResult.cartonId} for row ${row.rowNumber}`)

        // Log content status
        if (cartonResult.contentAdded) {
          if (cartonResult.retryAttempts && cartonResult.retryAttempts > 1) {
            console.log(`[batch-import]    - ✅ Product added after ${cartonResult.retryAttempts} attempts`)
          }
        } else if (cartonResult.contentWarning) {
          console.warn(`[batch-import]    - ⚠️  ${cartonResult.contentWarning}`)
        }
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

        // Build notes field with address corrections and content warnings
        const notesParts: string[] = []
        if (addressCorrectionNotes.length > 0) {
          notesParts.push(...addressCorrectionNotes)
        }

        // Add content warning if product was not added to carton
        const cartonResult = cartonResults.get(label.rowId)
        if (cartonResult?.contentWarning) {
          notesParts.push(`⚠️ ${cartonResult.contentWarning}`)
        } else if (cartonResult?.contentAdded && cartonResult?.retryAttempts && cartonResult.retryAttempts > 1) {
          notesParts.push(`✅ Product added after ${cartonResult.retryAttempts} retry attempts`)
        }

        const notes = notesParts.length > 0 ? notesParts.join('; ') : null

        await db.batchImportRow.update({
          where: { id: label.rowId },
          data: {
            status: 'SUCCESS',
            groupKey: group.groupKey, // Save groupKey for multi-package void operations
            trackingNumber: label.trackingNumber,
            labelUrl: label.labelUrl,
            shippingCost: label.cost,
            shipstationLabelId: label.labelId,
            shipstationShipmentId: label.shipmentId,
            paceJobShipmentId: paceShipmentId,
            paceCartonId: paceCartonId,
            notes: notes,
            processedAt: new Date(),
          },
        })

        // Also create ShippingLabel record for shipment tracking page
        try {
          await db.shippingLabel.create({
            data: {
              tenantId,
              paceShipmentId: paceShipmentId!,
              paceCartonId: paceCartonId,
              provider: 'shipstation',
              providerShipmentId: label.shipmentId,
              providerLabelId: label.labelId,
              trackingNumber: label.trackingNumber,
              labelUrl: label.labelUrl,
              carrier: batch.carrierId,
              service: batch.serviceCode,
              shipFrom: batch.fromAddress,
              shipTo: {
                name: matchingRow.shipToName,
                company_name: matchingRow.shipToCompany,
                address_line1: matchingRow.shipToAddress1,
                address_line2: matchingRow.shipToAddress2,
                city_locality: matchingRow.shipToCity,
                state_province: matchingRow.shipToState,
                postal_code: matchingRow.shipToZip,
                country_code: matchingRow.shipToCountry || 'US',
                phone: matchingRow.shipToPhone,
              },
              weight: matchingRow.weight,
              length: matchingRow.length,
              width: matchingRow.width,
              height: matchingRow.height,
              cost: label.cost,
              currency: 'USD',
              status: 'active',
              isReturnLabel: false,
              metadata: {
                batchImportId: batch.id,
                batchImportRowId: label.rowId,
                jobNumber: matchingRow.jobNumber,
                packageNumber: matchingRow.packageNumber,
                totalPackages: matchingRow.totalPackages,
                reference1: matchingRow.reference1,
                reference2: matchingRow.reference2,
                reference3: matchingRow.reference3,
              },
            },
          })
          console.log(`[batch-import]    - Created ShippingLabel record for tracking`)
        } catch (labelError) {
          console.warn(`[batch-import] ⚠️  Failed to create ShippingLabel record:`, labelError)
          // Don't fail the import if ShippingLabel creation fails
        }

        successCount++
      } catch (error) {
        console.error(`[batch-import] ❌ Error updating row ${label.rowId}:`, error)
        console.error(`[batch-import] ❌ Error details:`, JSON.stringify(error, null, 2))

        const errorMsg = error instanceof Error ? error.message : 'Failed to update row'
        const isRetryable = isTransientError(errorMsg)

        try {
          // Use update to set retry fields
          await db.batchImportRow.update({
            where: { id: label.rowId },
            data: {
              status: 'FAILED',
              groupKey: group.groupKey,
              errorMessage: errorMsg,
              isTransientError: isRetryable,
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

    const errorMsg = error instanceof Error ? error.message : 'Unknown error processing group'
    const isRetryable = isTransientError(errorMsg)
    console.log(`[batch-import] 🔍 Error type: ${isRetryable ? 'TRANSIENT (will retry)' : 'PERMANENT (no retry)'}`)

    // Mark all rows as failed
    for (const row of group.rows) {
      await db.batchImportRow.update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          groupKey: group.groupKey,
          errorMessage: errorMsg,
          isTransientError: isRetryable,
          processedAt: new Date(),
        },
      })
    }
    failCount = group.rows.length
  }

  return { successCount, failCount }
}

/**
 * Group rows by position + jobNumber + shipDate + destination (multi-package shipments)
 * If position is provided, it controls grouping (different positions = different shipments)
 * Otherwise, group by jobNumber + shipDate + destination address
 */
function groupRowsByShipment(rows: BatchRow[]): GroupedShipment[] {
  const groups = new Map<string, GroupedShipment>()

  for (const row of rows) {
    // Create group key:
    // - If position is provided, use it as primary grouping key (user controls grouping)
    // - Otherwise, group by jobNumber + shipDate + destination
    const dateKey = row.shipDate ? row.shipDate.toISOString().split('T')[0] : 'no-date'
    const addressKey = `${row.shipToAddress1}-${row.shipToCity}-${row.shipToState}-${row.shipToZip}`.toLowerCase()

    const groupKey = row.position
      ? `pos-${row.position}-${row.jobNumber}-${dateKey}-${addressKey}`
      : `${row.jobNumber}-${dateKey}-${addressKey}`

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
              where: {
                OR: [
                  { status: 'PENDING' },
                  {
                    // Include failed rows that can be retried
                    status: 'FAILED',
                    isTransientError: true,
                    retryCount: { lt: 3 }, // Use literal value since maxRetries field comparison doesn't work in Prisma
                  },
                ],
              },
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

        // Configuration for parallel processing
        // ShipStation limits: Production=200/min (3.33/sec), Sandbox=20/min (0.33/sec)
        // Process 5 groups in parallel (rate limiter handles individual request spacing)
        const CONCURRENCY_LIMIT = 5 // Process 5 shipment groups in parallel
        const DB_UPDATE_INTERVAL = 10 // Update database every 10 groups processed
        const CHUNK_DELAY = 1000 // Wait 1 second between chunks for safety

        // Process shipment groups in parallel with concurrency limit
        console.log(`[batch-import] 🚀 Processing ${shipmentGroups.length} groups with concurrency limit of ${CONCURRENCY_LIMIT}`)

        let processedCount = 0
        const results: Array<{ successCount: number; failCount: number }> = []

        // Process groups in batches (chunks of CONCURRENCY_LIMIT)
        for (let i = 0; i < shipmentGroups.length; i += CONCURRENCY_LIMIT) {
          const chunk = shipmentGroups.slice(i, i + CONCURRENCY_LIMIT)
          const chunkNumber = Math.floor(i / CONCURRENCY_LIMIT) + 1
          const totalChunks = Math.ceil(shipmentGroups.length / CONCURRENCY_LIMIT)

          console.log(`[batch-import] 📦 Processing batch ${chunkNumber}/${totalChunks} (${chunk.length} groups)`)

          // Process this chunk in parallel
          const chunkResults = await Promise.all(
            chunk.map(group => processShipmentGroup(job.data.tenantId, batch, group))
          )

          // Accumulate results
          results.push(...chunkResults)
          processedCount += chunk.length

          // Calculate totals
          totalSuccess = results.reduce((sum, r) => sum + r.successCount, 0)
          totalFailed = results.reduce((sum, r) => sum + r.failCount, 0)

          // Wait between chunks to avoid overwhelming the API (except for last chunk)
          if (i + CONCURRENCY_LIMIT < shipmentGroups.length) {
            console.log(`[batch-import] ⏳ Waiting ${CHUNK_DELAY}ms before next chunk...`)
            await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY))
          }

          // Batch database updates - only update every DB_UPDATE_INTERVAL groups or at the end
          if (processedCount % DB_UPDATE_INTERVAL === 0 || processedCount === shipmentGroups.length) {
            console.log(`[batch-import] 💾 Updating database progress: ${totalSuccess} success, ${totalFailed} failed`)
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
            console.log(`[batch-import] 📊 Progress: ${progress}%`)
          }
        }

        console.log(`[batch-import] ✅ All groups processed - Total Success: ${totalSuccess}, Total Failed: ${totalFailed}`)

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

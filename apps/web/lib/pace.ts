/**
 * PACE API Integration Helper
 * Provides reusable functions for interacting with PACE API
 */

import { getPaceApiCredentials } from './secrets'

interface PaceConfig {
  apiUrl: string
  username: string
  password: string
}

async function getPaceConfig(): Promise<PaceConfig> {
  try {
    const credentials = await getPaceApiCredentials()
    return {
      apiUrl: credentials.url,
      username: credentials.username,
      password: credentials.password,
    }
  } catch (error) {
    throw new Error('PACE API not configured. Please configure PACE credentials in AWS Secrets Manager.')
  }
}

function getAuthHeader(config: PaceConfig): string {
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`
}

/**
 * Fetch Job Shipments from PACE API
 * @param xpath - XPath query to filter shipments
 * @param offset - Pagination offset
 * @param limit - Number of results to return
 */
export async function fetchPaceShipments(xpath: string, offset = 0, limit = 50) {
  const config = await getPaceConfig()
  const authHeader = getAuthHeader(config)

  const queryParams = new URLSearchParams({
    type: 'JobShipment',
    xpath,
    offset: offset.toString(),
    limit: limit.toString(),
  })

  const url = `${config.apiUrl}/FindObjects/findSortAndLimit?${queryParams.toString()}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([]),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`PACE API request failed: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const shipmentIds = await response.json()
  return Array.isArray(shipmentIds) ? shipmentIds : []
}

/**
 * Fetch detailed information for a single Job Shipment
 * @param shipmentId - The primary key of the shipment
 */
export async function fetchPaceShipmentDetails(shipmentId: number) {
  const config = await getPaceConfig()
  const authHeader = getAuthHeader(config)

  const url = `${config.apiUrl}/ReadObject/readJobShipment?primaryKey=${shipmentId}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': authHeader,
    },
    body: '',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`PACE API request failed: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return await response.json()
}

/**
 * Fetch Job Shipments for a specific customer
 * Tries XPath relationship traversal first, falls back to two-query approach if needed
 *
 * @param customerId - The PACE Customer ID
 * @param includeDetails - Whether to fetch full details for each shipment
 * @param limit - Maximum number of shipments to fetch
 */
export async function fetchCustomerShipments(
  customerId: string,
  includeDetails = true,
  limit = 1000
) {
  const config = await getPaceConfig()
  const authHeader = getAuthHeader(config)

  // Try relationship traversal syntax: job/customer/@id = 'customerId'
  // Filter by date: past 30 days and future shipments
  try {
    // Calculate date 30 days ago
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 30)

    // Extract date components for PACE date() function
    const year = thirtyDaysAgo.getFullYear()
    const month = thirtyDaysAgo.getMonth() + 1
    const day = thirtyDaysAgo.getDate()

    // XPath: customer filter AND date filter AND shipmentType filter
    // shipmentType must be one of: 100, 201, 202, 205, 206 (integers, not strings)
    const shipmentTypes = [100, 201, 202, 205, 206]
    const typeConditions = shipmentTypes.map(type => `@shipmentType = ${type}`).join(' or ')
    const xpath = `job/@customer = '${customerId}' and @date >= date(${year}, ${month}, ${day}) and (${typeConditions})`

    const shipmentIds = await fetchPaceShipments(xpath, 0, limit)

    if (!includeDetails || shipmentIds.length === 0) {
      return shipmentIds
    }

    // Fetch details for each shipment
    const shipmentDetailsPromises = shipmentIds.map((id) =>
      fetchPaceShipmentDetails(id).catch((error) => {
        console.error(`Failed to fetch shipment ${id}:`, error)
        return null
      })
    )

    const shipmentDetails = await Promise.all(shipmentDetailsPromises)

    // Filter out failed requests
    const validShipments = shipmentDetails.filter((detail) => detail !== null)

    // Get unique job numbers from shipments
    const uniqueJobs = [...new Set(validShipments.map((s: any) => s.job).filter(Boolean))]

    // Fetch JobComponents for all jobs in parallel
    const jobComponentsMap = new Map<string, any[]>() // job -> components[]

    await Promise.all(
      uniqueJobs.map(async (jobId) => {
        try {
          // Fetch JobComponent IDs for this job
          const componentIdsUrl = `${config.apiUrl}/FindObjects/findSortAndLimit?${new URLSearchParams({
            type: 'JobComponent',
            xpath: `@job='${jobId}'`,
            offset: '0',
            limit: '1000',
          })}`

          const idsResponse = await fetch(componentIdsUrl, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([]),
          })

          if (!idsResponse.ok) return

          const componentIds: string[] = await idsResponse.json()

          // Fetch details for each component
          const componentDetails = await Promise.all(
            componentIds.map(async (id) => {
              try {
                const detailResponse = await fetch(
                  `${config.apiUrl}/ReadObject/readJobComponent?primaryKey=${id}`,
                  {
                    method: 'POST',
                    headers: {
                      'Accept': 'application/json',
                      'Authorization': authHeader,
                    },
                    body: '',
                  }
                )

                if (!detailResponse.ok) return null

                const data = await detailResponse.json()
                return {
                  id: data.id,
                  itemNumber: data.u_itemNumber || data.U_itemNumber,
                  description: data.description,
                  qtyOrdered: data.qtyOrdered,
                  poNum: data.U_po || data.u_po,
                }
              } catch (err) {
                console.error(`Failed to fetch component ${id}:`, err)
                return null
              }
            })
          )

          const validComponents = componentDetails.filter((c) => c !== null)
          if (validComponents.length > 0) {
            jobComponentsMap.set(jobId, validComponents)
          }
        } catch (err) {
          console.error(`Failed to fetch components for job ${jobId}:`, err)
        }
      })
    )

    // Add customer and components info to each shipment
    const enrichedShipments = validShipments.map((shipment: any) => ({
      ...shipment,
      customer: customerId,
      jobComponents: shipment.job ? jobComponentsMap.get(shipment.job) || [] : [],
    }))

    return enrichedShipments
  } catch (error) {
    // Fallback: Query Jobs first, then JobShipments
    const jobXPath = `@customer = '${customerId}'`
    const jobQueryParams = new URLSearchParams({
      type: 'Job',
      xpath: jobXPath,
      offset: '0',
      limit: '500',
    })

    const jobUrl = `${config.apiUrl}/FindObjects/findSortAndLimit?${jobQueryParams.toString()}`
    const jobResponse = await fetch(jobUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([]),
    })

    if (!jobResponse.ok) {
      const errorText = await jobResponse.text()
      throw new Error(`PACE API request failed: ${jobResponse.status} ${jobResponse.statusText} - ${errorText}`)
    }

    const customerJobIds: string[] = await jobResponse.json()

    if (customerJobIds.length === 0) {
      return []
    }

    // Query JobShipments for these jobs with date filter
    // Calculate date 30 days ago
    const todayFallback = new Date()
    const thirtyDaysAgoFallback = new Date(todayFallback)
    thirtyDaysAgoFallback.setDate(todayFallback.getDate() - 30)

    const yearFallback = thirtyDaysAgoFallback.getFullYear()
    const monthFallback = thirtyDaysAgoFallback.getMonth() + 1
    const dayFallback = thirtyDaysAgoFallback.getDate()

    const jobConditions = customerJobIds.map(jobId => `@job = '${jobId}'`).join(' or ')
    const jobFilter = customerJobIds.length === 1
      ? `@job = '${customerJobIds[0]}'`
      : `(${jobConditions})`

    // Add date filter and shipmentType filter (integers, not strings)
    const shipmentTypesFallback = [100, 201, 202, 205, 206]
    const typeConditionsFallback = shipmentTypesFallback.map(type => `@shipmentType = ${type}`).join(' or ')
    const shipmentsXPath = `${jobFilter} and @date >= date(${yearFallback}, ${monthFallback}, ${dayFallback}) and (${typeConditionsFallback})`

    const shipmentIds = await fetchPaceShipments(shipmentsXPath, 0, limit)

    if (!includeDetails || shipmentIds.length === 0) {
      return shipmentIds
    }

    // Fetch details for each shipment
    const shipmentDetailsPromises = shipmentIds.map((id) =>
      fetchPaceShipmentDetails(id).catch((error) => {
        console.error(`Failed to fetch shipment ${id}:`, error)
        return null
      })
    )

    const shipmentDetails = await Promise.all(shipmentDetailsPromises)

    // Filter out failed requests
    const validShipments = shipmentDetails.filter((detail) => detail !== null)

    // Get unique job numbers from shipments
    const uniqueJobsFallback = [...new Set(validShipments.map((s: any) => s.job).filter(Boolean))]

    // Fetch JobComponents for all jobs in parallel
    const jobComponentsMapFallback = new Map<string, any[]>()

    await Promise.all(
      uniqueJobsFallback.map(async (jobId) => {
        try {
          const componentIdsUrl = `${config.apiUrl}/FindObjects/findSortAndLimit?${new URLSearchParams({
            type: 'JobComponent',
            xpath: `@job='${jobId}'`,
            offset: '0',
            limit: '1000',
          })}`

          const idsResponse = await fetch(componentIdsUrl, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([]),
          })

          if (!idsResponse.ok) return

          const componentIds: string[] = await idsResponse.json()

          const componentDetails = await Promise.all(
            componentIds.map(async (id) => {
              try {
                const detailResponse = await fetch(
                  `${config.apiUrl}/ReadObject/readJobComponent?primaryKey=${id}`,
                  {
                    method: 'POST',
                    headers: {
                      'Accept': 'application/json',
                      'Authorization': authHeader,
                    },
                    body: '',
                  }
                )

                if (!detailResponse.ok) return null

                const data = await detailResponse.json()
                return {
                  id: data.id,
                  itemNumber: data.u_itemNumber || data.U_itemNumber,
                  description: data.description,
                  qtyOrdered: data.qtyOrdered,
                  poNum: data.U_po || data.u_po,
                }
              } catch (err) {
                console.error(`Failed to fetch component ${id}:`, err)
                return null
              }
            })
          )

          const validComponents = componentDetails.filter((c) => c !== null)
          if (validComponents.length > 0) {
            jobComponentsMapFallback.set(jobId, validComponents)
          }
        } catch (err) {
          console.error(`Failed to fetch components for job ${jobId}:`, err)
        }
      })
    )

    // Add customer and components info to each shipment
    const enrichedShipmentsFallback = validShipments.map((shipment: any) => ({
      ...shipment,
      customer: customerId,
      jobComponents: shipment.job ? jobComponentsMapFallback.get(shipment.job) || [] : [],
    }))

    return enrichedShipmentsFallback
  }
}

/**
 * Check if PACE API is configured
 */
export async function isPaceConfigured(): Promise<boolean> {
  try {
    await getPaceConfig()
    return true
  } catch (error) {
    return false
  }
}

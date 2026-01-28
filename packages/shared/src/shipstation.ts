import { getShipStationApiKey } from './secrets'
import { db } from '@repo/database'

/**
 * ShipStation (ShipEngine) API Base URLs
 */
const SHIPSTATION_BASE_URL = 'https://api.shipengine.com/v1'

/**
 * ShipStation API client configuration
 */
interface ShipStationConfig {
  apiKey: string
  baseUrl?: string
  mode?: 'test' | 'production' // Determines rate limits: test=20/min, production=200/min
}

/**
 * Simple rate limiter to prevent exceeding API limits
 */
class RateLimiter {
  private queue: Array<() => void> = []
  private processing = false
  private minInterval: number

  constructor(requestsPerSecond: number) {
    this.minInterval = 1000 / requestsPerSecond
  }

  async throttle(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve)
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true
    const resolve = this.queue.shift()

    if (resolve) {
      resolve()
      await this.delay(this.minInterval)
    }

    this.processing = false
    if (this.queue.length > 0) {
      this.processQueue()
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * ShipStation API client
 */
export class ShipStationClient {
  private apiKey: string
  private baseUrl: string
  private rateLimiter: RateLimiter
  private mode: 'test' | 'production'

  constructor(config: ShipStationConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || SHIPSTATION_BASE_URL
    this.mode = config.mode || 'production'

    // ShipEngine rate limits:
    // - Production: 200 requests per minute (3.33 req/sec)
    // - Sandbox: 20 requests per minute (0.33 req/sec)
    const requestsPerSecond = this.mode === 'production' ? 3.2 : 0.3 // Slightly conservative
    this.rateLimiter = new RateLimiter(requestsPerSecond)

    console.log(`[ShipStation] Initialized in ${this.mode} mode (${requestsPerSecond} req/sec limit)`)
  }

  /**
   * Make a request to the ShipStation API with rate limiting and retry logic
   */
  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const maxRetries = 3
    const baseDelay = 2000 // 2 seconds

    // Wait for rate limiter
    await this.rateLimiter.throttle()

    const url = `${this.baseUrl}${endpoint}`

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'API-Key': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      // Handle rate limiting (429) - use Retry-After header if provided
      if (response.status === 429) {
        if (retryCount < maxRetries) {
          // ShipStation provides a Retry-After header in seconds
          const retryAfter = response.headers.get('Retry-After')
          const delay = retryAfter
            ? parseInt(retryAfter) * 1000
            : baseDelay * Math.pow(2, retryCount) // Fallback to exponential backoff

          console.warn(`[ShipStation] Rate limited (429). Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`)
          await new Promise((resolve) => setTimeout(resolve, delay))
          return this.request<T>(endpoint, options, retryCount + 1)
        } else {
          throw new Error('ShipStation API error: 429 - API rate limit exceeded after retries')
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as any
        console.error('ShipStation API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          error: error,
          endpoint: endpoint,
        })
        throw new Error(
          `ShipStation API error: ${response.status} - ${error.message || JSON.stringify(error) || response.statusText}`
        )
      }

      return response.json() as Promise<T>
    } catch (error) {
      // Retry on network errors
      if (retryCount < maxRetries && error instanceof Error && !error.message.includes('API error:')) {
        const delay = baseDelay * Math.pow(2, retryCount)
        console.warn(`[ShipStation] Network error. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.request<T>(endpoint, options, retryCount + 1)
      }
      throw error
    }
  }

  /**
   * Test the API connection by fetching account settings
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request('/account/settings', {
        method: 'GET',
      })
      return true
    } catch (error) {
      console.error('ShipStation connection test failed:', error)
      return false
    }
  }

  /**
   * Validate an address
   */
  async validateAddress(address: {
    name?: string
    phone?: string
    company_name?: string
    address_line1: string
    address_line2?: string
    city_locality: string
    state_province: string
    postal_code: string
    country_code: string
  }): Promise<{
    status: string
    original_address: any
    matched_address?: any
    messages?: Array<{ type: string; message: string }>
  }> {
    return this.request('/addresses/validate', {
      method: 'POST',
      body: JSON.stringify([address]),
    }).then((results: any) => results[0])
  }

  /**
   * Get shipping rates for a shipment
   */
  async getRates(params: {
    shipment: {
      ship_to: {
        name?: string
        phone?: string
        company_name?: string
        address_line1: string
        address_line2?: string
        city_locality: string
        state_province: string
        postal_code: string
        country_code: string
      }
      ship_from: {
        name?: string
        phone?: string
        company_name?: string
        address_line1: string
        address_line2?: string
        city_locality: string
        state_province: string
        postal_code: string
        country_code: string
      }
      packages: Array<{
        weight: {
          value: number
          unit: 'pound' | 'ounce' | 'gram' | 'kilogram'
        }
        dimensions?: {
          length: number
          width: number
          height: number
          unit: 'inch' | 'centimeter'
        }
      }>
    }
    rate_options?: {
      carrier_ids?: string[]
      service_codes?: string[]
    }
  }): Promise<any> {
    return this.request('/rates', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * Create shipping labels for a multi-piece shipment
   */
  async createLabels(params: {
    shipment: {
      carrier_id: string
      service_code: string
      ship_to: {
        name: string
        phone?: string
        company_name?: string
        address_line1: string
        address_line2?: string
        city_locality: string
        state_province: string
        postal_code: string
        country_code: string
      }
      ship_from: {
        name: string
        phone?: string
        company_name?: string
        address_line1: string
        address_line2?: string
        city_locality: string
        state_province: string
        postal_code: string
        country_code: string
      }
      packages: Array<{
        weight: {
          value: number
          unit: 'pound' | 'ounce' | 'gram' | 'kilogram'
        }
        dimensions?: {
          length: number
          width: number
          height: number
          unit: 'inch' | 'centimeter'
        }
        label_messages?: {
          reference1?: string
          reference2?: string
          reference3?: string
        }
      }>
    }
    label_format?: 'pdf' | 'zpl' | 'png'
    label_layout?: '4x6' | 'letter'
  }): Promise<any> {
    return this.request('/labels', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * Void/cancel a shipping label
   */
  async voidLabel(labelId: string): Promise<any> {
    return this.request(`/labels/${labelId}/void`, {
      method: 'PUT',
    })
  }

  /**
   * Get label details
   */
  async getLabel(labelId: string): Promise<any> {
    return this.request(`/labels/${labelId}`, {
      method: 'GET',
    })
  }

  /**
   * List carriers
   */
  async listCarriers(): Promise<any> {
    return this.request('/carriers', {
      method: 'GET',
    })
  }

  /**
   * Get package types for a specific carrier
   */
  async getCarrierPackages(carrierId: string): Promise<any> {
    return this.request(`/carriers/${carrierId}/packages`, {
      method: 'GET',
    })
  }

  /**
   * Get bulk shipping rates for multiple shipments (async operation)
   * This uses a single API call to rate multiple shipments at once
   */
  async getBulkRates(params: {
    shipments: Array<{
      ship_to: {
        name?: string
        phone?: string
        company_name?: string
        address_line1: string
        address_line2?: string
        city_locality: string
        state_province: string
        postal_code: string
        country_code: string
        address_residential_indicator?: 'yes' | 'no' | 'unknown'
      }
      ship_from: {
        name?: string
        phone?: string
        company_name?: string
        address_line1: string
        address_line2?: string
        city_locality: string
        state_province: string
        postal_code: string
        country_code: string
        address_residential_indicator?: 'yes' | 'no' | 'unknown'
      }
      packages: Array<{
        weight: {
          value: number
          unit: 'pound' | 'ounce' | 'gram' | 'kilogram'
        }
        dimensions?: {
          length: number
          width: number
          height: number
          unit: 'inch' | 'centimeter'
        }
      }>
      confirmation?: 'none' | 'delivery' | 'signature' | 'adult_signature' | 'direct_signature'
    }>
    rate_options: {
      carrier_ids: string[]
      service_codes?: string[]
    }
  }): Promise<Array<{
    rate_request_id: string
    shipment_id: string
    status: 'working' | 'completed' | 'error'
    created_at: string
  }>> {
    return this.request('/rates/bulk', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * Get the results of a bulk rate request
   */
  async getBulkRateResult(rateRequestId: string): Promise<any> {
    return this.request(`/rates/bulk/${rateRequestId}`, {
      method: 'GET',
    })
  }

  /**
   * Get rates for a shipment by shipment ID (after bulk rate completes)
   */
  async getShipmentRates(shipmentId: string): Promise<any> {
    return this.request(`/shipments/${shipmentId}/rates`, {
      method: 'GET',
    })
  }
}

/**
 * Get a ShipStation client instance for a specific tenant
 * Uses the mode configured in the integration settings (test or production)
 * @param tenantId - The tenant ID to get the client for
 * @returns An initialized ShipStation client
 * @throws Error if the API key is not configured for the tenant
 */
export async function getShipStationClient(tenantId: string): Promise<ShipStationClient> {
  // Get integration settings to determine mode
  const integration = await db.integration.findUnique({
    where: {
      tenantId_provider: {
        tenantId,
        provider: 'shipstation',
      },
    },
    select: {
      config: true,
    },
  })

  // Default to test mode if not configured
  const mode = (integration?.config as any)?.mode || 'test'

  const apiKey = await getShipStationApiKey(tenantId, mode)
  return new ShipStationClient({
    apiKey,
    mode: mode as 'test' | 'production'
  })
}

/**
 * Check if ShipStation is configured for a tenant
 * @param tenantId - The tenant ID to check
 * @param mode - The mode to check (test or production), defaults to test
 * @returns True if configured, false otherwise
 */
export async function isShipStationConfigured(
  tenantId: string,
  mode: 'test' | 'production' = 'test'
): Promise<boolean> {
  try {
    await getShipStationApiKey(tenantId, mode)
    return true
  } catch (error) {
    return false
  }
}

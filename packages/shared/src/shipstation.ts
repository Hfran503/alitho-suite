import { getShipStationApiKey } from './secrets.js'
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
}

/**
 * ShipStation API client
 */
export class ShipStationClient {
  private apiKey: string
  private baseUrl: string

  constructor(config: ShipStationConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || SHIPSTATION_BASE_URL
  }

  /**
   * Make a request to the ShipStation API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'API-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

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
  return new ShipStationClient({ apiKey })
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

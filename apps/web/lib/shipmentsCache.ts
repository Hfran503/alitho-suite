/**
 * Shipments Cache Utility
 *
 * Caches shipment search results in sessionStorage to avoid re-fetching
 * the same data when navigating back or refreshing the page.
 */

import type { JobShipment } from '@repo/types'

interface CacheEntry {
  timestamp: number
  data: {
    items: JobShipment[]
    total: number
    page: number
    pageSize: number
    totalPages: number
    hasMore?: boolean
  }
  filters: {
    startDate?: string
    endDate?: string
    job?: string
    customer?: string
  }
}

// Cache TTL: 5 minutes (in milliseconds)
const CACHE_TTL = 5 * 60 * 1000

/**
 * Generate a cache key from filters
 */
function getCacheKey(filters: {
  startDate?: string
  endDate?: string
  job?: string
  customer?: string
  page?: number
}): string {
  const parts = [
    filters.startDate || '',
    filters.endDate || '',
    filters.job || '',
    filters.customer || '',
    filters.page?.toString() || '1',
  ]
  return `shipments:${parts.join(':')}`
}

/**
 * Get cached shipments if available and not expired
 */
export function getCachedShipments(filters: {
  startDate?: string
  endDate?: string
  job?: string
  customer?: string
  page?: number
}): CacheEntry['data'] | null {
  if (typeof window === 'undefined') return null

  try {
    const key = getCacheKey(filters)
    const cached = sessionStorage.getItem(key)

    if (!cached) return null

    const entry: CacheEntry = JSON.parse(cached)

    // Check if cache is expired
    const now = Date.now()
    if (now - entry.timestamp > CACHE_TTL) {
      sessionStorage.removeItem(key)
      return null
    }

    // Verify filters match
    if (
      entry.filters.startDate !== filters.startDate ||
      entry.filters.endDate !== filters.endDate ||
      entry.filters.job !== filters.job ||
      entry.filters.customer !== filters.customer
    ) {
      return null
    }

    console.log('📦 Using cached shipments:', key)
    return entry.data
  } catch (error) {
    console.error('Error reading from cache:', error)
    return null
  }
}

/**
 * Cache shipments for future use
 */
export function setCachedShipments(
  filters: {
    startDate?: string
    endDate?: string
    job?: string
    customer?: string
    page?: number
  },
  data: {
    items: JobShipment[]
    total: number
    page: number
    pageSize: number
    totalPages: number
    hasMore?: boolean
  }
): void {
  if (typeof window === 'undefined') return

  try {
    const key = getCacheKey(filters)
    const entry: CacheEntry = {
      timestamp: Date.now(),
      data,
      filters: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        job: filters.job,
        customer: filters.customer,
      },
    }

    sessionStorage.setItem(key, JSON.stringify(entry))
    console.log('💾 Cached shipments:', key)
  } catch (error) {
    console.error('Error writing to cache:', error)
    // If quota exceeded, clear old entries
    try {
      clearExpiredCache()
    } catch (clearError) {
      console.error('Error clearing cache:', clearError)
    }
  }
}

/**
 * Clear all cached shipments
 */
export function clearShipmentsCache(): void {
  if (typeof window === 'undefined') return

  try {
    const keys = Object.keys(sessionStorage)
    keys.forEach(key => {
      if (key.startsWith('shipments:')) {
        sessionStorage.removeItem(key)
      }
    })
    console.log('🗑️ Cleared shipments cache')
  } catch (error) {
    console.error('Error clearing cache:', error)
  }
}

/**
 * Clear expired cache entries
 */
function clearExpiredCache(): void {
  if (typeof window === 'undefined') return

  try {
    const now = Date.now()
    const keys = Object.keys(sessionStorage)

    keys.forEach(key => {
      if (key.startsWith('shipments:')) {
        try {
          const cached = sessionStorage.getItem(key)
          if (cached) {
            const entry: CacheEntry = JSON.parse(cached)
            if (now - entry.timestamp > CACHE_TTL) {
              sessionStorage.removeItem(key)
            }
          }
        } catch (error) {
          // If we can't parse it, remove it
          sessionStorage.removeItem(key)
        }
      }
    })
  } catch (error) {
    console.error('Error clearing expired cache:', error)
  }
}

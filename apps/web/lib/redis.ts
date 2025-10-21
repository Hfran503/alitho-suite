import Redis from 'ioredis'
import { getRedisUrl as getRedisUrlFromSecrets } from './secrets'

const getRedisUrl = async () => {
  // Try to get from environment first (for development or when already loaded)
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL
  }

  // Fetch from AWS Secrets Manager
  try {
    const url = await getRedisUrlFromSecrets()
    // Cache it in the environment for subsequent calls
    process.env.REDIS_URL = url
    return url
  } catch (error) {
    console.error('Failed to fetch Redis URL from AWS Secrets Manager:', error)
    throw new Error('REDIS_URL environment variable is not set and could not be fetched from AWS Secrets Manager')
  }
}

let redisInstance: Redis | null = null
let redisInitPromise: Promise<Redis> | null = null

export const getRedisInstance = async (): Promise<Redis> => {
  if (redisInstance) {
    return redisInstance
  }

  // Prevent multiple concurrent initializations
  if (redisInitPromise) {
    return redisInitPromise
  }

  redisInitPromise = (async () => {
    const redisUrl = await getRedisUrl()
    redisInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true, // Don't connect immediately
    })

    // Connect now
    await redisInstance.connect()

    return redisInstance
  })()

  return redisInitPromise
}

export const redis = {
  async ping() {
    const instance = await getRedisInstance()
    return instance.ping()
  },
  async incr(key: string) {
    const instance = await getRedisInstance()
    return instance.incr(key)
  },
  async expire(key: string, seconds: number) {
    const instance = await getRedisInstance()
    return instance.expire(key, seconds)
  },
  async get(key: string) {
    const instance = await getRedisInstance()
    return instance.get(key)
  },
  async setex(key: string, seconds: number, value: string) {
    const instance = await getRedisInstance()
    return instance.setex(key, seconds, value)
  },
  async keys(pattern: string) {
    const instance = await getRedisInstance()
    return instance.keys(pattern)
  },
  async del(...keys: string[]) {
    const instance = await getRedisInstance()
    return instance.del(...keys)
  },
}

// Rate limiting helper
export async function rateLimit(
  identifier: string,
  limit: number = 10,
  window: number = 60
): Promise<{ success: boolean; remaining: number }> {
  const key = `ratelimit:${identifier}`
  const current = await redis.incr(key)

  if (current === 1) {
    await redis.expire(key, window)
  }

  const remaining = Math.max(0, limit - current)

  return {
    success: current <= limit,
    remaining,
  }
}

// Cache helper with TTL
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  const cached = await redis.get(key)

  if (cached) {
    return JSON.parse(cached) as T
  }

  const fresh = await fetcher()
  await redis.setex(key, ttl, JSON.stringify(fresh))

  return fresh
}

export async function invalidateCache(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}

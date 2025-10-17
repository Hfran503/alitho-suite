import Redis from 'ioredis'

const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL
  }
  throw new Error('REDIS_URL environment variable is not set')
}

let redisInstance: Redis | null = null

const getRedisInstance = () => {
  if (!redisInstance) {
    redisInstance = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  }
  return redisInstance
}

export const redis = {
  get ping() {
    return getRedisInstance().ping.bind(getRedisInstance())
  },
  get incr() {
    return getRedisInstance().incr.bind(getRedisInstance())
  },
  get expire() {
    return getRedisInstance().expire.bind(getRedisInstance())
  },
  get get() {
    return getRedisInstance().get.bind(getRedisInstance())
  },
  get setex() {
    return getRedisInstance().setex.bind(getRedisInstance())
  },
  get keys() {
    return getRedisInstance().keys.bind(getRedisInstance())
  },
  get del() {
    return getRedisInstance().del.bind(getRedisInstance())
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

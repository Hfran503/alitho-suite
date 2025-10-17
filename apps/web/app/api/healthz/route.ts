import { NextResponse } from 'next/server'
import { db } from '@repo/database'
import { redis } from '@/lib/redis'

export async function GET() {
  try {
    // Check database connection
    await db.$queryRaw`SELECT 1`

    // Check Redis connection
    await redis.ping()

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'up',
        redis: 'up',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}

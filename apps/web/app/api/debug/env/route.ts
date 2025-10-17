import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/debug/env - Check environment variable status (admin only)
 * This helps diagnose deployment issues with environment variables
 */
export async function GET(_req: NextRequest) {
  try {
    // Only allow authenticated admin users
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check which environment variables are set (without revealing values)
    const envStatus = {
      // Database
      DATABASE_URL: !!process.env.DATABASE_URL,
      SHADOW_DATABASE_URL: !!process.env.SHADOW_DATABASE_URL,

      // Redis
      REDIS_URL: !!process.env.REDIS_URL,

      // NextAuth
      NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,

      // AWS S3
      S3_BUCKET: !!process.env.S3_BUCKET,
      S3_REGION: !!process.env.S3_REGION,
      S3_ENDPOINT: !!process.env.S3_ENDPOINT,
      S3_ACCESS_KEY_ID: !!process.env.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: !!process.env.S3_SECRET_ACCESS_KEY,

      // PACE API
      PACE_API_URL: !!process.env.PACE_API_URL,
      PACE_USERNAME: !!process.env.PACE_USERNAME,
      PACE_PASSWORD: !!process.env.PACE_PASSWORD,
    }

    // Show partial values for PACE API URL (for debugging network issues)
    const paceApiUrl = process.env.PACE_API_URL
    const paceUrlPreview = paceApiUrl
      ? `${paceApiUrl.substring(0, 20)}...`
      : null

    // Count how many are configured
    const totalVars = Object.keys(envStatus).length
    const configuredVars = Object.values(envStatus).filter(Boolean).length

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total: totalVars,
          configured: configuredVars,
          missing: totalVars - configuredVars,
          percentageConfigured: Math.round((configuredVars / totalVars) * 100),
        },
        variables: envStatus,
        debug: {
          nodeEnv: process.env.NODE_ENV,
          paceApiUrlPreview,
        },
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Debug env error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

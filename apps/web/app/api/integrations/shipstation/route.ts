import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import {
  saveShipStationApiKey,
  deleteShipStationApiKey,
} from '@/lib/secrets'
import { createAuditLog } from '@/lib/audit'

// GET /api/integrations/shipstation - Check if ShipStation is configured
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Check if integration exists in database
    const integration = await db.integration.findUnique({
      where: {
        tenantId_provider: {
          tenantId: membership.tenantId,
          provider: 'shipstation',
        },
      },
      select: {
        id: true,
        enabled: true,
        config: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!integration) {
      return NextResponse.json({
        success: true,
        data: {
          configured: false,
          enabled: false,
        },
      })
    }

    // Check if API keys exist in AWS Secrets Manager and return masked versions
    let hasTestKey = false
    let hasProductionKey = false
    let maskedTestKey = ''
    let maskedProductionKey = ''

    try {
      // Try to get the secret to check which keys exist
      const secretName = `calitho-suite/integrations/shipstation/${membership.tenantId}`
      const { getSecret } = await import('@/lib/secrets')
      const secret = await getSecret(secretName, true)

      if (secret.testApiKey) {
        hasTestKey = true
        // Mask the key: show first 7 chars and last 4 chars
        const key = secret.testApiKey
        maskedTestKey =
          key.length > 15
            ? `${key.substring(0, 7)}...${key.substring(key.length - 4)}`
            : '***configured***'
      }

      if (secret.productionApiKey) {
        hasProductionKey = true
        const key = secret.productionApiKey
        maskedProductionKey =
          key.length > 15
            ? `${key.substring(0, 7)}...${key.substring(key.length - 4)}`
            : '***configured***'
      }
    } catch (error) {
      // API keys don't exist in Secrets Manager
    }

    return NextResponse.json({
      success: true,
      data: {
        configured: hasTestKey || hasProductionKey,
        enabled: integration.enabled,
        config: integration.config,
        hasTestKey,
        hasProductionKey,
        maskedTestKey,
        maskedProductionKey,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      },
    })
  } catch (error) {
    console.error('Get ShipStation integration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/integrations/shipstation - Save ShipStation credentials
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const body = await req.json()
    const { testApiKey, productionApiKey, config, enabled } = body

    // At least one API key must be provided when saving for the first time
    if (!testApiKey && !productionApiKey) {
      // Check if we already have keys stored
      const existingIntegration = await db.integration.findUnique({
        where: {
          tenantId_provider: {
            tenantId: membership.tenantId,
            provider: 'shipstation',
          },
        },
      })

      if (!existingIntegration) {
        return NextResponse.json(
          { error: 'At least one API key (test or production) is required' },
          { status: 400 }
        )
      }
    }

    // MUTUAL EXCLUSIVITY CHECK: Only check if trying to enable this integration
    if (enabled) {
      const easypostIntegration = await db.integration.findUnique({
        where: {
          tenantId_provider: {
            tenantId: membership.tenantId,
            provider: 'easypost',
          },
        },
        select: {
          enabled: true,
        },
      })

      if (easypostIntegration?.enabled) {
        return NextResponse.json(
          {
            error:
              'EasyPost integration is currently active. Please disable it before enabling ShipStation.',
          },
          { status: 400 }
        )
      }
    }

    // Save API keys to AWS Secrets Manager only if provided
    if (testApiKey || productionApiKey) {
      await saveShipStationApiKey(membership.tenantId, testApiKey, productionApiKey)
    }

    // Create or update integration record in database
    const integration = await db.integration.upsert({
      where: {
        tenantId_provider: {
          tenantId: membership.tenantId,
          provider: 'shipstation',
        },
      },
      create: {
        tenantId: membership.tenantId,
        provider: 'shipstation',
        enabled: enabled ?? true,
        config: config || {},
        secretName: `calitho-suite/integrations/shipstation/${membership.tenantId}`,
      },
      update: {
        enabled: enabled ?? true,
        config: config || {},
        secretName: `calitho-suite/integrations/shipstation/${membership.tenantId}`,
      },
    })

    // Create audit log
    await createAuditLog({
      action: 'integration.shipstation.configured',
      entityType: 'integration',
      entityId: integration.id,
      userId: session.user.id,
      tenantId: membership.tenantId,
      metadata: {
        provider: 'shipstation',
        enabled: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'ShipStation integration configured successfully',
      data: {
        configured: true,
        enabled: integration.enabled,
      },
    })
  } catch (error) {
    console.error('Save ShipStation integration error:', error)
    return NextResponse.json(
      { error: 'Failed to save ShipStation credentials' },
      { status: 500 }
    )
  }
}

// DELETE /api/integrations/shipstation - Remove ShipStation integration
export async function DELETE(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Delete API key from AWS Secrets Manager
    await deleteShipStationApiKey(membership.tenantId)

    // Update integration record in database (soft delete by disabling)
    await db.integration.updateMany({
      where: {
        tenantId: membership.tenantId,
        provider: 'shipstation',
      },
      data: {
        enabled: false,
      },
    })

    // Create audit log
    await createAuditLog({
      action: 'integration.shipstation.removed',
      entityType: 'integration',
      entityId: undefined,
      userId: session.user.id,
      tenantId: membership.tenantId,
      metadata: {
        provider: 'shipstation',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'ShipStation integration removed successfully',
    })
  } catch (error) {
    console.error('Delete ShipStation integration error:', error)
    return NextResponse.json(
      { error: 'Failed to remove ShipStation integration' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { createAuditLog } from '@/lib/audit'

// GET /api/integrations/netsuite - Get NetSuite configuration
export async function GET() {
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

    // Check if NetSuite integration exists
    const integration = await db.netSuiteIntegration.findUnique({
      where: {
        tenantId: membership.tenantId,
      },
      select: {
        id: true,
        currentMode: true,
        sandboxEnabled: true,
        productionEnabled: true,
        // Return masked credentials
        sandboxAccountId: true,
        productionAccountId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!integration) {
      return NextResponse.json({
        success: true,
        data: {
          configured: false,
          currentMode: 'sandbox',
          sandboxEnabled: false,
          productionEnabled: false,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        configured: true,
        currentMode: integration.currentMode,
        sandboxEnabled: integration.sandboxEnabled,
        productionEnabled: integration.productionEnabled,
        sandboxAccountId: integration.sandboxAccountId,
        productionAccountId: integration.productionAccountId,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      },
    })
  } catch (error) {
    console.error('Get NetSuite integration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/integrations/netsuite - Save NetSuite credentials
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
    const {
      currentMode,
      sandboxAccountId,
      sandboxConsumerKey,
      sandboxConsumerSecret,
      sandboxTokenId,
      sandboxTokenSecret,
      sandboxEnabled,
      productionAccountId,
      productionConsumerKey,
      productionConsumerSecret,
      productionTokenId,
      productionTokenSecret,
      productionEnabled,
    } = body

    // Prepare update data - only include fields that are provided
    const updateData: any = {}

    if (currentMode) updateData.currentMode = currentMode

    // Sandbox fields - only update if provided
    if (sandboxAccountId !== undefined) updateData.sandboxAccountId = sandboxAccountId
    if (sandboxConsumerKey !== undefined) updateData.sandboxConsumerKey = sandboxConsumerKey
    if (sandboxConsumerSecret !== undefined) updateData.sandboxConsumerSecret = sandboxConsumerSecret
    if (sandboxTokenId !== undefined) updateData.sandboxTokenId = sandboxTokenId
    if (sandboxTokenSecret !== undefined) updateData.sandboxTokenSecret = sandboxTokenSecret
    if (sandboxEnabled !== undefined) updateData.sandboxEnabled = sandboxEnabled

    // Production fields - only update if provided
    if (productionAccountId !== undefined) updateData.productionAccountId = productionAccountId
    if (productionConsumerKey !== undefined) updateData.productionConsumerKey = productionConsumerKey
    if (productionConsumerSecret !== undefined) updateData.productionConsumerSecret = productionConsumerSecret
    if (productionTokenId !== undefined) updateData.productionTokenId = productionTokenId
    if (productionTokenSecret !== undefined) updateData.productionTokenSecret = productionTokenSecret
    if (productionEnabled !== undefined) updateData.productionEnabled = productionEnabled

    // Create or update NetSuite integration
    const integration = await db.netSuiteIntegration.upsert({
      where: {
        tenantId: membership.tenantId,
      },
      create: {
        tenantId: membership.tenantId,
        currentMode: currentMode || 'sandbox',
        sandboxAccountId: sandboxAccountId || null,
        sandboxConsumerKey: sandboxConsumerKey || null,
        sandboxConsumerSecret: sandboxConsumerSecret || null,
        sandboxTokenId: sandboxTokenId || null,
        sandboxTokenSecret: sandboxTokenSecret || null,
        sandboxEnabled: sandboxEnabled || false,
        productionAccountId: productionAccountId || null,
        productionConsumerKey: productionConsumerKey || null,
        productionConsumerSecret: productionConsumerSecret || null,
        productionTokenId: productionTokenId || null,
        productionTokenSecret: productionTokenSecret || null,
        productionEnabled: productionEnabled || false,
      },
      update: updateData,
    })

    // Create audit log
    await createAuditLog({
      action: 'integration.netsuite.configured',
      entityType: 'integration',
      entityId: integration.id,
      userId: session.user.id,
      tenantId: membership.tenantId,
      metadata: {
        provider: 'netsuite',
        currentMode: integration.currentMode,
        sandboxEnabled: integration.sandboxEnabled,
        productionEnabled: integration.productionEnabled,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'NetSuite integration configured successfully',
      data: {
        configured: true,
        currentMode: integration.currentMode,
        sandboxEnabled: integration.sandboxEnabled,
        productionEnabled: integration.productionEnabled,
      },
    })
  } catch (error) {
    console.error('Save NetSuite integration error:', error)
    return NextResponse.json(
      { error: 'Failed to save NetSuite credentials' },
      { status: 500 }
    )
  }
}

// DELETE /api/integrations/netsuite - Remove NetSuite integration
export async function DELETE() {
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

    // Delete NetSuite integration
    await db.netSuiteIntegration.delete({
      where: {
        tenantId: membership.tenantId,
      },
    })

    // Create audit log
    await createAuditLog({
      action: 'integration.netsuite.removed',
      entityType: 'integration',
      entityId: undefined,
      userId: session.user.id,
      tenantId: membership.tenantId,
      metadata: {
        provider: 'netsuite',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'NetSuite integration removed successfully',
    })
  } catch (error) {
    console.error('Delete NetSuite integration error:', error)
    return NextResponse.json(
      { error: 'Failed to remove NetSuite integration' },
      { status: 500 }
    )
  }
}

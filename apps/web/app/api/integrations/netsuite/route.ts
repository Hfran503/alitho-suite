import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { createAuditLog } from '@/lib/audit'
import {
  getNetSuiteCredentials,
  saveNetSuiteCredentials,
  deleteNetSuiteCredentials,
} from '@repo/shared'

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

    // Check if NetSuite integration exists in database
    const integration = await db.netSuiteIntegration.findUnique({
      where: {
        tenantId: membership.tenantId,
      },
      select: {
        id: true,
        currentMode: true,
        sandboxEnabled: true,
        productionEnabled: true,
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

    // Helper function to mask credentials (show first 4 and last 4 characters)
    const maskCredential = (value: string | undefined): string => {
      if (!value || value.length <= 8) return '••••••••'
      return `${value.slice(0, 4)}••••${value.slice(-4)}`
    }

    // Get credentials from AWS Secrets Manager
    let sandboxAccountId = ''
    let sandboxConsumerKey = ''
    let sandboxConsumerSecret = ''
    let sandboxTokenId = ''
    let sandboxTokenSecret = ''
    let productionAccountId = ''
    let productionConsumerKey = ''
    let productionConsumerSecret = ''
    let productionTokenId = ''
    let productionTokenSecret = ''
    let webhookToken = ''
    let hasSandboxCredentials = false
    let hasProductionCredentials = false

    try {
      const credentials = await getNetSuiteCredentials(membership.tenantId)

      // Set account IDs (not masked - needed for display)
      sandboxAccountId = credentials.sandboxAccountId || ''
      productionAccountId = credentials.productionAccountId || ''

      // Mask sensitive credentials (show first 4 and last 4)
      sandboxConsumerKey = maskCredential(credentials.sandboxConsumerKey)
      sandboxConsumerSecret = maskCredential(credentials.sandboxConsumerSecret)
      sandboxTokenId = maskCredential(credentials.sandboxTokenId)
      sandboxTokenSecret = maskCredential(credentials.sandboxTokenSecret)
      productionConsumerKey = maskCredential(credentials.productionConsumerKey)
      productionConsumerSecret = maskCredential(credentials.productionConsumerSecret)
      productionTokenId = maskCredential(credentials.productionTokenId)
      productionTokenSecret = maskCredential(credentials.productionTokenSecret)
      webhookToken = maskCredential(credentials.webhookToken)

      // Check if sandbox credentials exist (all fields required)
      hasSandboxCredentials = !!(
        credentials.sandboxAccountId &&
        credentials.sandboxConsumerKey &&
        credentials.sandboxConsumerSecret &&
        credentials.sandboxTokenId &&
        credentials.sandboxTokenSecret
      )

      // Check if production credentials exist (all fields required)
      hasProductionCredentials = !!(
        credentials.productionAccountId &&
        credentials.productionConsumerKey &&
        credentials.productionConsumerSecret &&
        credentials.productionTokenId &&
        credentials.productionTokenSecret
      )
    } catch (error) {
      // Credentials not found in AWS Secrets Manager
    }

    return NextResponse.json({
      success: true,
      data: {
        configured: true,
        currentMode: integration.currentMode,
        sandboxEnabled: integration.sandboxEnabled,
        productionEnabled: integration.productionEnabled,
        sandboxAccountId,
        sandboxConsumerKey,
        sandboxConsumerSecret,
        sandboxTokenId,
        sandboxTokenSecret,
        productionAccountId,
        productionConsumerKey,
        productionConsumerSecret,
        productionTokenId,
        productionTokenSecret,
        webhookToken,
        hasSandboxCredentials,
        hasProductionCredentials,
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
      webhookToken,
    } = body

    // Save credentials to AWS Secrets Manager (only if provided)
    const credentialsToSave: any = {}
    if (sandboxAccountId !== undefined) credentialsToSave.sandboxAccountId = sandboxAccountId
    if (sandboxConsumerKey !== undefined) credentialsToSave.sandboxConsumerKey = sandboxConsumerKey
    if (sandboxConsumerSecret !== undefined) credentialsToSave.sandboxConsumerSecret = sandboxConsumerSecret
    if (sandboxTokenId !== undefined) credentialsToSave.sandboxTokenId = sandboxTokenId
    if (sandboxTokenSecret !== undefined) credentialsToSave.sandboxTokenSecret = sandboxTokenSecret
    if (productionAccountId !== undefined) credentialsToSave.productionAccountId = productionAccountId
    if (productionConsumerKey !== undefined) credentialsToSave.productionConsumerKey = productionConsumerKey
    if (productionConsumerSecret !== undefined) credentialsToSave.productionConsumerSecret = productionConsumerSecret
    if (productionTokenId !== undefined) credentialsToSave.productionTokenId = productionTokenId
    if (productionTokenSecret !== undefined) credentialsToSave.productionTokenSecret = productionTokenSecret
    if (webhookToken !== undefined) credentialsToSave.webhookToken = webhookToken

    // Save to AWS Secrets Manager if there are credentials to save
    if (Object.keys(credentialsToSave).length > 0) {
      await saveNetSuiteCredentials(membership.tenantId, credentialsToSave)
    }

    // Prepare database update data (only mode and enabled flags, NOT credentials)
    const updateData: any = {}
    if (currentMode !== undefined) updateData.currentMode = currentMode
    if (sandboxEnabled !== undefined) updateData.sandboxEnabled = sandboxEnabled
    if (productionEnabled !== undefined) updateData.productionEnabled = productionEnabled

    // Create or update NetSuite integration in database (config only, not credentials)
    const integration = await db.netSuiteIntegration.upsert({
      where: {
        tenantId: membership.tenantId,
      },
      create: {
        tenantId: membership.tenantId,
        currentMode: currentMode || 'sandbox',
        sandboxEnabled: sandboxEnabled || false,
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
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: 'Failed to save NetSuite credentials', details: error instanceof Error ? error.message : String(error) },
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

    // Delete credentials from AWS Secrets Manager
    await deleteNetSuiteCredentials(membership.tenantId)

    // Delete NetSuite integration from database
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

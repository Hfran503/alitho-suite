import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getNetSuiteCredentials } from '@repo/shared'

/**
 * GET /api/integrations/netsuite/diagnostic
 *
 * Diagnostic endpoint to check NetSuite configuration
 * Returns masked credentials and configuration status
 */
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

    // Get NetSuite integration config
    const netsuiteIntegration = await db.netSuiteIntegration.findUnique({
      where: { tenantId: membership.tenantId },
    })

    if (!netsuiteIntegration) {
      return NextResponse.json({
        success: true,
        data: {
          configured: false,
          message: 'NetSuite integration not configured',
        },
      })
    }

    // Get credentials from AWS Secrets Manager
    let credentials
    try {
      credentials = await getNetSuiteCredentials(membership.tenantId)
    } catch (error) {
      return NextResponse.json({
        success: true,
        data: {
          configured: true,
          currentMode: netsuiteIntegration.currentMode,
          sandboxEnabled: netsuiteIntegration.sandboxEnabled,
          productionEnabled: netsuiteIntegration.productionEnabled,
          error: 'Failed to retrieve credentials from AWS Secrets Manager',
          errorDetails: error instanceof Error ? error.message : String(error),
        },
      })
    }

    // Mask credentials (show first 4 and last 4)
    const maskCredential = (value: string | undefined): string => {
      if (!value) return '❌ Not Set'
      if (value.length <= 8) return '✅ Set (masked)'
      return `✅ ${value.slice(0, 4)}...${value.slice(-4)}`
    }

    // Check which credentials are being used based on current mode
    const currentMode = netsuiteIntegration.currentMode
    const isCurrentModeEnabled =
      currentMode === 'sandbox'
        ? netsuiteIntegration.sandboxEnabled
        : netsuiteIntegration.productionEnabled

    // Get the active credentials
    const activeAccountId =
      currentMode === 'sandbox' ? credentials.sandboxAccountId : credentials.productionAccountId
    const activeConsumerKey =
      currentMode === 'sandbox' ? credentials.sandboxConsumerKey : credentials.productionConsumerKey
    const activeConsumerSecret =
      currentMode === 'sandbox'
        ? credentials.sandboxConsumerSecret
        : credentials.productionConsumerSecret
    const activeTokenId =
      currentMode === 'sandbox' ? credentials.sandboxTokenId : credentials.productionTokenId
    const activeTokenSecret =
      currentMode === 'sandbox' ? credentials.sandboxTokenSecret : credentials.productionTokenSecret

    // Check if all active credentials are present
    const hasAllActiveCredentials = !!(
      activeAccountId &&
      activeConsumerKey &&
      activeConsumerSecret &&
      activeTokenId &&
      activeTokenSecret
    )

    return NextResponse.json({
      success: true,
      data: {
        configured: true,
        currentMode: netsuiteIntegration.currentMode,
        sandboxEnabled: netsuiteIntegration.sandboxEnabled,
        productionEnabled: netsuiteIntegration.productionEnabled,
        currentModeEnabled: isCurrentModeEnabled,
        restletUrl: process.env.NETSUITE_RESTLET_URL || '❌ Not Set',
        activeCredentials: {
          mode: currentMode,
          accountId: maskCredential(activeAccountId),
          consumerKey: maskCredential(activeConsumerKey),
          consumerSecret: maskCredential(activeConsumerSecret),
          tokenId: maskCredential(activeTokenId),
          tokenSecret: maskCredential(activeTokenSecret),
          hasAllCredentials: hasAllActiveCredentials,
        },
        sandboxCredentials: {
          accountId: maskCredential(credentials.sandboxAccountId),
          consumerKey: maskCredential(credentials.sandboxConsumerKey),
          consumerSecret: maskCredential(credentials.sandboxConsumerSecret),
          tokenId: maskCredential(credentials.sandboxTokenId),
          tokenSecret: maskCredential(credentials.sandboxTokenSecret),
          hasAllCredentials: !!(
            credentials.sandboxAccountId &&
            credentials.sandboxConsumerKey &&
            credentials.sandboxConsumerSecret &&
            credentials.sandboxTokenId &&
            credentials.sandboxTokenSecret
          ),
        },
        productionCredentials: {
          accountId: maskCredential(credentials.productionAccountId),
          consumerKey: maskCredential(credentials.productionConsumerKey),
          consumerSecret: maskCredential(credentials.productionConsumerSecret),
          tokenId: maskCredential(credentials.productionTokenId),
          tokenSecret: maskCredential(credentials.productionTokenSecret),
          hasAllCredentials: !!(
            credentials.productionAccountId &&
            credentials.productionConsumerKey &&
            credentials.productionConsumerSecret &&
            credentials.productionTokenId &&
            credentials.productionTokenSecret
          ),
        },
        issues: [
          ...(!isCurrentModeEnabled ? [`⚠️ Current mode (${currentMode}) is DISABLED`] : []),
          ...(!hasAllActiveCredentials
            ? [`⚠️ ${currentMode} credentials are incomplete`]
            : []),
          ...(!process.env.NETSUITE_RESTLET_URL ? ['⚠️ NETSUITE_RESTLET_URL not configured'] : []),
        ],
      },
    })
  } catch (error) {
    console.error('NetSuite diagnostic error:', error)
    return NextResponse.json(
      {
        error: 'Failed to retrieve diagnostic information',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

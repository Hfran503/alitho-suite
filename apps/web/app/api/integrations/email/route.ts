import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import {
  getEmailCredentials,
  saveEmailCredentials,
  EmailCredentials,
} from '@/lib/secrets'

/**
 * GET /api/integrations/email
 * Get email integration status and configuration
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      include: { tenant: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const tenantId = membership.tenantId

    // Check if email integration exists
    const integration = await db.integration.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: 'email',
        },
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

    // Try to get credentials from AWS Secrets Manager
    let credentials: EmailCredentials | null = null
    let maskedCredentials: any = {}
    let configData: any = {}

    try {
      credentials = await getEmailCredentials(tenantId)

      // Return non-sensitive configuration data
      if (credentials.provider === 'smtp') {
        configData.smtpHost = credentials.smtpHost
        configData.smtpPort = credentials.smtpPort
        configData.smtpSecure = credentials.smtpSecure
        configData.smtpUser = credentials.smtpUser
        maskedCredentials.smtpPassword = '••••••••'
      } else if (credentials.provider === 'sendgrid') {
        if (credentials.sendgridApiKey) {
          maskedCredentials.sendgridApiKey = '••••••••' + credentials.sendgridApiKey.slice(-4)
        }
      } else if (credentials.provider === 'ses') {
        configData.sesRegion = credentials.sesRegion
        configData.sesAccessKeyId = credentials.sesAccessKeyId
        maskedCredentials.sesSecretAccessKey = '••••••••'
      } else if (credentials.provider === 'resend') {
        if (credentials.resendApiKey) {
          maskedCredentials.resendApiKey = '••••••••' + credentials.resendApiKey.slice(-4)
        }
      }

      // Include common fields
      configData.fromEmail = credentials.fromEmail
      configData.fromName = credentials.fromName
    } catch (error) {
      console.error('Error fetching email credentials:', error)
    }

    return NextResponse.json({
      success: true,
      data: {
        configured: !!credentials,
        enabled: integration.enabled,
        provider: credentials?.provider || (integration.config as any)?.provider,
        config: integration.config,
        credentials: configData,
        maskedCredentials,
      },
    })
  } catch (error) {
    console.error('Error fetching email integration:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email integration' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/integrations/email
 * Save email integration configuration
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      include: { tenant: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const tenantId = membership.tenantId
    const body = await request.json()

    const {
      enabled,
      provider,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPassword,
      sendgridApiKey,
      sesRegion,
      sesAccessKeyId,
      sesSecretAccessKey,
      resendApiKey,
      fromEmail,
      fromName,
    } = body

    // Validate required fields based on provider
    if (provider === 'smtp') {
      if (!smtpHost || !smtpPort || !smtpUser) {
        return NextResponse.json(
          { error: 'SMTP host, port, and user are required' },
          { status: 400 }
        )
      }
    } else if (provider === 'sendgrid') {
      if (!sendgridApiKey) {
        return NextResponse.json(
          { error: 'SendGrid API key is required' },
          { status: 400 }
        )
      }
    } else if (provider === 'ses') {
      if (!sesRegion || !sesAccessKeyId) {
        return NextResponse.json(
          { error: 'AWS SES region and access key ID are required' },
          { status: 400 }
        )
      }
    } else if (provider === 'resend') {
      if (!resendApiKey) {
        return NextResponse.json(
          { error: 'Resend API key is required' },
          { status: 400 }
        )
      }
    }

    // Prepare credentials to save
    const credentials: Partial<EmailCredentials> = {
      provider,
      fromEmail,
      fromName,
    }

    // Only include credentials if they're not masked (i.e., they've been changed)
    if (provider === 'smtp') {
      credentials.smtpHost = smtpHost
      credentials.smtpPort = smtpPort
      credentials.smtpSecure = smtpSecure
      credentials.smtpUser = smtpUser
      if (smtpPassword && !smtpPassword.includes('••')) {
        credentials.smtpPassword = smtpPassword
      }
    } else if (provider === 'sendgrid') {
      if (sendgridApiKey && !sendgridApiKey.includes('••')) {
        credentials.sendgridApiKey = sendgridApiKey
      }
    } else if (provider === 'ses') {
      credentials.sesRegion = sesRegion
      credentials.sesAccessKeyId = sesAccessKeyId
      if (sesSecretAccessKey && !sesSecretAccessKey.includes('••')) {
        credentials.sesSecretAccessKey = sesSecretAccessKey
      }
    } else if (provider === 'resend') {
      if (resendApiKey && !resendApiKey.includes('••')) {
        credentials.resendApiKey = resendApiKey
      }
    }

    // Save credentials to AWS Secrets Manager
    await saveEmailCredentials(tenantId, credentials)

    // Update or create integration record in database
    await db.integration.upsert({
      where: {
        tenantId_provider: {
          tenantId,
          provider: 'email',
        },
      },
      create: {
        tenantId,
        provider: 'email',
        enabled: enabled ?? true,
        config: {
          provider,
          fromEmail,
          fromName,
        },
        secretName: `calitho-suite/integrations/email/${tenantId}`,
      },
      update: {
        enabled: enabled ?? true,
        config: {
          provider,
          fromEmail,
          fromName,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Email integration configured successfully',
    })
  } catch (error) {
    console.error('Error saving email integration:', error)
    return NextResponse.json(
      { error: 'Failed to save email integration' },
      { status: 500 }
    )
  }
}

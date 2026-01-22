import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { enqueueEmail } from '@/lib/queue'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user and tenant
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        memberships: {
          include: { tenant: true }
        }
      }
    })

    if (!user || !user.memberships[0]) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const tenantId = user.memberships[0].tenantId

    const body = await request.json()
    const { type } = body // 'customer' or 'internal'

    // Get CRM settings
    const crmSettings = await db.crmSettings.findUnique({
      where: { tenantId },
    })

    // Get a recent opportunity for sample data
    const sampleOpportunity = await db.opportunity.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        contact: true,
      },
    })

    // Sample data for test email
    const testData = {
      firstName: sampleOpportunity?.contact?.firstName || 'John',
      lastName: sampleOpportunity?.contact?.lastName || 'Doe',
      email: session.user.email || 'test@example.com',
      phone: sampleOpportunity?.contact?.phone || '(555) 123-4567',
      company: sampleOpportunity?.contact?.company || 'Acme Corporation',
      title: sampleOpportunity?.contact?.title || 'Marketing Director',
      opportunityNumber: sampleOpportunity?.opportunityNumber || 'OPP-2026-0001',
      opportunityId: sampleOpportunity?.id || 'test-id',
      projectDetails: sampleOpportunity?.description || 'STANDARD PRODUCTS REQUEST: Product 1: - Type: Business Cards - Quantities: 500, 1000 - Paper Type: 100# Silk Cover - Card Size: 3.5 × 2 in - Print Sides: Double-Sided - Finish: Matte Product 2: - Type: Brochures - Quantities: 250, 500 - Paper Type: 100# Gloss Text - Size: 8.5 × 11 in - Fold Type: Tri-fold Additional Notes: Please include our updated logo.',
      estimatedBudget: '$500 - $1,000',
      attachments: [] as { filename: string; originalName: string; url: string; size: number }[],
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://calithosuite.com'

    if (type === 'customer') {
      // Send test customer email
      const customerEmailHtml = generateCustomerEmailHtml(testData)

      await enqueueEmail({
        to: session.user.email,
        subject: `[TEST] Quote Request Received - ${testData.opportunityNumber}`,
        html: customerEmailHtml,
        tenantId,
      })

      return NextResponse.json({
        success: true,
        message: `Test customer email sent to ${session.user.email}`,
      })
    } else if (type === 'internal') {
      // Check if internal email is configured
      const notificationEmail = crmSettings?.quoteRequestNotificationEmail
      if (!notificationEmail) {
        return NextResponse.json(
          { error: 'No internal notification email configured' },
          { status: 400 }
        )
      }

      const internalEmailHtml = generateInternalEmailHtml(testData, baseUrl)

      // Send to configured email(s)
      const notificationEmails = notificationEmail.split(',').map((e: string) => e.trim()).filter(Boolean)

      await enqueueEmail({
        to: notificationEmails,
        subject: `[TEST] New Quote Request: ${testData.company} - ${testData.opportunityNumber}`,
        html: internalEmailHtml,
        tenantId,
      })

      return NextResponse.json({
        success: true,
        message: `Test internal email sent to ${notificationEmails.join(', ')}`,
      })
    }

    return NextResponse.json({ error: 'Invalid email type' }, { status: 400 })
  } catch (error) {
    console.error('Error sending test email:', error)
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    )
  }
}

function generateCustomerEmailHtml(data: {
  firstName: string
  opportunityNumber: string
  company: string
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="700" cellpadding="0" cellspacing="0" style="max-width: 700px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0d9488; padding: 40px 40px; text-align: center;">
              <div style="width: 64px; height: 64px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">✓</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Quote Request Received</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">We'll get back to you shortly</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px; color: #1e293b; font-size: 16px; line-height: 1.6;">
                Hi <strong>${data.firstName}</strong>,
              </p>
              <p style="margin: 0 0 24px; color: #475569; font-size: 16px; line-height: 1.6;">
                Thank you for reaching out! We've received your quote request and our team is already reviewing the details.
              </p>

              <!-- Request Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdfa; border-radius: 12px; margin: 24px 0;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Request Number</p>
                          <p style="margin: 0; color: #0d9488; font-size: 20px; font-weight: 700; font-family: 'SF Mono', Monaco, monospace;">${data.opportunityNumber}</p>
                        </td>
                        <td align="right">
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Company</p>
                          <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${data.company || 'Not provided'}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Timeline -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td>
                    <p style="margin: 0 0 16px; color: #1e293b; font-size: 14px; font-weight: 600;">What happens next?</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="32" valign="top">
                          <div style="width: 24px; height: 24px; background-color: #0d9488; border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 12px; font-weight: 600;">1</div>
                        </td>
                        <td style="padding-left: 12px; padding-bottom: 16px;">
                          <p style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 500;">Review</p>
                          <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">Our team reviews your requirements</p>
                        </td>
                      </tr>
                      <tr>
                        <td width="32" valign="top">
                          <div style="width: 24px; height: 24px; background-color: #e2e8f0; border-radius: 50%; text-align: center; line-height: 24px; color: #64748b; font-size: 12px; font-weight: 600;">2</div>
                        </td>
                        <td style="padding-left: 12px; padding-bottom: 16px;">
                          <p style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 500;">Quote Preparation</p>
                          <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">We prepare a detailed quote for you</p>
                        </td>
                      </tr>
                      <tr>
                        <td width="32" valign="top">
                          <div style="width: 24px; height: 24px; background-color: #e2e8f0; border-radius: 50%; text-align: center; line-height: 24px; color: #64748b; font-size: 12px; font-weight: 600;">3</div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 500;">Response</p>
                          <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">Typically within 1-2 business days</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #475569; font-size: 15px; line-height: 1.6;">
                If you have any urgent questions, don't hesitate to reach out to us directly.
              </p>

              <p style="margin: 24px 0 0; color: #1e293b; font-size: 15px; line-height: 1.6;">
                Best regards,<br>
                <strong>The Calitho Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                This is an automated message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function generateInternalEmailHtml(
  data: {
    firstName: string
    lastName: string
    email: string
    phone: string
    company: string
    title: string
    opportunityNumber: string
    opportunityId: string
    projectDetails: string
    estimatedBudget: string
    attachments: { filename: string; originalName: string; url: string; size: number }[]
  },
  baseUrl: string
) {
  const opportunityUrl = `${baseUrl}/crm/opportunities/${data.opportunityId}`

  // Format project details for HTML email
  const formattedProjectDetails = data.projectDetails
    .split('\n')
    .map((line: string) => {
      if (line.startsWith('---') && line.endsWith('---')) {
        const productName = line.replace(/^-+\s*/, '').replace(/\s*-+$/, '')
        return `<div style="background-color: #ccfbf1; border-left: 4px solid #0d9488; padding: 12px 16px; margin: 16px 0 12px 0; font-weight: 600; color: #134e4a; border-radius: 0 8px 8px 0;">${productName}</div>`
      }
      if (line.includes(':')) {
        const [label, ...valueParts] = line.split(':')
        const value = valueParts.join(':').trim()
        if (value) {
          return `<p style="margin: 6px 0; padding-left: 16px; color: #374151; font-size: 14px;"><span style="color: #6b7280; font-weight: 500;">${label.trim()}:</span> ${value}</p>`
        }
      }
      if (line.trim() === '') {
        return '<div style="height: 12px;"></div>'
      }
      return `<p style="margin: 6px 0; padding-left: 16px; color: #374151; font-size: 14px;">${line}</p>`
    })
    .join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="700" cellpadding="0" cellspacing="0" style="max-width: 700px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0d9488; padding: 40px 40px; text-align: center;">
              <div style="width: 64px; height: 64px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; line-height: 64px;">
                <span style="font-size: 32px; color: white;">📋</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">New Quote Request</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">${data.company || `${data.firstName} ${data.lastName}`}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <!-- Request Number Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdfa; border-radius: 12px; margin: 0 0 24px 0;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Request Number</p>
                          <p style="margin: 0; color: #0d9488; font-size: 20px; font-weight: 700; font-family: 'SF Mono', Monaco, monospace;">${data.opportunityNumber}</p>
                        </td>
                        <td align="right">
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Budget</p>
                          <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${data.estimatedBudget || 'Not provided'}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Contact Information -->
              <p style="margin: 0 0 16px; color: #1e293b; font-size: 14px; font-weight: 600;">Contact Information</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td width="50%" style="padding-bottom: 12px;">
                    <p style="margin: 0 0 2px; color: #64748b; font-size: 12px;">Name</p>
                    <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 500;">${data.firstName} ${data.lastName}</p>
                  </td>
                  <td width="50%" style="padding-bottom: 12px;">
                    <p style="margin: 0 0 2px; color: #64748b; font-size: 12px;">Company</p>
                    <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 500;">${data.company || 'Not provided'}</p>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding-bottom: 12px;">
                    <p style="margin: 0 0 2px; color: #64748b; font-size: 12px;">Email</p>
                    <a href="mailto:${data.email}" style="color: #0d9488; font-size: 14px; text-decoration: none; font-weight: 500;">${data.email}</a>
                  </td>
                  <td width="50%" style="padding-bottom: 12px;">
                    <p style="margin: 0 0 2px; color: #64748b; font-size: 12px;">Phone</p>
                    <a href="tel:${data.phone}" style="color: #0d9488; font-size: 14px; text-decoration: none; font-weight: 500;">${data.phone || 'Not provided'}</a>
                  </td>
                </tr>
                <tr>
                  <td colspan="2">
                    <p style="margin: 0 0 2px; color: #64748b; font-size: 12px;">Title</p>
                    <p style="margin: 0; color: #1e293b; font-size: 14px;">${data.title || 'Not provided'}</p>
                  </td>
                </tr>
              </table>

              <!-- Request Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdfa; border-radius: 12px; border: 1px solid #ccfbf1;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 16px; color: #0d9488; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Products/Services Requested</p>
                    ${formattedProjectDetails}
                  </td>
                </tr>
              </table>

              ${data.attachments.length > 0 ? `
              <!-- Attachments -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdfa; border-radius: 12px; border: 1px solid #ccfbf1; margin-top: 16px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 16px; color: #0d9488; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Attachments (${data.attachments.length})</p>
                    ${data.attachments.map((att) => `
                      <a href="${baseUrl}${att.url}" style="display: block; background-color: #ffffff; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; text-decoration: none; border: 1px solid #ccfbf1;" target="_blank">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td width="32">
                              <div style="width: 32px; height: 32px; background-color: #0d9488; border-radius: 6px; text-align: center; line-height: 32px; color: white; font-size: 14px;">↓</div>
                            </td>
                            <td style="padding-left: 12px;">
                              <p style="margin: 0; color: #0d9488; font-size: 14px; font-weight: 500;">${att.originalName}</p>
                            </td>
                          </tr>
                        </table>
                      </a>
                    `).join('')}
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                <tr>
                  <td align="center">
                    <a href="${opportunityUrl}" style="display: inline-block; background-color: #0d9488; color: #ffffff; padding: 16px 48px; border-radius: 12px; text-decoration: none; font-size: 16px; font-weight: 600;">View in CRM</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                This is an automated notification from Calitho Suite
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

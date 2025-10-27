import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getEmailCredentials } from '@repo/shared'
import nodemailer from 'nodemailer'

/**
 * POST /api/pace/jobs/send-estimate-alert
 * Send email alert for estimate number mismatch
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
      jobNumber,
      proposalNumber,
      proposalEstimate,
      part1Estimate,
      plannerEmail,
      plannerName,
      customerName,
      description,
    } = body

    // Validate required fields
    if (!jobNumber || !plannerEmail) {
      return NextResponse.json(
        { error: 'Job number and planner email are required' },
        { status: 400 }
      )
    }

    // Get email credentials from AWS Secrets Manager
    const credentials = await getEmailCredentials(tenantId)

    if (!credentials) {
      return NextResponse.json(
        { error: 'Email credentials not configured for tenant' },
        { status: 500 }
      )
    }

    // Get current user's email for CC
    const currentUserEmail = session.user.email || ''

    // Prepare email content
    const subject = `Job #${jobNumber} - Action Required: Estimate Number Mismatch`

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f3f4f6;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: transparent;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #ffffff;
              padding: 20px;
              border-radius: 8px 8px 0 0;
            }
            .header h1, .header p {
              color: #ffffff;
              margin: 0;
            }
            .header h1 {
              font-size: 24px;
              font-weight: bold;
            }
            .header p {
              margin-top: 8px;
              opacity: 0.95;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border: 1px solid #e5e7eb;
              border-top: none;
            }
            .alert-box {
              background: #fee2e2;
              border: 2px solid #ef4444;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
            }
            .alert-title {
              color: #991b1b;
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 10px;
            }
            .info-grid {
              background: white;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .info-row {
              display: flex;
              padding: 10px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              font-weight: bold;
              color: #6b7280;
              width: 180px;
            }
            .info-value {
              color: #111827;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #6b7280;
              font-size: 12px;
            }
            .btn {
              display: inline-block;
              background: #4f46e5;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f3f4f6; margin: 0; padding: 0;">
          <div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div class="header" style="background-color: #667eea; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">⚠️ Action Required</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff;">Estimate Number Mismatch Detected</p>
            </div>

            <div class="content">
              <p>Hello ${plannerName || 'there'},</p>

              <p>This is an automated alert regarding an estimate number discrepancy that requires your attention.</p>

              <div class="alert-box">
                <div class="alert-title">🚨 Estimate Number Mismatch</div>
                <p style="margin: 0;">The estimate number on the Proposal does not match the estimate number on the Job. This needs to be corrected before billing can proceed.</p>
              </div>

              <div class="info-grid">
                <div class="info-row">
                  <div class="info-label">Job Number:</div>
                  <div class="info-value"><strong>${jobNumber}</strong></div>
                </div>
                ${proposalNumber ? `
                <div class="info-row">
                  <div class="info-label">Proposal Number:</div>
                  <div class="info-value">${proposalNumber}</div>
                </div>
                ` : ''}
                ${customerName ? `
                <div class="info-row">
                  <div class="info-label">Customer:</div>
                  <div class="info-value">${customerName}</div>
                </div>
                ` : ''}
                ${description ? `
                <div class="info-row">
                  <div class="info-label">Description:</div>
                  <div class="info-value">${description}</div>
                </div>
                ` : ''}
                <div class="info-row">
                  <div class="info-label">Proposal Estimate #:</div>
                  <div class="info-value"><strong style="color: #dc2626;">${proposalEstimate || 'Not Set'}</strong></div>
                </div>
                <div class="info-row">
                  <div class="info-label">Job Estimate #:</div>
                  <div class="info-value"><strong style="color: #dc2626;">${part1Estimate || 'Not Set'}</strong></div>
                </div>
              </div>

              <p><strong>Action Required:</strong></p>
              <ul>
                <li>Review the estimate numbers on both the Proposal and the Job</li>
                <li>Update the incorrect estimate number to match</li>
                <li>Verify that the pricing information is correct</li>
              </ul>

              <div style="text-align: center;">
                <a href="http://epace.calitho.com/epace/company:public/object/Job/detail/${jobNumber}" class="btn">
                  View Job in ePace
                </a>
              </div>

              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                This alert was sent from the Prebilling Jobs page. If you have any questions, please contact your CSR or system administrator.
              </p>
            </div>

            <div class="footer">
              <p>© ${new Date().getFullYear()} Calitho Suite - Automated Alert System</p>
            </div>
          </div>
        </body>
      </html>
    `

    const textContent = `
ACTION REQUIRED: Estimate Number Mismatch

Hello ${plannerName || 'there'},

This is an automated alert regarding an estimate number discrepancy that requires your attention.

ESTIMATE NUMBER MISMATCH DETECTED:
The estimate number on the Proposal does not match the estimate number on the Job. This needs to be corrected before billing can proceed.

JOB DETAILS:
- Job Number: ${jobNumber}
${proposalNumber ? `- Proposal Number: ${proposalNumber}` : ''}
${customerName ? `- Customer: ${customerName}` : ''}
${description ? `- Description: ${description}` : ''}
- Proposal Estimate #: ${proposalEstimate || 'Not Set'}
- Job Estimate #: ${part1Estimate || 'Not Set'}

ACTION REQUIRED:
1. Review the estimate numbers on both the Proposal and the Job
2. Update the incorrect estimate number to match
3. Verify that the pricing information is correct

View Job in ePace: http://epace.calitho.com/epace/company:public/object/Job/detail/${jobNumber}

---
This alert was sent from the Prebilling Jobs page.
© ${new Date().getFullYear()} Calitho Suite - Automated Alert System
    `

    // Send email based on provider
    let emailSent = false

    if (credentials.provider === 'smtp') {
      const transporter = nodemailer.createTransport({
        host: credentials.smtpHost,
        port: credentials.smtpPort,
        secure: credentials.smtpSecure,
        auth: {
          user: credentials.smtpUser,
          pass: credentials.smtpPassword,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
        requireTLS: !credentials.smtpSecure,
        tls: {
          rejectUnauthorized: false,
        },
      })

      await transporter.sendMail({
        from: credentials.fromEmail || credentials.smtpUser,
        to: plannerEmail,
        cc: currentUserEmail,
        bcc: 'hector.franco@calitho.com',
        subject,
        text: textContent,
        html: htmlContent,
      })

      emailSent = true
    } else if (credentials.provider === 'sendgrid') {
      const sgMail = require('@sendgrid/mail')
      sgMail.setApiKey(credentials.sendgridApiKey)

      await sgMail.send({
        to: plannerEmail,
        cc: currentUserEmail,
        bcc: 'hector.franco@calitho.com',
        from: credentials.fromEmail!,
        subject,
        text: textContent,
        html: htmlContent,
      })

      emailSent = true
    } else if (credentials.provider === 'ses') {
      const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses')

      const sesClient = new SESClient({
        region: credentials.sesRegion,
        credentials: {
          accessKeyId: credentials.sesAccessKeyId,
          secretAccessKey: credentials.sesSecretAccessKey,
        },
      })

      const toAddresses = [plannerEmail]
      if (currentUserEmail) toAddresses.push(currentUserEmail)
      toAddresses.push('hector.franco@calitho.com')

      const command = new SendEmailCommand({
        Source: credentials.fromEmail,
        Destination: {
          ToAddresses: toAddresses,
        },
        Message: {
          Subject: {
            Data: subject,
          },
          Body: {
            Text: {
              Data: textContent,
            },
            Html: {
              Data: htmlContent,
            },
          },
        },
      })

      await sesClient.send(command)
      emailSent = true
    } else if (credentials.provider === 'resend') {
      const { Resend } = require('resend')
      const resend = new Resend(credentials.resendApiKey)

      const toAddresses = [plannerEmail]
      if (currentUserEmail) toAddresses.push(currentUserEmail)
      toAddresses.push('hector.franco@calitho.com')

      await resend.emails.send({
        from: credentials.fromEmail!,
        to: toAddresses,
        subject,
        html: htmlContent,
      })

      emailSent = true
    }

    if (!emailSent) {
      return NextResponse.json(
        { error: `Unsupported email provider: ${credentials.provider}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Alert email sent successfully',
    })
  } catch (error) {
    console.error('Error sending estimate alert email:', error)
    return NextResponse.json(
      {
        error: 'Failed to send alert email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

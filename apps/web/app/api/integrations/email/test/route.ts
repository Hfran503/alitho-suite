import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import nodemailer from 'nodemailer'

/**
 * POST /api/integrations/email/test
 * Test email configuration by sending a test email
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
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
      testEmail,
    } = body

    // Validate test email
    if (!testEmail) {
      return NextResponse.json(
        { error: 'Test email address is required' },
        { status: 400 }
      )
    }

    try {
      if (provider === 'smtp') {
        console.log('Testing SMTP with:', {
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          user: smtpUser,
          passwordLength: smtpPassword?.length,
          passwordStartsWith: smtpPassword?.substring(0, 3),
        })

        // Test SMTP connection
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: {
            user: smtpUser,
            pass: smtpPassword,
          },
          connectionTimeout: 10000, // 10 seconds
          greetingTimeout: 10000, // 10 seconds
          socketTimeout: 10000, // 10 seconds
          requireTLS: !smtpSecure, // Use STARTTLS if not using SSL
          tls: {
            rejectUnauthorized: false, // Accept self-signed certificates
          },
        })

        // Verify connection
        await transporter.verify()

        // Send test email
        await transporter.sendMail({
          from: fromEmail || smtpUser,
          to: testEmail,
          subject: 'Test Email from Calitho Suite',
          text: 'This is a test email to verify your email configuration.',
          html: '<p>This is a test email to verify your email configuration.</p>',
        })

        return NextResponse.json({
          success: true,
          message: 'Test email sent successfully via SMTP',
        })
      } else if (provider === 'sendgrid') {
        // Test SendGrid API
        const sgMail = require('@sendgrid/mail')
        sgMail.setApiKey(sendgridApiKey)

        await sgMail.send({
          to: testEmail,
          from: fromEmail,
          subject: 'Test Email from Calitho Suite',
          text: 'This is a test email to verify your SendGrid configuration.',
          html: '<p>This is a test email to verify your SendGrid configuration.</p>',
        })

        return NextResponse.json({
          success: true,
          message: 'Test email sent successfully via SendGrid',
        })
      } else if (provider === 'ses') {
        // Test AWS SES
        const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses')

        const sesClient = new SESClient({
          region: sesRegion,
          credentials: {
            accessKeyId: sesAccessKeyId,
            secretAccessKey: sesSecretAccessKey,
          },
        })

        const command = new SendEmailCommand({
          Source: fromEmail,
          Destination: {
            ToAddresses: [testEmail],
          },
          Message: {
            Subject: {
              Data: 'Test Email from Calitho Suite',
            },
            Body: {
              Text: {
                Data: 'This is a test email to verify your AWS SES configuration.',
              },
              Html: {
                Data: '<p>This is a test email to verify your AWS SES configuration.</p>',
              },
            },
          },
        })

        await sesClient.send(command)

        return NextResponse.json({
          success: true,
          message: 'Test email sent successfully via AWS SES',
        })
      } else if (provider === 'resend') {
        // Test Resend API
        const { Resend } = require('resend')
        const resend = new Resend(resendApiKey)

        await resend.emails.send({
          from: fromEmail,
          to: testEmail,
          subject: 'Test Email from Calitho Suite',
          html: '<p>This is a test email to verify your Resend configuration.</p>',
        })

        return NextResponse.json({
          success: true,
          message: 'Test email sent successfully via Resend',
        })
      }

      return NextResponse.json(
        { error: 'Unsupported email provider' },
        { status: 400 }
      )
    } catch (testError: any) {
      console.error('Email test failed:', testError)
      return NextResponse.json(
        {
          success: false,
          error: testError.message || 'Failed to send test email',
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error testing email integration:', error)
    return NextResponse.json(
      { error: 'Failed to test email integration' },
      { status: 500 }
    )
  }
}

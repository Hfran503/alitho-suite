import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import nodemailer from 'nodemailer'
import { getEmailCredentials } from '@repo/shared'

interface EmailJobData {
  to: string | string[]
  subject: string
  templateName?: string
  templateData?: Record<string, any>
  text?: string
  html?: string
  tenantId: string
}

async function processEmail(job: Job<EmailJobData>) {
  const { to, subject, templateName, text, html, tenantId } = job.data

  console.log(`Sending email to ${to}: ${subject}`)

  try {
    // Get email credentials from AWS Secrets Manager
    const credentials = await getEmailCredentials(tenantId)

    if (!credentials) {
      throw new Error('Email credentials not configured for tenant')
    }

    let emailSent = false

    if (credentials.provider === 'smtp') {
      // Send via SMTP
      const transporter = nodemailer.createTransport({
        host: credentials.smtpHost,
        port: credentials.smtpPort,
        secure: credentials.smtpSecure,
        auth: {
          user: credentials.smtpUser,
          pass: credentials.smtpPassword,
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000, // 10 seconds
        socketTimeout: 10000, // 10 seconds
        requireTLS: !credentials.smtpSecure, // Use STARTTLS if not using SSL
        tls: {
          rejectUnauthorized: false, // Accept self-signed certificates
        },
      })

      await transporter.sendMail({
        from: credentials.fromEmail || credentials.smtpUser,
        to,
        subject,
        text: text || `Email from template: ${templateName}`,
        html: html || `<p>Email from template: ${templateName}</p>`,
      })

      emailSent = true
    } else if (credentials.provider === 'sendgrid') {
      // Send via SendGrid
      const sgMail = require('@sendgrid/mail')
      sgMail.setApiKey(credentials.sendgridApiKey)

      await sgMail.send({
        to,
        from: credentials.fromEmail!,
        subject,
        text: text || `Email from template: ${templateName}`,
        html: html || `<p>Email from template: ${templateName}</p>`,
      })

      emailSent = true
    } else if (credentials.provider === 'ses') {
      // Send via AWS SES
      const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses')

      const sesClient = new SESClient({
        region: credentials.sesRegion,
        credentials: {
          accessKeyId: credentials.sesAccessKeyId,
          secretAccessKey: credentials.sesSecretAccessKey,
        },
      })

      const command = new SendEmailCommand({
        Source: credentials.fromEmail,
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to],
        },
        Message: {
          Subject: {
            Data: subject,
          },
          Body: {
            Text: {
              Data: text || `Email from template: ${templateName}`,
            },
            Html: {
              Data: html || `<p>Email from template: ${templateName}</p>`,
            },
          },
        },
      })

      await sesClient.send(command)
      emailSent = true
    } else if (credentials.provider === 'resend') {
      // Send via Resend
      const { Resend } = require('resend')
      const resend = new Resend(credentials.resendApiKey)

      await resend.emails.send({
        from: credentials.fromEmail!,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: html || `<p>Email from template: ${templateName}</p>`,
      })

      emailSent = true
    }

    if (!emailSent) {
      throw new Error(`Unsupported email provider: ${credentials.provider}`)
    }

    console.log(`✅ Email sent successfully to ${to}`)

    return {
      sent: true,
      to,
      subject,
      provider: credentials.provider,
    }
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error)
    throw error
  }
}

export function emailWorker(connection: Redis) {
  return new Worker<EmailJobData>(
    'emails',
    async (job) => {
      const result = await processEmail(job)
      console.log(`✅ Email job ${job.id} completed`)
      return result
    },
    {
      connection,
      concurrency: 5,
    }
  )
}

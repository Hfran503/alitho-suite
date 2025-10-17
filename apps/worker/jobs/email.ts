import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'

interface EmailJobData {
  to: string | string[]
  subject: string
  templateName: string
  templateData: Record<string, any>
}

async function processEmail(job: Job<EmailJobData>) {
  const { to, subject, templateName, templateData } = job.data

  console.log(`Sending email to ${to}: ${subject}`)

  // TODO: Implement actual email sending logic
  // Examples:
  // - Nodemailer with SMTP
  // - SendGrid API
  // - AWS SES
  // - Resend

  // For now, just log
  console.log({
    to,
    subject,
    template: templateName,
    data: templateData,
  })

  // Simulate email sending
  await new Promise((resolve) => setTimeout(resolve, 1000))

  return {
    sent: true,
    to,
    subject,
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

import { Worker, Job } from 'bullmq'
import { chromium } from 'playwright'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import Redis from 'ioredis'
import { db } from '@repo/database'

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  // Only use explicit credentials if provided (for local MinIO)
  // Otherwise, AWS SDK will use default credential chain
  ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
      }
    : {}),
  // Only use custom endpoint for non-AWS S3 (like MinIO)
  ...(process.env.S3_ENDPOINT && !process.env.S3_ENDPOINT.includes('amazonaws.com')
    ? {
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
      }
    : {}),
})

interface PdfJobData {
  tenantId: string
  entityType: string
  entityId: string
  templateName: string
}

async function processPdfGeneration(job: Job<PdfJobData>) {
  const { tenantId, entityType, entityId, templateName } = job.data

  console.log(`Generating PDF for ${entityType}:${entityId}`)

  if (entityType === 'order') {
    const order = await db.order.findUnique({
      where: { id: entityId },
      include: { items: true },
    })

    if (!order) {
      throw new Error(`Order ${entityId} not found`)
    }

    // Generate HTML for PDF
    const html = generateInvoiceHTML(order)

    // Generate PDF using Playwright
    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    await page.setContent(html)

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    })

    await browser.close()

    // Upload to S3
    const key = `${tenantId}/pdfs/invoice-${order.orderNumber}-${Date.now()}.pdf`

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      })
    )

    return {
      key,
      filename: `invoice-${order.orderNumber}.pdf`,
    }
  }

  throw new Error(`Unsupported entity type: ${entityType}`)
}

function generateInvoiceHTML(order: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        .header h1 {
          margin: 0;
          color: #2563eb;
        }
        .info {
          margin-bottom: 30px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        th {
          background-color: #f3f4f6;
          font-weight: bold;
        }
        .totals {
          text-align: right;
          margin-top: 20px;
        }
        .totals div {
          margin-bottom: 8px;
        }
        .total {
          font-size: 18px;
          font-weight: bold;
          margin-top: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>INVOICE</h1>
        <p>Order #${order.orderNumber}</p>
      </div>

      <div class="info">
        <div class="info-row">
          <div>
            <strong>Customer:</strong><br>
            ${order.customerName}<br>
            ${order.customerEmail}<br>
            ${order.customerPhone || ''}
          </div>
          <div>
            <strong>Order Date:</strong><br>
            ${new Date(order.createdAt).toLocaleDateString()}<br>
            <strong>Status:</strong> ${order.status.toUpperCase()}
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>SKU</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${order.items
            .map(
              (item: any) => `
            <tr>
              <td>${item.name}</td>
              <td>${item.sku || '-'}</td>
              <td>${item.quantity}</td>
              <td>${order.currency} ${Number(item.unitPrice).toFixed(2)}</td>
              <td>${order.currency} ${Number(item.total).toFixed(2)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <div class="totals">
        <div>Subtotal: ${order.currency} ${Number(order.subtotal).toFixed(2)}</div>
        <div>Tax: ${order.currency} ${Number(order.tax).toFixed(2)}</div>
        <div class="total">Total: ${order.currency} ${Number(order.total).toFixed(2)}</div>
      </div>
    </body>
    </html>
  `
}

export function pdfWorker(connection: Redis) {
  return new Worker<PdfJobData>(
    'pdfs',
    async (job) => {
      const result = await processPdfGeneration(job)
      console.log(`✅ PDF job ${job.id} completed: ${result.filename}`)
      return result
    },
    {
      connection,
      concurrency: 2,
    }
  )
}

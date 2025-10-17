import { Worker, Job } from 'bullmq'
import { db } from '@repo/database'
import { createObjectCsvWriter } from 'csv-writer'
import ExcelJS from 'exceljs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import Redis from 'ioredis'

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

interface ExportJobData {
  tenantId: string
  userId: string
  type: 'csv' | 'excel' | 'pdf'
  entityType: string
  filters?: Record<string, any>
}

async function processExport(job: Job<ExportJobData>) {
  const { tenantId, type, entityType, filters = {} } = job.data

  console.log(`Processing export job ${job.id}: ${type} for ${entityType}`)

  if (entityType === 'orders') {
    // Fetch orders from database
    const orders = await db.order.findMany({
      where: {
        tenantId,
        ...filters,
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Flatten data for export
    const flatData = orders.map((order) => ({
      orderNumber: order.orderNumber,
      status: order.status,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone || '',
      subtotal: order.subtotal.toString(),
      tax: order.tax.toString(),
      total: order.total.toString(),
      currency: order.currency,
      itemCount: order.items.length,
      createdAt: order.createdAt.toISOString(),
    }))

    if (type === 'csv') {
      return await exportToCSV(flatData, tenantId, job.id!)
    } else if (type === 'excel') {
      return await exportToExcel(flatData, tenantId, job.id!)
    }
  }

  throw new Error(`Unsupported entity type: ${entityType}`)
}

async function exportToCSV(data: any[], tenantId: string, jobId: string) {
  const filename = `/tmp/export-${jobId}.csv`

  const csvWriter = createObjectCsvWriter({
    path: filename,
    header: Object.keys(data[0] || {}).map((key) => ({ id: key, title: key })),
  })

  await csvWriter.writeRecords(data)

  // Upload to S3
  const key = `${tenantId}/exports/orders-${Date.now()}.csv`
  await uploadToS3(filename, key, 'text/csv')

  return { key, filename: `orders-${Date.now()}.csv`, type: 'csv' }
}

async function exportToExcel(data: any[], tenantId: string, jobId: string) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Orders')

  // Add headers
  if (data.length > 0) {
    worksheet.columns = Object.keys(data[0]).map((key) => ({
      header: key,
      key,
      width: 20,
    }))

    // Add data
    data.forEach((row) => worksheet.addRow(row))

    // Style headers
    worksheet.getRow(1).font = { bold: true }
  }

  const filename = `/tmp/export-${jobId}.xlsx`
  await workbook.xlsx.writeFile(filename)

  // Upload to S3
  const key = `${tenantId}/exports/orders-${Date.now()}.xlsx`
  await uploadToS3(
    filename,
    key,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )

  return { key, filename: `orders-${Date.now()}.xlsx`, type: 'excel' }
}

async function uploadToS3(localPath: string, key: string, contentType: string) {
  const fs = await import('fs')
  const fileContent = fs.readFileSync(localPath)

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
    })
  )

  // Clean up temp file
  fs.unlinkSync(localPath)
}

export function exportWorker(connection: Redis) {
  return new Worker<ExportJobData>(
    'exports',
    async (job) => {
      const result = await processExport(job)
      console.log(`✅ Export job ${job.id} completed: ${result.filename}`)
      return result
    },
    {
      connection,
      concurrency: 3,
    }
  )
}

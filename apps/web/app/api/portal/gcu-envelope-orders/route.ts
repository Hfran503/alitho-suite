import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { isCustomerRole } from '@/lib/roles'
import { getEmailQueue } from '@/lib/queue'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

// Get base URL for absolute links in emails
function getBaseUrl(): string {
  // Use NEXT_PUBLIC_BASE_URL if set, otherwise default to production domain
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://calithosuite.com'
}

// Generate unique order number (e.g., GCU-2025-001234)
function generateOrderNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, '0')
  return `GCU-${year}-${random}`
}

// Generate email HTML for order notification
function generateOrderEmailHTML(
  order: {
    orderNumber: string
    orderId: string
    quantity: number
    position: string
    address: string
    notes: string | null
    printPdfUrl: string | null
    proofPdfUrl: string | null
    createdByEmail: string
    submittedAt: Date
  },
  baseUrl: string
): string {
  const formattedDate = new Date(order.submittedAt).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  })

  // Convert relative URLs to absolute URLs for email
  const printPdfAbsoluteUrl = order.printPdfUrl ? `${baseUrl}${order.printPdfUrl}` : null
  const proofPdfAbsoluteUrl = order.proofPdfUrl ? `${baseUrl}${order.proofPdfUrl}` : null

  return `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1f2937; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 20px; border: 1px solid #e5e7eb; }
          .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
          .detail-label { font-weight: 600; width: 150px; color: #6b7280; }
          .detail-value { flex: 1; }
          .download-section { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px; }
          .download-button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 8px 8px 8px 0; font-weight: 600; }
          .download-button:hover { background: #2563eb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">New GCU Custom Envelope Order</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">Order #${order.orderNumber}</p>
          </div>

          <div class="content">
            <p style="font-size: 16px; margin-top: 0;">A new custom envelope order has been placed.</p>

            <div style="margin: 24px 0;">
              <div class="detail-row">
                <div class="detail-label">Order Number:</div>
                <div class="detail-value"><strong>${order.orderNumber}</strong></div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Reference ID:</div>
                <div class="detail-value">${order.orderId}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Quantity:</div>
                <div class="detail-value">${order.quantity.toLocaleString()}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Position:</div>
                <div class="detail-value">${order.position === 'center_back_flap' ? 'Center Back Flap' : 'Front'}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Address:</div>
                <div class="detail-value" style="white-space: pre-wrap;">${order.address}</div>
              </div>
              ${order.notes ? `
              <div class="detail-row">
                <div class="detail-label">Notes:</div>
                <div class="detail-value" style="white-space: pre-wrap;">${order.notes}</div>
              </div>
              ` : ''}
              <div class="detail-row">
                <div class="detail-label">Submitted By:</div>
                <div class="detail-value">${order.createdByEmail}</div>
              </div>
              <div class="detail-row" style="border-bottom: none;">
                <div class="detail-label">Submitted At:</div>
                <div class="detail-value">${formattedDate}</div>
              </div>
            </div>

            <div class="download-section">
              <p style="margin: 0 0 12px 0; font-weight: 600; color: #1e40af;">Download Files:</p>
              ${printPdfAbsoluteUrl ? `
                <a href="${printPdfAbsoluteUrl}" class="download-button" target="_blank">
                  📄 Download Print PDF
                </a>
              ` : ''}
              ${proofPdfAbsoluteUrl ? `
                <a href="${proofPdfAbsoluteUrl}" class="download-button" target="_blank">
                  📋 Download Proof PDF
                </a>
              ` : ''}
            </div>

            <div class="alert">
              <p style="margin: 0; font-weight: 600; color: #92400e;">Action Required:</p>
              <p style="margin: 8px 0 0 0; color: #92400e;">Please review this order and begin processing.</p>
            </div>
          </div>

          <div class="footer">
            <p>This is an automated notification from Calitho Suite</p>
            <p>Order Management System</p>
          </div>
        </div>
      </body>
    </html>
  `
}

export async function GET(_req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        memberships: true,
      },
    })

    if (!user || !user.memberships[0]) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const tenantId = user.memberships[0].tenantId

    // Fetch all orders for this tenant, sorted by newest first
    const orders = await db.gcuEnvelopeOrder.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      orders,
    })
  } catch (error) {
    console.error('Error fetching GCU envelope orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify customer role
    const userRole = (session.user as any).role
    if (!isCustomerRole(userRole)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get user's tenant
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        memberships: true,
      },
    })

    if (!user || !user.memberships[0]) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const tenantId = user.memberships[0].tenantId

    // Parse multipart form data
    const formData = await req.formData()
    const orderId = formData.get('orderId') as string
    const quantity = parseInt(formData.get('quantity') as string)
    const position = formData.get('position') as string
    const address = formData.get('address') as string
    const notes = formData.get('notes') as string
    const printPdf = formData.get('printPdf') as File | null
    const proofPdf = formData.get('proofPdf') as File | null

    // Validate required fields
    if (!orderId || !quantity || !position || !address || !printPdf) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate PDF files
    if (printPdf.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Print file must be a PDF' },
        { status: 400 }
      )
    }

    if (printPdf.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      )
    }

    if (proofPdf && proofPdf.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Proof file must be a PDF' },
        { status: 400 }
      )
    }

    if (proofPdf && proofPdf.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      )
    }

    // Generate unique order number
    let orderNumber = generateOrderNumber()
    let attempts = 0
    while (attempts < 10) {
      const existing = await db.gcuEnvelopeOrder.findUnique({
        where: { orderNumber },
      })
      if (!existing) break
      orderNumber = generateOrderNumber()
      attempts++
    }

    if (attempts >= 10) {
      return NextResponse.json(
        { error: 'Failed to generate unique order number' },
        { status: 500 }
      )
    }

    // Save PRINT PDF to local filesystem with formatted filename
    const publicDir = join(process.cwd(), 'public')
    const gcuPdfsDir = join(publicDir, 'gcu-envelope-pdfs')

    // Create directory if it doesn't exist
    if (!existsSync(gcuPdfsDir)) {
      await mkdir(gcuPdfsDir, { recursive: true })
    }

    const printBuffer = Buffer.from(await printPdf.arrayBuffer())
    const printFileName = `${orderId} - ${quantity} - print.pdf`
    const printFilePath = join(gcuPdfsDir, printFileName)

    await writeFile(printFilePath, printBuffer)
    console.log(`✓ Saved print PDF: ${printFilePath} (${printBuffer.length} bytes)`)

    // Add cache-busting timestamp to URLs
    const timestamp = Date.now()
    const printPdfUrl = `/api/gcu-envelope-pdfs/${encodeURIComponent(printFileName)}?t=${timestamp}`

    // Save PROOF PDF to local filesystem (optional) with formatted filename
    let proofPdfUrl: string | null = null

    if (proofPdf) {
      const proofBuffer = Buffer.from(await proofPdf.arrayBuffer())
      const proofFileName = `${orderId} - ${quantity} - proof.pdf`
      const proofFilePath = join(gcuPdfsDir, proofFileName)

      await writeFile(proofFilePath, proofBuffer)
      console.log(`✓ Saved proof PDF: ${proofFilePath} (${proofBuffer.length} bytes)`)

      proofPdfUrl = `/api/gcu-envelope-pdfs/${encodeURIComponent(proofFileName)}?t=${timestamp}`
    } else {
      console.log('ℹ No proof PDF provided with this order')
    }

    // Create order in database
    const order = await db.gcuEnvelopeOrder.create({
      data: {
        orderNumber,
        orderId,
        quantity,
        position,
        address,
        notes: notes || null,
        printPdfBucket: null, // Not using S3 anymore
        printPdfKey: null, // Not using S3 anymore
        printPdfUrl,
        proofPdfBucket: null, // Not using S3 anymore
        proofPdfKey: null, // Not using S3 anymore
        proofPdfUrl,
        isApproved: true,
        approvedAt: new Date(),
        status: 'ordered',
        tenantId,
        createdBy: user.id,
        createdByEmail: user.email,
        submittedAt: new Date(),
      },
    })

    // Send email notification
    try {
      const emailQueue = await getEmailQueue()
      const baseUrl = getBaseUrl()
      const emailHTML = generateOrderEmailHTML({
        orderNumber: order.orderNumber,
        orderId: order.orderId,
        quantity: order.quantity,
        position: order.position,
        address: order.address,
        notes: order.notes,
        printPdfUrl: order.printPdfUrl,
        proofPdfUrl: order.proofPdfUrl,
        createdByEmail: order.createdByEmail,
        submittedAt: order.submittedAt!,
      }, baseUrl)

      await emailQueue.add('send-email', {
        to: ['david.curiel@calitho.com', 'dhara@calitho.com', 'hector.franco@calitho.com'],
        subject: `New GCU Envelope Order - ${order.orderNumber}`,
        html: emailHTML,
        text: `New GCU custom envelope order ${order.orderNumber} has been placed. Please view this email in HTML format for full details.`,
        tenantId,
      }, {
        priority: 1, // High priority (lower number = higher priority)
        attempts: 3, // Retry up to 3 times if it fails
        backoff: {
          type: 'exponential',
          delay: 2000, // 2 second initial delay between retries
        },
        removeOnComplete: true, // Clean up completed jobs
        removeOnFail: false, // Keep failed jobs for debugging
      })

      console.log(`✓ Queued email notification for order ${order.orderNumber}`)
    } catch (emailError) {
      // Log error but don't fail the order creation
      console.error('Failed to queue email notification:', emailError)
    }

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      orderId: order.id,
      status: order.status,
      message: 'Order placed successfully',
    })
  } catch (error) {
    console.error('Error creating GCU envelope order:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}

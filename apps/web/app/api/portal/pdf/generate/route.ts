import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db as prisma } from '@repo/database'
import { isCustomerRole } from '@/lib/roles'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// Configuration - Print area dimensions (in inches, converted to points: 1 inch = 72 points)
const PRINT_WIDTH = 7.25 * 72 // 522 points
const PRINT_HEIGHT = 5.25 * 72 // 378 points

// Crop mark settings
const CROP_MARK_MARGIN = 0.335 * 72 // 0.335 inch margin for crop marks on each side
const CROP_MARK_LENGTH = 0.25 * 72 // Length of the crop mark lines
const CROP_MARK_OFFSET = 0.0625 * 72 // Distance from edge to crop mark

// Page dimensions for proof (print area + crop marks on each side)
const PAGE_WIDTH = PRINT_WIDTH + 2 * CROP_MARK_MARGIN
const PAGE_HEIGHT = PRINT_HEIGHT + 2 * CROP_MARK_MARGIN

interface GeneratePdfRequest {
  orderId: string
  quantity: number
  position: 'center back flap' | 'front'
  address: string
  version: 'proof' | 'print'
}

/**
 * Draw crop marks at the corners of the page
 */
function drawCropMarks(page: any) {
  const printX = CROP_MARK_MARGIN
  const printY = CROP_MARK_MARGIN
  const printWidth = PAGE_WIDTH - 2 * CROP_MARK_MARGIN
  const printHeight = PAGE_HEIGHT - 2 * CROP_MARK_MARGIN

  const BLACK = rgb(0, 0, 0)
  const lineWidth = 0.5

  const corners = [
    { x: printX, y: printY },
    { x: printX + printWidth, y: printY },
    { x: printX, y: printY + printHeight },
    { x: printX + printWidth, y: printY + printHeight },
  ]

  corners.forEach(({ x: cx, y: cy }) => {
    // Horizontal marks
    if (cx === printX) {
      page.drawLine({
        start: { x: cx - CROP_MARK_OFFSET - CROP_MARK_LENGTH, y: cy },
        end: { x: cx - CROP_MARK_OFFSET, y: cy },
        thickness: lineWidth,
        color: BLACK,
      })
    } else {
      page.drawLine({
        start: { x: cx + CROP_MARK_OFFSET, y: cy },
        end: { x: cx + CROP_MARK_OFFSET + CROP_MARK_LENGTH, y: cy },
        thickness: lineWidth,
        color: BLACK,
      })
    }

    // Vertical marks
    if (cy === printY) {
      page.drawLine({
        start: { x: cx, y: cy - CROP_MARK_OFFSET - CROP_MARK_LENGTH },
        end: { x: cx, y: cy - CROP_MARK_OFFSET },
        thickness: lineWidth,
        color: BLACK,
      })
    } else {
      page.drawLine({
        start: { x: cx, y: cy + CROP_MARK_OFFSET },
        end: { x: cx, y: cy + CROP_MARK_OFFSET + CROP_MARK_LENGTH },
        thickness: lineWidth,
        color: BLACK,
      })
    }
  })
}

/**
 * Draw a red rectangle showing the print area
 */
function drawPrintArea(page: any) {
  const printX = CROP_MARK_MARGIN
  const printY = CROP_MARK_MARGIN
  const printWidth = PAGE_WIDTH - 2 * CROP_MARK_MARGIN
  const printHeight = PAGE_HEIGHT - 2 * CROP_MARK_MARGIN

  page.drawRectangle({
    x: printX,
    y: printY,
    width: printWidth,
    height: printHeight,
    borderColor: rgb(1, 0, 0),
    borderWidth: 1,
  })
}

/**
 * Add centered address text (for back flap)
 */
function addCenteredAddress(
  page: any,
  font: any,
  addressText: string,
  pageWidth: number,
  pageHeight: number,
  includeCropOffset: boolean
) {
  const lines = addressText.split('\n').filter((line) => line.trim())
  const fontSize = 12
  const lineHeight = fontSize * 1.5

  const cropOffset = includeCropOffset ? CROP_MARK_MARGIN : 0
  const startY = pageHeight - cropOffset - 0.93 * 72

  lines.forEach((line, i) => {
    const text = line.trim()
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    const xPos = (pageWidth - textWidth) / 2
    const yPos = startY - i * lineHeight

    page.drawText(text, {
      x: xPos,
      y: yPos,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0),
    })
  })
}

/**
 * Add front address text (left-aligned)
 */
function addFrontAddress(
  page: any,
  font: any,
  addressText: string,
  pageHeight: number,
  includeCropOffset: boolean
) {
  const lines = addressText.split('\n').filter((line) => line.trim())
  const fontSize = 12
  const lineHeight = fontSize * 1.5

  const cropOffset = includeCropOffset ? CROP_MARK_MARGIN : 0
  const startX = cropOffset + 0.28 * 72
  const startY = pageHeight - cropOffset - 0.18 * 72

  lines.forEach((line, i) => {
    const text = line.trim()
    const yPos = startY - i * lineHeight

    page.drawText(text, {
      x: startX,
      y: yPos,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0),
    })
  })
}

export async function POST(request: Request) {
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

    // Check if user has access to PDF generator feature
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        paceCustomerId: true,
        memberships: {
          include: { tenant: true },
        },
      },
    })

    if (!user || !user.memberships[0]) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const tenantId = user.memberships[0].tenantId

    // Check if GCU envelope order page is enabled and visible to this user
    const pdfGeneratorPage = await prisma.portalPageConfiguration.findFirst({
      where: {
        tenantId,
        pageKey: 'gcu-custom-envelope-new-order',
        isActive: true,
      },
    })

    if (!pdfGeneratorPage) {
      return NextResponse.json(
        { error: 'GCU Custom Envelope Orders feature is not enabled' },
        { status: 403 }
      )
    }

    // Check visibility permissions
    let hasAccess = false

    switch (pdfGeneratorPage.visibilityMode) {
      case 'all':
        hasAccess = true
        break
      case 'pace_ids':
        hasAccess =
          !!user.paceCustomerId &&
          pdfGeneratorPage.allowedPaceCustomerIds.includes(user.paceCustomerId)
        break
      case 'user_ids':
        hasAccess = pdfGeneratorPage.allowedUserIds.includes(user.id)
        break
      case 'user_emails':
        hasAccess = pdfGeneratorPage.allowedUserEmails.includes(user.email)
        break
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to the PDF Generator feature' },
        { status: 403 }
      )
    }

    // Parse request body
    const body: GeneratePdfRequest = await request.json()
    const { orderId, position, address, version } = body

    // Validate input
    if (!orderId || !position || !address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create PDF document
    const isProof = version === 'proof'
    const pageWidth = isProof ? PAGE_WIDTH : PRINT_WIDTH
    const pageHeight = isProof ? PAGE_HEIGHT : PRINT_HEIGHT

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([pageWidth, pageHeight])
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman)

    // For proof version: draw crop marks and print area
    if (isProof) {
      drawPrintArea(page)
      drawCropMarks(page)
    }

    // Add address based on position
    if (position === 'center back flap') {
      addCenteredAddress(page, font, address, pageWidth, pageHeight, isProof)
    } else if (position === 'front') {
      addFrontAddress(page, font, address, pageHeight, isProof)
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save()

    // Return PDF with appropriate headers
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Order_${orderId}_${version.toUpperCase()}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}

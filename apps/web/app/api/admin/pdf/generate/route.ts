import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/authorization'
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
  // Define the print area (where crop marks point to)
  const printX = CROP_MARK_MARGIN
  const printY = CROP_MARK_MARGIN
  const printWidth = PAGE_WIDTH - 2 * CROP_MARK_MARGIN
  const printHeight = PAGE_HEIGHT - 2 * CROP_MARK_MARGIN

  const BLACK = rgb(0, 0, 0)
  const lineWidth = 0.5

  // Corner positions for the print area
  const corners = [
    { x: printX, y: printY }, // Bottom-left (PDF coords start bottom-left)
    { x: printX + printWidth, y: printY }, // Bottom-right
    { x: printX, y: printY + printHeight }, // Top-left
    { x: printX + printWidth, y: printY + printHeight }, // Top-right
  ]

  corners.forEach(({ x: cx, y: cy }) => {
    // Horizontal marks
    if (cx === printX) {
      // Left side - mark extends to the left
      page.drawLine({
        start: { x: cx - CROP_MARK_OFFSET - CROP_MARK_LENGTH, y: cy },
        end: { x: cx - CROP_MARK_OFFSET, y: cy },
        thickness: lineWidth,
        color: BLACK,
      })
    } else {
      // Right side - mark extends to the right
      page.drawLine({
        start: { x: cx + CROP_MARK_OFFSET, y: cy },
        end: { x: cx + CROP_MARK_OFFSET + CROP_MARK_LENGTH, y: cy },
        thickness: lineWidth,
        color: BLACK,
      })
    }

    // Vertical marks
    if (cy === printY) {
      // Bottom side - mark extends downward
      page.drawLine({
        start: { x: cx, y: cy - CROP_MARK_OFFSET - CROP_MARK_LENGTH },
        end: { x: cx, y: cy - CROP_MARK_OFFSET },
        thickness: lineWidth,
        color: BLACK,
      })
    } else {
      // Top side - mark extends upward
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
    borderColor: rgb(1, 0, 0), // Red
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
  const startY = pageHeight - cropOffset - 0.93 * 72 // 0.93 inches from top of print area

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
  const startX = cropOffset + 0.28 * 72 // 0.28 inches from left edge of print area
  const startY = pageHeight - cropOffset - 0.18 * 72 // 0.18 inches from top edge of print area

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
    // Check admin authorization
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.error
    }

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

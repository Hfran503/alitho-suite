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
 * Draw envelope flap visualization (for back flap position only)
 * Flap is 2.50 inches tall, shown as a rectangular area at the top
 */
function drawEnvelopeFlap(page: any) {
  const FLAP_HEIGHT = 2.50 * 72 // 2.50 inches = 180 points
  const FOLD_MARGIN = 0.12 * 72 // 0.12 inch margin on each side of fold line

  const printX = CROP_MARK_MARGIN
  const printY = CROP_MARK_MARGIN
  const printWidth = PAGE_WIDTH - 2 * CROP_MARK_MARGIN
  const printHeight = PAGE_HEIGHT - 2 * CROP_MARK_MARGIN

  // Top of the envelope (where flap edge is)
  const envelopeTop = printY + printHeight

  // Flap fold line (where it folds down)
  const flapFoldY = envelopeTop - FLAP_HEIGHT

  // Draw rectangular flap outline with solid red lines
  // Left side
  page.drawLine({
    start: { x: printX, y: flapFoldY },
    end: { x: printX, y: envelopeTop },
    thickness: 1,
    color: rgb(1, 0, 0), // Red color to match print area
  })

  // Right side
  page.drawLine({
    start: { x: printX + printWidth, y: flapFoldY },
    end: { x: printX + printWidth, y: envelopeTop },
    thickness: 1,
    color: rgb(1, 0, 0),
  })

  // Top edge
  page.drawLine({
    start: { x: printX, y: envelopeTop },
    end: { x: printX + printWidth, y: envelopeTop },
    thickness: 1,
    color: rgb(1, 0, 0),
  })

  // Fold line (base of the flap) with 0.12" margins on each side
  page.drawLine({
    start: { x: printX + FOLD_MARGIN, y: flapFoldY },
    end: { x: printX + printWidth - FOLD_MARGIN, y: flapFoldY },
    thickness: 1,
    color: rgb(1, 0, 0),
  })

  // Diagonal connector from left side top to fold line start (left slant)
  page.drawLine({
    start: { x: printX, y: envelopeTop },
    end: { x: printX + FOLD_MARGIN, y: flapFoldY },
    thickness: 1,
    color: rgb(1, 0, 0),
  })

  // Diagonal connector from right side top to fold line end (right slant)
  page.drawLine({
    start: { x: printX + printWidth, y: envelopeTop },
    end: { x: printX + printWidth - FOLD_MARGIN, y: flapFoldY },
    thickness: 1,
    color: rgb(1, 0, 0),
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
  const fontSize = 14
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
  const startY = pageHeight - cropOffset - 0.28 * 72 - fontSize

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

/**
 * Generate a GCU envelope PDF (proof or print version)
 * @param _orderId - The order reference ID (for future use/logging)
 * @param position - Address position: 'center back flap', 'center_back_flap', or 'front'
 * @param address - The address text to print
 * @param version - 'proof' (with crop marks) or 'print' (final size)
 * @returns Buffer containing the PDF
 */
export async function generateGcuEnvelopePdf(
  _orderId: string,
  position: string,
  address: string,
  version: 'proof' | 'print'
): Promise<Buffer> {
  const isProof = version === 'proof'
  const pageWidth = isProof ? PAGE_WIDTH : PRINT_WIDTH
  const pageHeight = isProof ? PAGE_HEIGHT : PRINT_HEIGHT

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([pageWidth, pageHeight])
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman)

  // Normalize position early to use throughout
  const normalizedPosition = position.toLowerCase().replace(/_/g, ' ').trim()
  console.log(`PDF Generator - Position: "${position}" -> Normalized: "${normalizedPosition}"`)

  // For proof version: draw crop marks, print area, and flap (if back flap)
  if (isProof) {
    drawPrintArea(page)
    drawCropMarks(page)

    // Draw envelope flap visualization for back flap position only
    if (normalizedPosition === 'center back flap') {
      drawEnvelopeFlap(page)
    }
  }

  // Add address based on position (handle both formats)
  if (normalizedPosition === 'center back flap') {
    console.log('Using centered address layout (back flap)')
    addCenteredAddress(page, font, address, pageWidth, pageHeight, isProof)
  } else if (normalizedPosition === 'front') {
    console.log('Using front address layout')
    addFrontAddress(page, font, address, pageHeight, isProof)
  } else {
    console.warn(`Unknown position: "${normalizedPosition}" - defaulting to center back flap`)
    addCenteredAddress(page, font, address, pageWidth, pageHeight, isProof)
  }

  // Generate PDF bytes
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

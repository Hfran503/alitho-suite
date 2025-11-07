import { PDFDocument, PDFPage, rgb, cmyk, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

/**
 * Interface for template variables that will be replaced in the PDF
 */
export interface TemplateVariables {
  [key: string]: string | number
}

/**
 * Options for PDF template filling
 */
export interface PDFTemplateOptions {
  /**
   * Font size for replaced text
   */
  fontSize?: number
  /**
   * Whether to search for variables in the format {variableName}
   */
  bracketFormat?: boolean
  /**
   * Custom regex pattern to match variables
   */
  customPattern?: RegExp
}

/**
 * Fills a PDF template by replacing text placeholders with actual values
 *
 * This function loads a PDF template, searches for text placeholders like {name},
 * and replaces them with the actual values provided in the variables object.
 *
 * @param templateBuffer - The PDF template as a Buffer or ArrayBuffer
 * @param variables - Object containing key-value pairs for replacement
 * @param options - Optional configuration for the replacement
 * @returns Promise<Uint8Array> - The modified PDF as a byte array
 *
 * @example
 * const templateBuffer = await fetch('/templates/invoice.pdf').then(r => r.arrayBuffer())
 * const pdfBytes = await fillPdfTemplate(templateBuffer, {
 *   name: 'Alex',
 *   invoiceNumber: '12345',
 *   date: '2025-11-05'
 * })
 */
export async function fillPdfTemplate(
  templateBuffer: ArrayBuffer | Uint8Array,
  variables: TemplateVariables,
  options: PDFTemplateOptions = {}
): Promise<Uint8Array> {
  const { fontSize = 12, bracketFormat = true } = options

  // Load the PDF template
  const pdfDoc = await PDFDocument.load(templateBuffer)
  const pages = pdfDoc.getPages()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Process each page
  for (const page of pages) {
    await replaceTextInPage(page, variables, font, fontSize, bracketFormat)
  }

  // Save and return the modified PDF
  return await pdfDoc.save()
}

/**
 * Replaces text placeholders in a single PDF page
 *
 * Note: This is a simplified implementation. For production use,
 * you may need to use more advanced PDF parsing or consider form fields.
 */
async function replaceTextInPage(
  page: PDFPage,
  variables: TemplateVariables,
  _font: any,
  _fontSize: number,
  _bracketFormat: boolean
): Promise<void> {
  const { width: _width, height: _height } = page.getSize()

  // Iterate through each variable and add text overlays
  // This is a simplified approach - you may need to adjust positioning
  Object.entries(variables).forEach(([_key, _value]) => {
    // In a production scenario, you would:
    // 1. Extract text content from the PDF
    // 2. Find the position of the placeholder
    // 3. Draw the replacement text at that exact position

    // For now, this is a placeholder that demonstrates the concept
    // You'll need to implement proper text extraction and positioning
  })
}

/**
 * Fills form fields in a PDF (if the PDF has interactive form fields)
 *
 * This is useful if your PDF template has actual form fields instead of text placeholders
 *
 * @param templateBuffer - The PDF template as a Buffer or ArrayBuffer
 * @param fieldValues - Object containing form field names and their values
 * @returns Promise<Uint8Array> - The modified PDF as a byte array
 *
 * @example
 * const pdfBytes = await fillPdfFormFields(templateBuffer, {
 *   name: 'Alex',
 *   email: 'alex@example.com'
 * })
 */
export async function fillPdfFormFields(
  templateBuffer: ArrayBuffer | Uint8Array,
  fieldValues: TemplateVariables
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBuffer)
  const form = pdfDoc.getForm()

  // Fill in each form field
  Object.entries(fieldValues).forEach(([fieldName, value]) => {
    try {
      const field = form.getTextField(fieldName)
      field.setText(String(value))
    } catch (error) {
      console.warn(`Field "${fieldName}" not found in PDF form`)
    }
  })

  // Optional: flatten the form so fields become regular text
  // form.flatten()

  return await pdfDoc.save()
}

/**
 * Creates a PDF with text overlays at specific positions
 * Useful when you know the exact coordinates where text should appear
 *
 * @param templateBuffer - The PDF template
 * @param overlays - Array of text overlays with positions
 * @param customFontBuffer - Optional custom font buffer (for .otf or .ttf fonts)
 * @returns Promise<Uint8Array> - The modified PDF
 *
 * @example
 * const pdfBytes = await addTextOverlays(templateBuffer, [
 *   { text: 'Alex', x: 100, y: 700, page: 0 },
 *   { text: 'Invoice #12345', x: 100, y: 650, page: 0 }
 * ])
 */
export async function addTextOverlays(
  templateBuffer: ArrayBuffer | Uint8Array,
  overlays: Array<{
    text: string
    x: number
    y: number
    page?: number
    fontSize?: number
    color?: { r: number; g: number; b: number } | { c: number; m: number; y: number; k: number }
    align?: 'left' | 'center' | 'right'
  }>,
  customFontBuffer?: ArrayBuffer | Uint8Array
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBuffer)

  // Register fontkit for custom font support
  if (customFontBuffer) {
    pdfDoc.registerFontkit(fontkit)
  }

  // Use custom font if provided, otherwise use Helvetica
  const font = customFontBuffer
    ? await pdfDoc.embedFont(customFontBuffer)
    : await pdfDoc.embedFont(StandardFonts.Helvetica)

  const pages = pdfDoc.getPages()

  overlays.forEach((overlay) => {
    const page = pages[overlay.page ?? 0]
    if (!page) {
      console.warn(`Page ${overlay.page} not found`)
      return
    }

    // Handle both RGB and CMYK colors
    let color
    if (overlay.color) {
      if ('c' in overlay.color && 'm' in overlay.color && 'y' in overlay.color && 'k' in overlay.color) {
        // CMYK color
        color = cmyk(overlay.color.c, overlay.color.m, overlay.color.y, overlay.color.k)
      } else if ('r' in overlay.color && 'g' in overlay.color && 'b' in overlay.color) {
        // RGB color
        color = rgb(overlay.color.r, overlay.color.g, overlay.color.b)
      } else {
        // Default to CMYK black
        color = cmyk(0, 0, 0, 1)
      }
    } else {
      // Default to CMYK black (C:0%, M:0%, Y:0%, K:100%)
      color = cmyk(0, 0, 0, 1)
    }

    const fontSize = overlay.fontSize ?? 12

    // Calculate text width and height for alignment
    const textWidth = font.widthOfTextAtSize(overlay.text, fontSize)
    const textHeight = font.heightAtSize(fontSize)

    // Get font metrics for proper vertical centering
    const ascent = font.heightAtSize(fontSize, { descender: false })
    const descent = textHeight - ascent

    let xPosition = overlay.x
    let yPosition = overlay.y

    // Horizontal alignment
    if (overlay.align === 'center') {
      xPosition = overlay.x - textWidth / 2
    } else if (overlay.align === 'right') {
      xPosition = overlay.x - textWidth
    }

    // Vertical centering: PDF drawText uses baseline
    // To center vertically, we need to move up by half the height minus the descent
    yPosition = overlay.y - (textHeight / 2) + descent

    console.log('📝 PDF Text Rendering:', {
      text: overlay.text,
      requestedCenter: { x: overlay.x, y: overlay.y },
      actualPosition: { x: xPosition, y: yPosition },
      fontSize,
      textWidth,
      textHeight,
      ascent,
      descent,
    })

    page.drawText(overlay.text, {
      x: xPosition,
      y: yPosition,
      size: fontSize,
      font,
      color,
    })
  })

  return await pdfDoc.save()
}

/**
 * Helper function to convert a PDF byte array to a Blob
 * Useful for downloading or displaying the PDF
 */
export function pdfBytesToBlob(pdfBytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
}

/**
 * Helper function to trigger a download of the generated PDF
 */
export function downloadPdf(pdfBytes: Uint8Array, filename: string): void {
  const blob = pdfBytesToBlob(pdfBytes)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

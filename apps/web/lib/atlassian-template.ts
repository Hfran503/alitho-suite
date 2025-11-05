import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

/**
 * Generates a welcome PDF from the Atlassian template
 * Replaces {name} on page 1 with the actual person's name
 *
 * @param name - The person's name to insert (e.g., "Alex")
 * @returns Promise<Uint8Array> - The generated PDF bytes
 *
 * @example
 * const pdfBytes = await generateAtlassianWelcome('Alex')
 * // Downloads: "Welcome to the team, Alex!"
 */
export async function generateAtlassianWelcome(
  name: string
): Promise<Uint8Array> {
  // Load the template
  const templatePath = '/templates/Atlassian_Template.pdf'
  const response = await fetch(templatePath)
  const templateBuffer = await response.arrayBuffer()

  const pdfDoc = await PDFDocument.load(templateBuffer)
  const pages = pdfDoc.getPages()
  const firstPage = pages[0]

  // Embed font
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Get page dimensions
  const { width, height } = firstPage.getSize()

  // Strategy 1: Try to fill form field if it exists
  try {
    const form = pdfDoc.getForm()
    const nameField = form.getTextField('name')
    nameField.setText(name)
    return await pdfDoc.save()
  } catch (error) {
    // No form field found, use overlay method
  }

  // Strategy 2: Overlay method
  // First, cover {name} with a white rectangle
  const centerX = width / 2

  // Cover the {name} placeholder with white rectangle
  firstPage.drawRectangle({
    x: centerX - 150, // Adjust based on actual position
    y: height / 2 - 50, // Adjust based on actual position
    width: 300,
    height: 100,
    color: rgb(1, 1, 1), // White
  })

  // Draw the actual name
  const nameWidth = font.widthOfTextAtSize(name, 72)
  firstPage.drawText(name, {
    x: centerX - nameWidth / 2, // Center the text
    y: height / 2 - 20, // Adjust to match original position
    size: 72,
    font: font,
    color: rgb(0, 0, 0), // Black
  })

  return await pdfDoc.save()
}

/**
 * More precise version using exact coordinates
 * You'll need to adjust these coordinates based on your actual PDF
 */
export async function generateAtlassianWelcomeWithCoordinates(
  name: string,
  options: {
    x?: number
    y?: number
    fontSize?: number
    coverX?: number
    coverY?: number
    coverWidth?: number
    coverHeight?: number
  } = {}
): Promise<Uint8Array> {
  const templatePath = '/templates/Atlassian_Template.pdf'
  const response = await fetch(templatePath)
  const templateBuffer = await response.arrayBuffer()

  const pdfDoc = await PDFDocument.load(templateBuffer)
  const pages = pdfDoc.getPages()
  const firstPage = pages[0]
  const { width, height } = firstPage.getSize()

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Default coordinates (you may need to adjust these)
  const fontSize = options.fontSize ?? 72
  const nameX = options.x ?? width / 2
  const nameY = options.y ?? height / 2 - 20

  // Cover the {name} placeholder if coordinates provided
  if (options.coverX !== undefined && options.coverY !== undefined) {
    firstPage.drawRectangle({
      x: options.coverX,
      y: options.coverY,
      width: options.coverWidth ?? 300,
      height: options.coverHeight ?? 100,
      color: rgb(1, 1, 1), // White background
    })
  }

  // Draw the name
  const nameWidth = font.widthOfTextAtSize(name, fontSize)
  firstPage.drawText(name, {
    x: nameX - nameWidth / 2, // Center horizontally
    y: nameY,
    size: fontSize,
    font: font,
    color: rgb(0, 0, 0),
  })

  return await pdfDoc.save()
}

/**
 * Helper to download the Atlassian welcome PDF
 */
export async function downloadAtlassianWelcome(name: string): Promise<void> {
  const pdfBytes = await generateAtlassianWelcome(name)
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `welcome-${name.toLowerCase().replace(/\s+/g, '-')}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}

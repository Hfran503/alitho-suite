/**
 * Client-side utilities for interacting with the PDF generation API
 *
 * These functions can be used anywhere in your React components
 */

export interface GeneratePdfOptions {
  /**
   * URL to fetch the template from (e.g., '/templates/invoice.pdf')
   */
  templateUrl?: string

  /**
   * Base64 encoded PDF template file
   */
  templateFile?: string

  /**
   * Method to use for filling the PDF
   * - 'form': Uses form fields in the PDF
   * - 'overlay': Places text at specific coordinates
   */
  method?: 'form' | 'overlay'

  /**
   * Data to fill in the template
   */
  data: Record<string, string | number>

  /**
   * Text overlays (only used when method is 'overlay')
   */
  overlays?: Array<{
    text: string
    x: number
    y: number
    page?: number
    fontSize?: number
    color?: { r: number; g: number; b: number }
  }>

  /**
   * Optional filename for the downloaded PDF
   */
  filename?: string

  /**
   * Whether to automatically download the PDF
   * If false, returns the Blob instead
   */
  autoDownload?: boolean
}

/**
 * Generate a PDF from a template and download it
 *
 * @example
 * // Simple form field replacement
 * await generatePdf({
 *   templateUrl: '/templates/invoice.pdf',
 *   data: {
 *     name: 'Alex',
 *     invoiceNumber: '12345'
 *   }
 * })
 *
 * @example
 * // Using text overlays at specific positions
 * await generatePdf({
 *   templateUrl: '/templates/certificate.pdf',
 *   method: 'overlay',
 *   data: {},
 *   overlays: [
 *     { text: 'Alex', x: 300, y: 400, fontSize: 24 }
 *   ]
 * })
 */
export async function generatePdf(
  options: GeneratePdfOptions
): Promise<Blob | void> {
  const {
    templateUrl,
    templateFile,
    method = 'form',
    data,
    overlays,
    filename,
    autoDownload = true,
  } = options

  if (!templateUrl && !templateFile) {
    throw new Error('Either templateUrl or templateFile is required')
  }

  const response = await fetch('/api/pdf/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      templateUrl,
      templateFile,
      method,
      data,
      overlays,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.error || `Failed to generate PDF: ${response.statusText}`
    )
  }

  const blob = await response.blob()

  if (autoDownload) {
    downloadBlob(blob, filename || `document-${Date.now()}.pdf`)
  } else {
    return blob
  }
}

/**
 * Generate a PDF and open it in a new tab instead of downloading
 */
export async function generateAndViewPdf(
  options: Omit<GeneratePdfOptions, 'autoDownload'>
): Promise<void> {
  const blob = await generatePdf({ ...options, autoDownload: false })
  if (blob) {
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/**
 * Helper function to download a Blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Convert a File to base64 string
 * Useful when uploading PDF templates
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

/**
 * Quick helper for simple name replacement example
 *
 * @example
 * await generateInvoicePdf('Alex', '12345')
 */
export async function generateInvoicePdf(
  name: string,
  invoiceNumber: string
): Promise<void> {
  await generatePdf({
    templateUrl: '/templates/invoice-template.pdf',
    data: {
      name,
      invoiceNumber,
      date: new Date().toLocaleDateString(),
    },
    filename: `invoice-${invoiceNumber}.pdf`,
  })
}

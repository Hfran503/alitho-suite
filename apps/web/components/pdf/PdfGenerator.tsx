'use client'

import { useState } from 'react'

/**
 * Example React component for generating PDFs from templates
 *
 * This component demonstrates three methods:
 * 1. Using form fields in the PDF
 * 2. Using text overlays at specific coordinates
 * 3. Uploading a template file
 */
export function PdfGenerator() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Method 1: Generate PDF using form fields
   * Use this if your PDF template has interactive form fields
   */
  const generatePdfWithFormFields = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // You can use a URL to a template stored in your public folder or S3
          templateUrl: '/templates/invoice-template.pdf',
          method: 'form',
          data: {
            name: 'Alex',
            email: 'alex@example.com',
            invoiceNumber: '12345',
            date: new Date().toLocaleDateString(),
            amount: '$1,234.56',
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate PDF')
      }

      // Download the PDF
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `document-${Date.now()}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Method 2: Generate PDF using text overlays
   * Use this when you know the exact coordinates where text should appear
   */
  const generatePdfWithOverlays = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateUrl: '/templates/invoice-template.pdf',
          method: 'overlay',
          data: {}, // Still required but can be empty for overlay method
          overlays: [
            {
              text: 'Alex',
              x: 150,
              y: 700,
              page: 0,
              fontSize: 14,
              color: { r: 0, g: 0, b: 0 },
            },
            {
              text: 'Invoice #12345',
              x: 150,
              y: 650,
              page: 0,
              fontSize: 12,
            },
            {
              text: new Date().toLocaleDateString(),
              x: 150,
              y: 600,
              page: 0,
            },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `document-overlay-${Date.now()}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Method 3: Upload and fill a PDF template
   */
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      // Convert file to base64
      const base64 = await fileToBase64(file)

      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateFile: base64,
          method: 'form',
          data: {
            name: 'Alex',
            company: 'Calitho',
            date: new Date().toLocaleDateString(),
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `filled-${file.name}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-2xl font-bold">PDF Generator</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">
            Method 1: Form Fields
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Use this if your PDF has interactive form fields
          </p>
          <button
            onClick={generatePdfWithFormFields}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
          >
            {loading ? 'Generating...' : 'Generate PDF (Form Fields)'}
          </button>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Method 2: Overlays</h3>
          <p className="text-sm text-gray-600 mb-3">
            Use this to place text at specific coordinates
          </p>
          <button
            onClick={generatePdfWithOverlays}
            disabled={loading}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-300"
          >
            {loading ? 'Generating...' : 'Generate PDF (Overlays)'}
          </button>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">
            Method 3: Upload Template
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Upload your own PDF template to fill
          </p>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={loading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
          />
        </div>
      </div>
    </div>
  )
}

// Helper function to convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

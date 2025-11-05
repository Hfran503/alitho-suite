/**
 * PDF Generation Usage Examples
 *
 * This file contains various examples of how to use the PDF generation system
 * Copy and adapt these examples to your specific needs
 */

'use client'

import { generatePdf, generateAndViewPdf, fileToBase64 } from '@/lib/client/pdf-api'

// ============================================================================
// EXAMPLE 1: Simple name replacement (like your {name} -> Alex example)
// ============================================================================

export async function generateCertificate() {
  await generatePdf({
    templateUrl: '/templates/certificate.pdf', // Put your PDF in public/templates/
    data: {
      name: 'Alex', // This replaces {name} with "Alex"
      date: new Date().toLocaleDateString(),
      title: 'Certificate of Achievement',
    },
    filename: 'certificate-alex.pdf',
  })
}

// ============================================================================
// EXAMPLE 2: Invoice generation with multiple fields
// ============================================================================

export async function generateInvoice(customerData: {
  name: string
  email: string
  invoiceNumber: string
  amount: number
}) {
  await generatePdf({
    templateUrl: '/templates/invoice-template.pdf',
    data: {
      name: customerData.name, // {name} -> "Alex"
      email: customerData.email, // {email} -> "alex@example.com"
      invoiceNumber: customerData.invoiceNumber, // {invoiceNumber} -> "12345"
      amount: `$${customerData.amount.toFixed(2)}`, // {amount} -> "$1,234.56"
      date: new Date().toLocaleDateString(),
    },
    filename: `invoice-${customerData.invoiceNumber}.pdf`,
  })
}

// Usage:
// await generateInvoice({
//   name: 'Alex',
//   email: 'alex@example.com',
//   invoiceNumber: 'INV-12345',
//   amount: 1234.56
// })

// ============================================================================
// EXAMPLE 3: Using text overlays when you know exact positions
// ============================================================================

export async function generateCertificateWithOverlay(name: string) {
  await generatePdf({
    templateUrl: '/templates/certificate.pdf',
    method: 'overlay',
    data: {}, // Required but can be empty
    overlays: [
      {
        text: name, // "Alex"
        x: 300, // X coordinate (pixels from left)
        y: 400, // Y coordinate (pixels from bottom)
        fontSize: 24,
        color: { r: 0, g: 0, b: 0 }, // Black
      },
      {
        text: new Date().toLocaleDateString(),
        x: 300,
        y: 350,
        fontSize: 12,
      },
    ],
    filename: `certificate-${name}.pdf`,
  })
}

// ============================================================================
// EXAMPLE 4: Upload and fill a custom template
// ============================================================================

export async function handleTemplateUpload(
  file: File,
  customerName: string
) {
  // Convert uploaded file to base64
  const base64Template = await fileToBase64(file)

  // Generate PDF with the uploaded template
  await generatePdf({
    templateFile: base64Template,
    data: {
      name: customerName,
      date: new Date().toLocaleDateString(),
    },
    filename: `filled-${file.name}`,
  })
}

// ============================================================================
// EXAMPLE 5: View PDF in browser instead of downloading
// ============================================================================

export async function previewCertificate(name: string) {
  await generateAndViewPdf({
    templateUrl: '/templates/certificate.pdf',
    data: {
      name: name,
      date: new Date().toLocaleDateString(),
    },
  })
}

// ============================================================================
// EXAMPLE 6: Using in a React component with form
// ============================================================================

import { useState } from 'react'

export function CertificateForm() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await generatePdf({
        templateUrl: '/templates/certificate.pdf',
        data: {
          name: name, // This replaces {name} in the PDF with the user's input
          date: new Date().toLocaleDateString(),
        },
        filename: `certificate-${name.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter name (e.g., Alex)"
          required
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      <button
        type="submit"
        disabled={loading || !name}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
      >
        {loading ? 'Generating PDF...' : 'Generate Certificate'}
      </button>
    </form>
  )
}

// ============================================================================
// EXAMPLE 7: Batch PDF generation
// ============================================================================

export async function generateBatchCertificates(names: string[]) {
  const results = []

  for (const name of names) {
    try {
      await generatePdf({
        templateUrl: '/templates/certificate.pdf',
        data: {
          name: name,
          date: new Date().toLocaleDateString(),
        },
        filename: `certificate-${name.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      })
      results.push({ name, success: true })
    } catch (error) {
      results.push({
        name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return results
}

// Usage:
// const names = ['Alex', 'Jordan', 'Taylor']
// const results = await generateBatchCertificates(names)

// ============================================================================
// EXAMPLE 8: Integration with database data
// ============================================================================

export async function generateInvoiceFromOrder(orderId: string) {
  // Fetch order data from your database
  const response = await fetch(`/api/orders/${orderId}`)
  const order = await response.json()

  // Generate PDF with the order data
  await generatePdf({
    templateUrl: '/templates/invoice-template.pdf',
    data: {
      customerName: order.customerName,
      orderId: order.id,
      orderDate: new Date(order.createdAt).toLocaleDateString(),
      total: `$${order.total.toFixed(2)}`,
      items: order.items.length,
    },
    filename: `invoice-${order.id}.pdf`,
  })
}

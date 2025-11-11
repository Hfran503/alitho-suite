'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface FormData {
  orderId: string
  quantity: number
  position: 'center back flap' | 'front'
  address: string
}

export function PdfGeneratorForm() {
  const [formData, setFormData] = useState<FormData>({
    orderId: '',
    quantity: 1,
    position: 'center back flap',
    address: '',
  })

  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [printUrl, setPrintUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'quantity' ? parseInt(value) || 1 : value,
    }))
  }

  const generatePdf = async (version: 'proof' | 'print') => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/pdf/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          version,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate PDF')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      if (version === 'proof') {
        // Clean up old proof URL
        if (proofUrl) URL.revokeObjectURL(proofUrl)
        setProofUrl(url)
      } else {
        // Clean up old print URL
        if (printUrl) URL.revokeObjectURL(printUrl)
        setPrintUrl(url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateProof = () => generatePdf('proof')
  const handleGeneratePrint = () => generatePdf('print')

  const handleDownload = (url: string | null, version: 'proof' | 'print') => {
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = `Order_${formData.orderId}_${version.toUpperCase()}.pdf`
    link.click()
  }

  const isFormValid = formData.orderId && formData.address

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Order Details</h2>

        <div className="space-y-4">
          {/* Order ID */}
          <div>
            <Label htmlFor="orderId">Order ID</Label>
            <Input
              id="orderId"
              name="orderId"
              type="text"
              placeholder="e.g., 12345"
              value={formData.orderId}
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>

          {/* Quantity */}
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              value={formData.quantity}
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>

          {/* Position */}
          <div>
            <Label htmlFor="position">Address Position</Label>
            <select
              id="position"
              name="position"
              value={formData.position}
              onChange={handleInputChange}
              className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <option value="center back flap">Center Back Flap</option>
              <option value="front">Front</option>
            </select>
          </div>

          {/* Address */}
          <div>
            <Label htmlFor="address">Address</Label>
            <textarea
              id="address"
              name="address"
              rows={6}
              placeholder="Enter address (one line per line)"
              value={formData.address}
              onChange={handleInputChange}
              className="mt-1 flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use line breaks to separate address lines
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              onClick={handleGenerateProof}
              disabled={!isFormValid || loading}
              className="w-full"
              variant="default"
            >
              {loading ? 'Generating...' : 'Generate PROOF (with crop marks)'}
            </Button>

            <Button
              onClick={handleGeneratePrint}
              disabled={!isFormValid || loading}
              className="w-full"
              variant="secondary"
            >
              {loading ? 'Generating...' : 'Generate PRINT (trimmed)'}
            </Button>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">
            <p className="font-semibold mb-1">Note:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>PROOF includes red print area and crop marks</li>
              <li>PRINT is the final trimmed size (7.25" x 5.25")</li>
              <li>Preview appears on the right</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Preview</h2>

        {/* PROOF Preview */}
        {proofUrl && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-700">PROOF Version</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload(proofUrl, 'proof')}
              >
                Download
              </Button>
            </div>
            <div className="border border-gray-300 rounded overflow-hidden">
              <iframe
                src={proofUrl}
                className="w-full h-[400px]"
                title="PROOF PDF Preview"
              />
            </div>
          </div>
        )}

        {/* PRINT Preview */}
        {printUrl && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-700">PRINT Version</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload(printUrl, 'print')}
              >
                Download
              </Button>
            </div>
            <div className="border border-gray-300 rounded overflow-hidden">
              <iframe
                src={printUrl}
                className="w-full h-[400px]"
                title="PRINT PDF Preview"
              />
            </div>
          </div>
        )}

        {/* Empty State */}
        {!proofUrl && !printUrl && (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded border-2 border-dashed border-gray-300">
            <div className="text-center text-gray-500">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <p className="mt-2">Generate a PDF to see preview</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

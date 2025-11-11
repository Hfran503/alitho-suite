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
  notes: string
}

export function PdfGeneratorForm() {
  const [formData, setFormData] = useState<FormData>({
    orderId: '',
    quantity: 1,
    position: 'center back flap',
    address: '',
    notes: '',
  })

  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [printUrl, setPrintUrl] = useState<string | null>(null)
  const [proofBlob, setProofBlob] = useState<Blob | null>(null)
  const [printBlob, setPrintBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState(false)

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
    try {
      const response = await fetch('/api/portal/pdf/generate', {
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
        if (proofUrl) URL.revokeObjectURL(proofUrl)
        setProofUrl(url)
        setProofBlob(blob)
      } else {
        if (printUrl) URL.revokeObjectURL(printUrl)
        setPrintUrl(url)
        setPrintBlob(blob)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      throw err // Re-throw to be caught by handleGenerateBoth
    }
  }

  const handleGenerateBoth = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Generate PROOF first
      await generatePdf('proof')
      // Generate PRINT second
      await generatePdf('print')
    } catch (err) {
      // Error already handled in generatePdf
    } finally {
      setLoading(false)
    }
  }

  const handlePlaceOrder = async () => {
    if (!printBlob) {
      setError('Please generate PDFs before placing order')
      return
    }

    if (!isApproved) {
      setError('Please review and approve the PDFs before placing order')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      // Create FormData to send PDF files
      const orderData = new FormData()
      orderData.append('orderId', formData.orderId)
      orderData.append('quantity', formData.quantity.toString())
      orderData.append('position', formData.position)
      orderData.append('address', formData.address)
      orderData.append('notes', formData.notes)
      orderData.append('printPdf', printBlob, `order_${formData.orderId}_print.pdf`)
      if (proofBlob) {
        orderData.append('proofPdf', proofBlob, `order_${formData.orderId}_proof.pdf`)
      }

      const response = await fetch('/api/portal/gcu-envelope-orders', {
        method: 'POST',
        body: orderData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to place order')
      }

      const result = await response.json()
      setSuccess(`✓ Order ${result.orderNumber} submitted successfully! You will receive a confirmation email shortly.`)

      // Reset form
      setFormData({
        orderId: '',
        quantity: 1,
        position: 'center back flap',
        address: '',
        notes: '',
      })
      setIsApproved(false)
      if (proofUrl) URL.revokeObjectURL(proofUrl)
      if (printUrl) URL.revokeObjectURL(printUrl)
      setProofUrl(null)
      setPrintUrl(null)
      setProofBlob(null)
      setPrintBlob(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownload = (url: string | null, version: 'proof' | 'print') => {
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = `Order_${formData.orderId}_${version.toUpperCase()}.pdf`
    link.click()
  }

  const isFormValid = formData.orderId && formData.quantity > 0 && formData.position && formData.address
  const canPlaceOrder = printUrl && isApproved

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Order Information</h2>
          <p className="text-sm text-gray-500 mt-1">Fill in the details for your custom envelope order</p>
        </div>

        <div className="space-y-4">
          {/* Order ID and Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="orderId">
                Order ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="orderId"
                name="orderId"
                type="text"
                placeholder="e.g., 12345"
                value={formData.orderId}
                onChange={handleInputChange}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="quantity">
                Quantity <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={handleInputChange}
                required
                className="mt-1"
              />
            </div>
          </div>

          {/* Position */}
          <div>
            <Label htmlFor="position">
              Address Position <span className="text-red-500">*</span>
            </Label>
            <select
              id="position"
              name="position"
              value={formData.position}
              onChange={handleInputChange}
              required
              className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <option value="center back flap">Center Back Flap</option>
              <option value="front">Front</option>
            </select>
          </div>

          {/* Address */}
          <div>
            <Label htmlFor="address">
              Address <span className="text-red-500">*</span>
            </Label>
            <textarea
              id="address"
              name="address"
              rows={6}
              placeholder="Enter address (one line per line)"
              value={formData.address}
              onChange={handleInputChange}
              required
              className="mt-1 flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use line breaks to separate address lines
            </p>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">
              Notes <span className="text-gray-400 text-xs">(Optional)</span>
            </Label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Add any special instructions or notes for this order"
              value={formData.notes}
              onChange={handleInputChange}
              className="mt-1 flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            />
          </div>

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Action Button - Generate Preview */}
          {!printUrl && (
            <div className="pt-4">
              <Button
                onClick={handleGenerateBoth}
                disabled={!isFormValid || loading}
                className="w-full text-lg py-6"
                variant="default"
              >
                {loading ? 'Generating Preview...' : 'Continue to Review Order'}
              </Button>
            </div>
          )}

          {/* Order Review and Submission */}
          {printUrl && (
            <div className="pt-6 border-t-2 border-gray-200 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Review & Submit Order</h3>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800 font-medium mb-2">
                  ⚠️ Please review your order carefully
                </p>
                <p className="text-xs text-yellow-700">
                  Check both the PROOF and PRINT versions on the right to ensure all information is correct before submitting.
                </p>
              </div>

              <div className="bg-white border-2 border-gray-300 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="approval"
                    checked={isApproved}
                    onChange={(e) => setIsApproved(e.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="approval" className="text-sm text-gray-700 font-medium">
                    I have reviewed the order preview and confirm all information is correct. I authorize this order for production.
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleGenerateBoth}
                  disabled={loading}
                  className="w-full"
                  variant="outline"
                >
                  {loading ? 'Updating...' : 'Edit Order'}
                </Button>
                <Button
                  onClick={handlePlaceOrder}
                  disabled={!canPlaceOrder || submitting}
                  className="w-full text-lg py-6"
                  variant="default"
                >
                  {submitting ? 'Submitting Order...' : 'Submit Order'}
                </Button>
              </div>
            </div>
          )}

          {/* Info Box */}
          {!printUrl && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
              <p className="font-semibold mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Order Process
              </p>
              <ul className="space-y-1.5 text-xs">
                <li>• <strong>Step 1:</strong> Enter your order details and address</li>
                <li>• <strong>Step 2:</strong> Review the generated proof files</li>
                <li>• <strong>Step 3:</strong> Approve and submit your order</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-blue-300">
                <p className="text-xs">
                  <strong>Note:</strong> PROOF version shows crop marks for printer reference. PRINT version is the final trimmed size (7.25" × 5.25")
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Order Preview</h2>
          <p className="text-sm text-gray-500 mt-1">Review your custom envelope design before submitting</p>
        </div>

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
          <div className="flex items-center justify-center h-96 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-center text-gray-500 px-6">
              <svg
                className="mx-auto h-16 w-16 text-gray-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Preview Yet</h3>
              <p className="text-sm text-gray-600 mb-1">
                Fill out the order form and click
              </p>
              <p className="text-sm font-semibold text-blue-600">
                "Continue to Review Order"
              </p>
              <p className="text-sm text-gray-600 mt-1">
                to generate your preview files
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

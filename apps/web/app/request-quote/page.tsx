'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'

interface ProductAttribute {
  name: string
  label: string
  type: 'select' | 'radio' | 'checkbox'
  required: boolean
  options?: { value: string; label: string }[]
}

interface ProductType {
  id: string
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  attributes?: {
    attributes: ProductAttribute[]
  } | null
}

interface QuoteItem {
  id: string
  productType: ProductType
  attributeValues: Record<string, any>
  quantities: string[]
}

// Custom product type for "Other" option
const CUSTOM_PRODUCT: ProductType = {
  id: 'custom',
  name: 'Custom / Other',
  slug: 'custom',
  description: 'Request a quote for a custom product or something not listed above',
  imageUrl: null,
  attributes: null,
}

export default function RequestQuotePage() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  // Quote cart
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([])

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [attributeValues, setAttributeValues] = useState<Record<string, any>>({})
  const [quantities, setQuantities] = useState<string[]>([''])
  const [customDescription, setCustomDescription] = useState('')

  // Custom product modal state
  const [customModalOpen, setCustomModalOpen] = useState(false)

  // Checkout state
  const [showCheckout, setShowCheckout] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    additionalNotes: '',
  })

  // File attachment state
  const [attachments, setAttachments] = useState<{ filename: string; originalName: string; url: string; size: number }[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    // Check total file count
    if (attachments.length + files.length > 5) {
      setUploadError('Maximum 5 files allowed')
      return
    }

    setUploadingFiles(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i])
      }

      const response = await fetch('/api/public/quote-attachments', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload files')
      }

      setAttachments([...attachments, ...data.data.files])
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload files')
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleRemoveAttachment = (filename: string) => {
    setAttachments(attachments.filter(a => a.filename !== filename))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Fetch product types on mount
  useEffect(() => {
    const fetchProductTypes = async () => {
      try {
        setLoadingProducts(true)
        const response = await fetch('/api/public/product-types')
        if (response.ok) {
          const data = await response.json()
          setProductTypes(data.data || [])
        }
      } catch (err) {
        console.error('Error fetching product types:', err)
      } finally {
        setLoadingProducts(false)
      }
    }

    fetchProductTypes()
  }, [])

  // Helper to convert image URLs to API route URLs (for Docker volume support)
  const getImageUrl = (url: string | null): string | null => {
    if (!url) return null
    // Already using API route
    if (url.startsWith('/api/images/product/')) {
      return url
    }
    // Old static URL format
    if (url.startsWith('/product-images/')) {
      return url.replace('/product-images/', '/api/images/product/')
    }
    // Just filename - prepend the API route
    if (!url.startsWith('/') && !url.startsWith('http')) {
      return `/api/images/product/${url}`
    }
    return url
  }

  const handleProductClick = (product: ProductType) => {
    setSelectedProduct(product)
    setEditingItemId(null)
    setAttributeValues({})
    setQuantities([''])
    setCustomDescription('')

    // Open modal for custom product, sidebar for regular products
    if (product.id === 'custom') {
      setCustomModalOpen(true)
    } else {
      setSidebarOpen(true)
    }
  }

  const handleEditItem = (item: QuoteItem) => {
    setSelectedProduct(item.productType)
    setEditingItemId(item.id)
    setAttributeValues(item.attributeValues)
    setQuantities(item.quantities)
    setCustomDescription(item.attributeValues.customDescription || '')

    // Open modal for custom product, sidebar for regular products
    if (item.productType.id === 'custom') {
      setCustomModalOpen(true)
    } else {
      setSidebarOpen(true)
    }
  }

  const handleRemoveItem = (itemId: string) => {
    setQuoteItems(quoteItems.filter(item => item.id !== itemId))
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
    setSelectedProduct(null)
    setEditingItemId(null)
    setAttributeValues({})
    setQuantities([''])
    setCustomDescription('')
  }

  const closeCustomModal = () => {
    setCustomModalOpen(false)
    setSelectedProduct(null)
    setEditingItemId(null)
    setCustomDescription('')
    setQuantities([''])
    setError(null)
  }

  const handleAttributeChange = (name: string, value: any) => {
    setAttributeValues({ ...attributeValues, [name]: value })
  }

  const handleQuantityChange = (index: number, value: string) => {
    const updated = [...quantities]
    updated[index] = value
    setQuantities(updated)
  }

  const handleAddQuantity = () => {
    setQuantities([...quantities, ''])
  }

  const handleRemoveQuantity = (index: number) => {
    if (quantities.length > 1) {
      setQuantities(quantities.filter((_, i) => i !== index))
    }
  }

  const handleAddToQuote = () => {
    if (!selectedProduct) return

    // For custom product, validate description
    if (selectedProduct.id === 'custom') {
      if (!customDescription.trim()) {
        setError('Please describe what you are looking for')
        return
      }
    } else {
      // Validate required attributes for regular products
      const attrs = selectedProduct.attributes?.attributes || []
      for (const attr of attrs) {
        if (attr.required && !attributeValues[attr.name]) {
          setError(`Please select ${attr.label}`)
          return
        }
      }
    }

    // Validate at least one quantity
    const validQuantities = quantities.filter(q => q && q.trim() !== '')
    if (validQuantities.length === 0) {
      setError('Please enter at least one quantity')
      return
    }

    setError(null)

    // Build attribute values, including custom description if applicable
    const finalAttributeValues = selectedProduct.id === 'custom'
      ? { customDescription: customDescription.trim() }
      : customDescription.trim()
        ? { ...attributeValues, customDescription: customDescription.trim() }
        : attributeValues

    if (editingItemId) {
      // Update existing item
      setQuoteItems(quoteItems.map(item =>
        item.id === editingItemId
          ? { ...item, attributeValues: finalAttributeValues, quantities: validQuantities }
          : item
      ))
    } else {
      // Add new item
      const newItem: QuoteItem = {
        id: `item-${Date.now()}`,
        productType: selectedProduct,
        attributeValues: finalAttributeValues,
        quantities: validQuantities,
      }
      setQuoteItems([...quoteItems, newItem])
    }

    // Close the appropriate dialog
    if (selectedProduct.id === 'custom') {
      closeCustomModal()
    } else {
      closeSidebar()
    }
  }

  const formatItemSummary = (item: QuoteItem): string => {
    // Handle custom product
    if (item.productType.id === 'custom') {
      const desc = item.attributeValues.customDescription || ''
      return desc.length > 50 ? desc.substring(0, 50) + '...' : desc
    }

    const attrs = item.productType.attributes?.attributes || []
    const parts: string[] = []

    attrs.forEach(attr => {
      const value = item.attributeValues[attr.name]
      if (value !== undefined && value !== null && value !== '') {
        if ((attr.type === 'select' || attr.type === 'radio') && attr.options) {
          const option = attr.options.find(opt => opt.value === value)
          if (option) parts.push(option.label)
        } else if (attr.type === 'checkbox' && value) {
          parts.push(attr.label)
        }
      }
    })

    // Add custom request indicator
    if (item.attributeValues.customDescription) {
      parts.push('+ Custom request')
    }

    return parts.join(' • ') || 'No options selected'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Format project details from quote items
      const productsText = quoteItems
        .map((item, i) => {
          let text = `Product ${i + 1}:\n- Type: ${item.productType.name}`
          text += `\n- Quantities: ${item.quantities.join(', ')}`

          // Handle custom product
          if (item.productType.id === 'custom') {
            text += `\n- Description: ${item.attributeValues.customDescription || 'No description provided'}`
            return text
          }

          const attrs = item.productType.attributes?.attributes || []
          attrs.forEach(attr => {
            const value = item.attributeValues[attr.name]
            if (value !== undefined && value !== null && value !== '') {
              if ((attr.type === 'select' || attr.type === 'radio') && attr.options) {
                const option = attr.options.find(opt => opt.value === value)
                text += `\n- ${attr.label}: ${option?.label || value}`
              } else if (attr.type === 'checkbox') {
                text += `\n- ${attr.label}: ${value ? 'Yes' : 'No'}`
              }
            }
          })

          // Include custom request description for regular products
          if (item.attributeValues.customDescription) {
            text += `\n- Custom Request: ${item.attributeValues.customDescription}`
          }

          return text
        })
        .join('\n\n')

      let projectDetails = `STANDARD PRODUCTS REQUEST:\n\n${productsText}`
      if (formData.additionalNotes) {
        projectDetails += `\n\nAdditional Notes:\n${formData.additionalNotes}`
      }

      const response = await fetch('/api/public/quote-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
          title: formData.title,
          projectDetails,
          quoteType: 'standard',
          attachments: attachments.map(a => ({
            filename: a.filename,
            originalName: a.originalName,
            url: a.url,
            size: a.size,
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit quote request')
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Quote Request Received!</h1>
            <p className="text-lg text-gray-600 mb-8">
              Thank you for your interest. Our team will review your request and get back to you within 1-2 business days.
            </p>
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-6 mb-8">
              <p className="text-sm text-teal-800">
                We've sent a confirmation email to <strong>{formData.email}</strong>
              </p>
            </div>
            <Link href="/">
              <Button className="bg-teal-600 hover:bg-teal-700">
                Return to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Checkout screen
  if (showCheckout) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setShowCheckout(false)}
            className="flex items-center text-teal-600 hover:text-teal-700 mb-6"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Products
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Complete Your Quote Request</h1>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        required
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        required
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="john@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(925) 682-1111"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company">Company Name</Label>
                      <Input
                        id="company"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="Acme Corporation"
                      />
                    </div>
                    <div>
                      <Label htmlFor="title">Job Title</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Marketing Director"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="additionalNotes">Additional Notes</Label>
                    <Textarea
                      id="additionalNotes"
                      value={formData.additionalNotes}
                      onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                      placeholder="Any special requirements or questions?"
                      rows={4}
                      className="resize-none"
                    />
                  </div>

                  {/* File Attachments */}
                  <div>
                    <Label>Attachments (Optional)</Label>
                    <p className="text-sm text-gray-500 mb-3">
                      Upload reference files, artwork, or specifications (PDF, images, Word, Excel - max 10MB each, up to 5 files)
                    </p>

                    {uploadError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-red-800 text-sm">
                        {uploadError}
                      </div>
                    )}

                    {/* Upload Area */}
                    <label
                      className={`relative block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        uploadingFiles
                          ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                          : 'border-gray-300 hover:border-teal-500 hover:bg-teal-50/50'
                      }`}
                    >
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx"
                        onChange={(e) => handleFileUpload(e.target.files)}
                        disabled={uploadingFiles || attachments.length >= 5}
                        className="sr-only"
                      />
                      {uploadingFiles ? (
                        <div className="flex flex-col items-center">
                          <svg className="animate-spin h-8 w-8 text-teal-600 mb-2" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="text-gray-600">Uploading...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <svg className="h-10 w-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span className="text-gray-600">
                            {attachments.length >= 5 ? 'Maximum files reached' : 'Click to upload or drag and drop'}
                          </span>
                        </div>
                      )}
                    </label>

                    {/* Uploaded Files List */}
                    {attachments.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {attachments.map((file) => (
                          <div
                            key={file.filename}
                            className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="shrink-0 w-8 h-8 bg-teal-100 rounded flex items-center justify-center">
                                {file.originalName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                  <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{file.originalName}</p>
                                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(file.filename)}
                              className="shrink-0 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white py-6 text-lg font-semibold"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Submitting...
                      </span>
                    ) : (
                      'Submit Quote Request'
                    )}
                  </Button>
                </form>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Quote Summary</h2>
                <div className="space-y-4">
                  {quoteItems.map((item) => (
                    <div key={item.id} className="border-b border-gray-100 pb-4">
                      <div className="flex gap-3">
                        {getImageUrl(item.productType.imageUrl) ? (
                          <img
                            src={getImageUrl(item.productType.imageUrl)!}
                            alt={item.productType.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 text-sm">{item.productType.name}</h3>
                          <p className="text-xs text-gray-500">{formatItemSummary(item)}</p>
                          <p className="text-xs text-teal-600 mt-1">Qty: {item.quantities.join(', ')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  {quoteItems.length} product{quoteItems.length !== 1 ? 's' : ''} in your quote
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main product browsing view
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Request a Quote</h1>
          <p className="text-gray-600 mt-1">Browse our products and add them to your quote</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Loading State */}
        {loadingProducts ? (
          <div className="text-center py-12">
            <svg className="animate-spin h-8 w-8 mx-auto text-teal-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-gray-500 mt-4">Loading products...</p>
          </div>
        ) : productTypes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No products available</h3>
            <p className="text-gray-600">Please check back later or contact us directly.</p>
          </div>
        ) : (
          /* Product Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {productTypes.map((product) => (
              <div
                key={product.id}
                onClick={() => handleProductClick(product)}
                className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow cursor-pointer overflow-hidden group"
              >
                {/* Product Image */}
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  {getImageUrl(product.imageUrl) ? (
                    <img
                      src={getImageUrl(product.imageUrl)!}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-teal-600/0 group-hover:bg-teal-600/10 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-teal-600 px-4 py-2 rounded-full font-medium shadow-lg">
                      Add to Quote
                    </span>
                  </div>
                </div>
                {/* Product Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 group-hover:text-teal-600 transition-colors">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Custom/Other Product Card */}
            <div
              onClick={() => handleProductClick(CUSTOM_PRODUCT)}
              className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow cursor-pointer overflow-hidden group border-2 border-dashed border-gray-300 hover:border-teal-500"
            >
              <div className="aspect-square bg-gray-50 relative overflow-hidden flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto group-hover:text-teal-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-teal-600/0 group-hover:bg-teal-600/5 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-teal-600 px-4 py-2 rounded-full font-medium shadow-lg">
                    Add to Quote
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-teal-600 transition-colors">
                  Custom / Other
                </h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                  Need something not listed? Describe your custom request.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quote Cart */}
      {quoteItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  {quoteItems.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="w-10 h-10 rounded-full border-2 border-white overflow-hidden bg-gray-100"
                    >
                      {getImageUrl(item.productType.imageUrl) ? (
                        <img
                          src={getImageUrl(item.productType.imageUrl)!}
                          alt={item.productType.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                  {quoteItems.length > 3 && (
                    <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                      +{quoteItems.length - 3}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {quoteItems.length} product{quoteItems.length !== 1 ? 's' : ''} in your quote
                  </p>
                  <button
                    onClick={() => setQuoteItems([])}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Clear all
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden md:flex gap-2 max-w-md overflow-x-auto">
                  {quoteItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 bg-gray-100 rounded-full pl-3 pr-1 py-1 text-sm"
                    >
                      <span className="truncate max-w-[100px]">{item.productType.name}</span>
                      <button
                        onClick={() => handleEditItem(item)}
                        className="p-1 hover:bg-gray-200 rounded-full"
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 hover:bg-gray-200 rounded-full"
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => setShowCheckout(true)}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  Continue to Quote
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Product Modal */}
      {customModalOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={closeCustomModal}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-100 to-teal-200 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Custom Request</h2>
                    <p className="text-sm text-gray-500">Describe your custom product needs</p>
                  </div>
                </div>
                <button
                  onClick={closeCustomModal}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-800 text-sm">
                    {error}
                  </div>
                )}

                {/* Description */}
                <div className="mb-6">
                  <Label className="text-sm font-medium text-gray-900">
                    What are you looking for? <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="Describe the product or service you need, including any specific requirements, dimensions, materials, quantities, or other details..."
                    rows={8}
                    className="mt-2"
                  />
                </div>

                {/* Quantities */}
                <div>
                  <Label className="text-sm font-medium text-gray-900">
                    Quantities <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-gray-500 mb-2">Add quantities you need pricing for</p>
                  <div className="space-y-2">
                    {quantities.map((qty, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          type="text"
                          value={qty}
                          onChange={(e) => {
                            const newQuantities = [...quantities]
                            newQuantities[index] = e.target.value
                            setQuantities(newQuantities)
                          }}
                          placeholder="e.g., 100, 500, 1000"
                          className="flex-1"
                        />
                        {quantities.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setQuantities(quantities.filter((_, i) => i !== index))}
                            className="shrink-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setQuantities([...quantities, ''])}
                      className="w-full"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Another Quantity
                    </Button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                <Button
                  variant="outline"
                  onClick={closeCustomModal}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddToQuote}
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                >
                  {editingItemId ? 'Update Quote' : 'Add to Quote'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Configuration Modal */}
      {sidebarOpen && selectedProduct && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={closeSidebar}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 shrink-0">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingItemId ? 'Edit Product' : 'Configure Product'}
                </h2>
                <button
                  onClick={closeSidebar}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800 text-sm">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column - Product Image & Info */}
                  <div>
                    {/* Product Image */}
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                      {getImageUrl(selectedProduct.imageUrl) ? (
                        <img
                          src={getImageUrl(selectedProduct.imageUrl)!}
                          alt={selectedProduct.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedProduct.name}</h3>
                    {selectedProduct.description && (
                      <p className="text-gray-600 text-sm">{selectedProduct.description}</p>
                    )}
                  </div>

                  {/* Right Column - Configuration */}
                  <div className="space-y-6">
                    {/* Attributes */}
                    {selectedProduct.attributes?.attributes && selectedProduct.attributes.attributes.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900">Options</h4>
                        {selectedProduct.attributes.attributes.map((attr) => (
                          <div key={attr.name}>
                            <Label className="text-sm">
                              {attr.label} {attr.required && <span className="text-red-500">*</span>}
                            </Label>

                            {/* Select Dropdown */}
                            {attr.type === 'select' && (
                              <select
                                value={attributeValues[attr.name] || ''}
                                onChange={(e) => handleAttributeChange(attr.name, e.target.value)}
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                              >
                                <option value="">Select {attr.label}</option>
                                {attr.options?.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            )}

                            {/* Radio Buttons */}
                            {attr.type === 'radio' && (
                              <div className="mt-2 space-y-2">
                                {attr.options?.map((opt) => (
                                  <label
                                    key={opt.value}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <input
                                      type="radio"
                                      name={attr.name}
                                      value={opt.value}
                                      checked={attributeValues[attr.name] === opt.value}
                                      onChange={(e) => handleAttributeChange(attr.name, e.target.value)}
                                      className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                                    />
                                    <span className="text-sm text-gray-700">{opt.label}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {/* Checkbox */}
                            {attr.type === 'checkbox' && (
                              <label className="flex items-center gap-2 cursor-pointer mt-2">
                                <input
                                  type="checkbox"
                                  checked={!!attributeValues[attr.name]}
                                  onChange={(e) => handleAttributeChange(attr.name, e.target.checked)}
                                  className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                                />
                                <span className="text-sm text-gray-700">Yes</span>
                              </label>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quantities */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium">
                          Quantities <span className="text-red-500">*</span>
                        </Label>
                        <button
                          type="button"
                          onClick={handleAddQuantity}
                          className="text-teal-600 hover:text-teal-700 text-sm flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Quantity
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">
                        Request pricing for different volume tiers (e.g., 500, 1000, 2500)
                      </p>
                      <div className="space-y-2">
                        {quantities.map((qty, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <Input
                              type="number"
                              min="1"
                              value={qty}
                              onChange={(e) => handleQuantityChange(index, e.target.value)}
                              placeholder={index === 0 ? "1000" : "2500"}
                              className="flex-1"
                            />
                            {quantities.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveQuantity(index)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Custom Request Link */}
                    <div className="border-t border-gray-200 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          closeSidebar()
                          setSelectedProduct(CUSTOM_PRODUCT)
                          setCustomModalOpen(true)
                        }}
                        className="flex items-center gap-2 text-teal-600 hover:text-teal-700 text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Need something not listed? Describe your custom request.
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50 shrink-0">
                <Button
                  variant="outline"
                  onClick={closeSidebar}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddToQuote}
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                >
                  {editingItemId ? 'Update in Quote' : 'Add to Quote'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Contact Info Footer */}
      <div className="bg-white border-t border-gray-200 py-8 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-600">
            Need immediate assistance?{' '}
            <a href="tel:+19256821111" className="text-teal-600 hover:text-teal-700 font-semibold">
              Call us: (925) 682-1111
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

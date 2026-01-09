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
  attributes?: {
    attributes: ProductAttribute[]
  } | null
}

export default function RequestQuotePage() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quoteType, setQuoteType] = useState<'standard' | 'custom'>('standard')
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    projectDetails: '',
    estimatedBudget: '',
  })
  const [standardProducts, setStandardProducts] = useState([
    { productType: '', quantities: [''], attributeValues: {} as Record<string, any> }
  ])

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

  const handleAddProduct = () => {
    setStandardProducts([...standardProducts, { productType: '', quantities: [''], attributeValues: {} }])
  }

  const handleRemoveProduct = (index: number) => {
    if (standardProducts.length > 1) {
      setStandardProducts(standardProducts.filter((_, i) => i !== index))
    }
  }

  const handleProductChange = (index: number, field: string, value: string) => {
    const updated = [...standardProducts]
    updated[index] = { ...updated[index], [field]: value }

    // Reset attributes when product type changes
    if (field === 'productType') {
      updated[index].attributeValues = {}
    }

    setStandardProducts(updated)
  }

  const handleAttributeChange = (productIndex: number, attributeName: string, value: any) => {
    const updated = [...standardProducts]
    updated[productIndex].attributeValues[attributeName] = value
    setStandardProducts(updated)
  }

  const handleQuantityChange = (productIndex: number, quantityIndex: number, value: string) => {
    const updated = [...standardProducts]
    updated[productIndex].quantities[quantityIndex] = value
    setStandardProducts(updated)
  }

  const handleAddQuantity = (productIndex: number) => {
    const updated = [...standardProducts]
    updated[productIndex].quantities.push('')
    setStandardProducts(updated)
  }

  const handleRemoveQuantity = (productIndex: number, quantityIndex: number) => {
    const updated = [...standardProducts]
    if (updated[productIndex].quantities.length > 1) {
      updated[productIndex].quantities = updated[productIndex].quantities.filter((_, i) => i !== quantityIndex)
    }
    setStandardProducts(updated)
  }

  const getSelectedProductType = (slug: string): ProductType | undefined => {
    return productTypes.find(p => p.slug === slug)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Format project details based on quote type
      let projectDetails = formData.projectDetails

      if (quoteType === 'standard') {
        // Validate at least one product with required fields
        const validProducts = standardProducts.filter(p => {
          const hasProductType = !!p.productType
          const hasValidQuantity = p.quantities.some(q => q && q.trim() !== '')
          return hasProductType && hasValidQuantity
        })
        if (validProducts.length === 0) {
          setError('Please add at least one product with type and at least one quantity')
          setLoading(false)
          return
        }

        // Format standard products as structured text
        const productsText = validProducts
          .map((p, i) => {
            const productType = getSelectedProductType(p.productType)
            let text = `Product ${i + 1}:\n- Type: ${productType?.name || p.productType}`

            // Add quantities
            const validQuantities = p.quantities.filter(q => q && q.trim() !== '')
            if (validQuantities.length > 0) {
              text += `\n- Quantities: ${validQuantities.join(', ')}`
            }

            // Add attribute values
            if (productType?.attributes?.attributes && Object.keys(p.attributeValues).length > 0) {
              productType.attributes.attributes.forEach(attr => {
                const value = p.attributeValues[attr.name]
                if (value !== undefined && value !== null && value !== '') {
                  // Find the label for select/radio options
                  if ((attr.type === 'select' || attr.type === 'radio') && attr.options) {
                    const option = attr.options.find(opt => opt.value === value)
                    text += `\n- ${attr.label}: ${option?.label || value}`
                  } else if (attr.type === 'checkbox') {
                    text += `\n- ${attr.label}: ${value ? 'Yes' : 'No'}`
                  } else {
                    text += `\n- ${attr.label}: ${value}`
                  }
                }
              })
            }

            return text
          })
          .join('\n\n')

        projectDetails = `STANDARD PRODUCTS REQUEST:\n\n${productsText}`
      }

      const response = await fetch('/api/public/quote-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          projectDetails,
          quoteType,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Request a Quote</h1>
          <p className="text-xl text-gray-600">
            Tell us about your project and we'll get back to you with a detailed quote.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-10">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Personal Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Contact Information
              </h2>
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

            {/* Quote Type Selection */}
            <div className="pt-6 border-t border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Quote Type
              </h2>
              <div className="space-y-3">
                <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="quoteType"
                    value="standard"
                    checked={quoteType === 'standard'}
                    onChange={(e) => setQuoteType(e.target.value as 'standard' | 'custom')}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Standard Products</div>
                    <div className="text-sm text-gray-600">Select from our pre-configured product offerings</div>
                  </div>
                </label>
                <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="quoteType"
                    value="custom"
                    checked={quoteType === 'custom'}
                    onChange={(e) => setQuoteType(e.target.value as 'standard' | 'custom')}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Custom Project</div>
                    <div className="text-sm text-gray-600">Describe your unique requirements in detail</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Project Details - Conditional based on quote type */}
            <div className="pt-6 border-t border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {quoteType === 'standard' ? 'Product Selection' : 'Project Details'}
              </h2>

              {quoteType === 'standard' ? (
                <div className="space-y-6">
                  {standardProducts.map((product, index) => (
                    <div key={index} className="p-4 md:p-6 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-gray-900">Product {index + 1}</h3>
                        {standardProducts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveProduct(index)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor={`productType-${index}`}>Product Type *</Label>
                          <select
                            id={`productType-${index}`}
                            required
                            value={product.productType}
                            onChange={(e) => handleProductChange(index, 'productType', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                            disabled={loadingProducts}
                          >
                            <option value="">
                              {loadingProducts ? 'Loading products...' : 'Select a product'}
                            </option>
                            {productTypes.map((type) => (
                              <option key={type.id} value={type.slug}>
                                {type.name}
                              </option>
                            ))}
                            {!loadingProducts && productTypes.length === 0 && (
                              <option value="" disabled>
                                No products available
                              </option>
                            )}
                          </select>
                        </div>

                        {/* Dynamic Product Attributes */}
                        {product.productType && (() => {
                          const selectedProduct = getSelectedProductType(product.productType)
                          const attrs = selectedProduct?.attributes?.attributes
                          if (!attrs || attrs.length === 0) return null

                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {attrs.map((attr) => (
                                <div key={attr.name}>
                              <Label htmlFor={`${attr.name}-${index}`}>
                                {attr.label} {attr.required && <span className="text-red-500">*</span>}
                              </Label>

                              {/* Select Dropdown */}
                              {attr.type === 'select' && (
                                <select
                                  id={`${attr.name}-${index}`}
                                  required={attr.required}
                                  value={product.attributeValues[attr.name] || ''}
                                  onChange={(e) => handleAttributeChange(index, attr.name, e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                                <div className="space-y-2">
                                  {attr.options?.map((opt) => (
                                    <label
                                      key={opt.value}
                                      className="flex items-center gap-2 cursor-pointer"
                                    >
                                      <input
                                        type="radio"
                                        name={`${attr.name}-${index}`}
                                        value={opt.value}
                                        checked={product.attributeValues[attr.name] === opt.value}
                                        onChange={(e) => handleAttributeChange(index, attr.name, e.target.value)}
                                        required={attr.required}
                                        className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                                      />
                                      <span className="text-sm text-gray-700">{opt.label}</span>
                                    </label>
                                  ))}
                                </div>
                              )}

                              {/* Checkbox */}
                              {attr.type === 'checkbox' && (
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    id={`${attr.name}-${index}`}
                                    checked={!!product.attributeValues[attr.name]}
                                    onChange={(e) => handleAttributeChange(index, attr.name, e.target.checked)}
                                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                                  />
                                  <span className="text-sm text-gray-700">Yes</span>
                                </label>
                              )}
                            </div>
                              ))}
                            </div>
                          )
                        })()}

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label>Quantities * <span className="text-xs text-gray-500 font-normal">(request pricing for multiple volumes)</span></Label>
                            <button
                              type="button"
                              onClick={() => handleAddQuantity(index)}
                              className="text-teal-600 hover:text-teal-700 text-sm flex items-center gap-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Add Quantity
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {product.quantities.map((qty, qtyIndex) => (
                              <div key={qtyIndex} className="flex gap-2 items-center">
                                <Input
                                  type="number"
                                  required={qtyIndex === 0}
                                  min="1"
                                  value={qty}
                                  onChange={(e) => handleQuantityChange(index, qtyIndex, e.target.value)}
                                  placeholder={qtyIndex === 0 ? "1000" : "2500"}
                                  className="flex-1"
                                />
                                {product.quantities.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveQuantity(index, qtyIndex)}
                                    className="text-red-600 hover:text-red-700 text-sm px-2"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Add multiple quantities to get pricing for different volume tiers (e.g., 500, 1000, 2500)
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddProduct}
                    className="w-full border-dashed border-2 border-teal-300 text-teal-600 hover:bg-teal-50"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Another Product
                  </Button>
                </div>
              ) : (
                <div>
                  <Label htmlFor="projectDetails">Tell us about your project *</Label>
                  <Textarea
                    id="projectDetails"
                    required={quoteType === 'custom'}
                    value={formData.projectDetails}
                    onChange={(e) => setFormData({ ...formData, projectDetails: e.target.value })}
                    placeholder="Please describe what you need, including quantities, specifications, timeline, etc."
                    rows={6}
                    className="resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Be as detailed as possible to help us provide an accurate quote.
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="estimatedBudget">Estimated Budget (USD)</Label>
              <Input
                id="estimatedBudget"
                type="number"
                step="0.01"
                min="0"
                value={formData.estimatedBudget}
                onChange={(e) => setFormData({ ...formData, estimatedBudget: e.target.value })}
                placeholder="50000.00"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional - Helps us tailor our proposal to your needs.
              </p>
            </div>

            {/* Submit */}
            <div className="pt-6 border-t border-gray-200">
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
              <p className="text-xs text-center text-gray-500 mt-4">
                By submitting this form, you agree to be contacted about your quote request.
              </p>
            </div>
          </form>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center">
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

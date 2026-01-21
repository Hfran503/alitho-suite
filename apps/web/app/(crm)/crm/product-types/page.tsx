'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ProductType {
  id: string
  name: string
  description: string | null
  slug: string
  imageUrl: string | null
  isActive: boolean
  sortOrder: number
  attributes: any
  createdAt: string
  updatedAt: string
}

interface ProductAttribute {
  name: string
  label: string
  type: 'select' | 'radio' | 'checkbox'
  required: boolean
  options?: { value: string; label: string }[]
}

export default function ProductTypesPage() {
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductType | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    slug: '',
    imageUrl: '',
    isActive: true,
    sortOrder: 0,
  })

  // Image upload state
  const [uploadingImage, setUploadingImage] = useState(false)

  // Helper to convert old static URLs to API route URLs (for Docker volume support)
  const getImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null
    if (url.startsWith('/product-images/')) {
      return url.replace('/product-images/', '/api/images/product/')
    }
    return url
  }

  // Attributes management
  const [attributes, setAttributes] = useState<ProductAttribute[]>([])
  const [editingAttributeIndex, setEditingAttributeIndex] = useState<number | null>(null)
  const [attributeForm, setAttributeForm] = useState<ProductAttribute>({
    name: '',
    label: '',
    type: 'select',
    required: false,
    options: [],
  })
  const [optionInput, setOptionInput] = useState({ value: '', label: '' })

  const fetchProductTypes = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/crm/product-types')
      if (response.ok) {
        const data = await response.json()
        setProductTypes(data.data || [])
      } else {
        throw new Error('Failed to fetch product types')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProductTypes()
  }, [])

  const handleOpenCreate = () => {
    setEditingProduct(null)
    setFormData({
      name: '',
      description: '',
      slug: '',
      imageUrl: '',
      isActive: true,
      sortOrder: 0,
    })
    setAttributes([])
    setModalOpen(true)
  }

  const handleOpenEdit = (product: ProductType) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || '',
      slug: product.slug,
      imageUrl: product.imageUrl || '',
      isActive: product.isActive,
      sortOrder: product.sortOrder,
    })

    // Parse attributes from JSON
    const attrs = product.attributes?.attributes || []
    setAttributes(attrs)
    setModalOpen(true)
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleNameChange = (name: string) => {
    setFormData({ ...formData, name })
    if (!editingProduct || formData.slug === generateSlug(formData.name) || !formData.slug) {
      setFormData((prev) => ({ ...prev, name, slug: generateSlug(name) }))
    } else {
      setFormData((prev) => ({ ...prev, name }))
    }
  }

  // Attribute management functions
  const handleAddAttribute = () => {
    if (!attributeForm.name || !attributeForm.label) {
      alert('Please fill in attribute name and label')
      return
    }

    if (editingAttributeIndex !== null) {
      // Edit existing
      const updated = [...attributes]
      updated[editingAttributeIndex] = attributeForm
      setAttributes(updated)
      setEditingAttributeIndex(null)
    } else {
      // Add new
      setAttributes([...attributes, attributeForm])
    }

    // Reset form
    setAttributeForm({
      name: '',
      label: '',
      type: 'select',
      required: false,
      options: [],
    })
    setOptionInput({ value: '', label: '' })
  }

  const handleEditAttribute = (index: number) => {
    setAttributeForm(attributes[index])
    setEditingAttributeIndex(index)
  }

  const handleDeleteAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index))
  }

  const handleAddOption = () => {
    if (!optionInput.value || !optionInput.label) {
      alert('Please fill in option value and label')
      return
    }

    setAttributeForm({
      ...attributeForm,
      options: [...(attributeForm.options || []), optionInput],
    })
    setOptionInput({ value: '', label: '' })
  }

  const handleRemoveOption = (index: number) => {
    setAttributeForm({
      ...attributeForm,
      options: attributeForm.options?.filter((_, i) => i !== index),
    })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    setUploadingImage(true)
    setError(null)

    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)

      const response = await fetch('/api/uploads/product-image', {
        method: 'POST',
        body: uploadFormData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload image')
      }

      const { data } = await response.json()
      setFormData({ ...formData, imageUrl: data.url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleRemoveImage = () => {
    setFormData({ ...formData, imageUrl: '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const url = editingProduct
        ? `/api/crm/product-types/${editingProduct.id}`
        : '/api/crm/product-types'

      const response = await fetch(url, {
        method: editingProduct ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          slug: formData.slug,
          imageUrl: formData.imageUrl || null,
          isActive: formData.isActive,
          sortOrder: formData.sortOrder,
          attributes: attributes.length > 0 ? { attributes } : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save product type')
      }

      await fetchProductTypes()
      setModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product type?')) {
      return
    }

    try {
      const response = await fetch(`/api/crm/product-types/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete product type')
      }

      await fetchProductTypes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleToggleActive = async (product: ProductType) => {
    try {
      const response = await fetch(`/api/crm/product-types/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update product type')
      }

      await fetchProductTypes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleDuplicate = async (product: ProductType) => {
    try {
      // Generate a unique name and slug for the duplicate
      const baseName = product.name.replace(/\s*\(Copy(?:\s*\d+)?\)$/, '')
      const baseSlug = product.slug.replace(/-copy(?:-\d+)?$/, '')

      // Find existing copies to determine the next number
      const existingCopies = productTypes.filter(
        (p) => p.name.startsWith(baseName) && p.name.includes('(Copy')
      )

      let newName: string
      let newSlug: string

      if (existingCopies.length === 0) {
        newName = `${baseName} (Copy)`
        newSlug = `${baseSlug}-copy`
      } else {
        const copyNumber = existingCopies.length + 1
        newName = `${baseName} (Copy ${copyNumber})`
        newSlug = `${baseSlug}-copy-${copyNumber}`
      }

      const response = await fetch('/api/crm/product-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          slug: newSlug,
          description: product.description || '',
          isActive: product.isActive,
          sortOrder: product.sortOrder,
          attributes: product.attributes,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to duplicate product type')
      }

      await fetchProductTypes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Product Types</h1>
          <p className="text-gray-600">Manage standard products for quote requests</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Product Type
        </Button>
      </div>

      {/* Error State */}
      {error && !modalOpen && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading product types...</p>
        </div>
      ) : productTypes.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No product types yet</h3>
          <p className="text-gray-600 mb-6">
            Add your first product type to appear in the public quote request form.
          </p>
          <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700">
            Add Product Type
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Attributes</TableHead>
                <TableHead className="text-center">Order</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productTypes.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {getImageUrl(product.imageUrl) ? (
                      <img
                        src={getImageUrl(product.imageUrl)!}
                        alt={product.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">{product.slug}</code>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {product.attributes?.attributes?.length || 0} configured
                  </TableCell>
                  <TableCell className="text-center">{product.sortOrder}</TableCell>
                  <TableCell className="text-center">
                    <button
                      onClick={() => handleToggleActive(product)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        product.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {product.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(product)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDuplicate(product)}
                      >
                        Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(product.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Full Page Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl my-8">
            {/* Modal Header */}
            <div className="border-b border-gray-200 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {editingProduct ? 'Edit Product Type' : 'Add Product Type'}
                </h2>
                <p className="text-gray-600 mt-1">
                  Configure product details and customizable attributes
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Basic Info Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Basic Information
                  </h3>
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Product Name *</Label>
                        <Input
                          id="name"
                          required
                          value={formData.name}
                          onChange={(e) => handleNameChange(e.target.value)}
                          placeholder="e.g., Business Cards"
                        />
                      </div>

                      <div>
                        <Label htmlFor="slug">Slug *</Label>
                        <Input
                          id="slug"
                          required
                          value={formData.slug}
                          onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                          placeholder="e.g., business-cards"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Optional description"
                        rows={2}
                      />
                    </div>

                    {/* Product Image */}
                    <div>
                      <Label>Product Image</Label>
                      <div className="mt-2">
                        {formData.imageUrl ? (
                          <div className="relative inline-block">
                            <img
                              src={getImageUrl(formData.imageUrl) || formData.imageUrl}
                              alt="Product preview"
                              className="w-40 h-40 object-cover rounded-lg border border-gray-200"
                            />
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-40 h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                              disabled={uploadingImage}
                            />
                            {uploadingImage ? (
                              <div className="flex flex-col items-center">
                                <svg className="animate-spin h-8 w-8 text-teal-600" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span className="mt-2 text-sm text-gray-500">Uploading...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="mt-2 text-sm text-gray-500">Click to upload</span>
                                <span className="text-xs text-gray-400">Max 5MB</span>
                              </div>
                            )}
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="sortOrder">Sort Order</Label>
                        <Input
                          id="sortOrder"
                          type="number"
                          value={formData.sortOrder}
                          onChange={(e) =>
                            setFormData({ ...formData, sortOrder: Number(e.target.value) })
                          }
                        />
                      </div>

                      <div>
                        <Label htmlFor="isActive">Status</Label>
                        <select
                          id="isActive"
                          value={formData.isActive ? 'true' : 'false'}
                          onChange={(e) =>
                            setFormData({ ...formData, isActive: e.target.value === 'true' })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attributes Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    Product Attributes
                  </h3>

                  {/* Existing Attributes */}
                  {attributes.length > 0 && (
                    <div className="mb-4 space-y-2">
                      {attributes.map((attr, index) => (
                        <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                          <div className="flex-1">
                            <div className="font-medium">{attr.label}</div>
                            <div className="text-sm text-gray-600">
                              Type: {attr.type} • {attr.required ? 'Required' : 'Optional'}
                              {attr.options && ` • ${attr.options.length} options`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditAttribute(index)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteAttribute(index)}
                              className="text-red-600"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add/Edit Attribute Form */}
                  <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                    <div className="text-sm font-medium text-gray-700">
                      {editingAttributeIndex !== null ? 'Edit Attribute' : 'Add New Attribute'}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="attrName">Attribute Name *</Label>
                        <Input
                          id="attrName"
                          value={attributeForm.name}
                          onChange={(e) => setAttributeForm({ ...attributeForm, name: e.target.value })}
                          placeholder="e.g., paper_type"
                        />
                      </div>

                      <div>
                        <Label htmlFor="attrLabel">Display Label *</Label>
                        <Input
                          id="attrLabel"
                          value={attributeForm.label}
                          onChange={(e) => setAttributeForm({ ...attributeForm, label: e.target.value })}
                          placeholder="e.g., Paper Type"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="attrType">Type *</Label>
                        <select
                          id="attrType"
                          value={attributeForm.type}
                          onChange={(e) => setAttributeForm({ ...attributeForm, type: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="select">Dropdown (Select)</option>
                          <option value="radio">Radio Buttons</option>
                          <option value="checkbox">Checkbox (Yes/No)</option>
                        </select>
                      </div>

                      <div className="flex items-center pt-6">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={attributeForm.required}
                            onChange={(e) => setAttributeForm({ ...attributeForm, required: e.target.checked })}
                            className="mr-2"
                          />
                          <span className="text-sm">Required field</span>
                        </label>
                      </div>
                    </div>

                    {/* Options (for select and radio) */}
                    {(attributeForm.type === 'select' || attributeForm.type === 'radio') && (
                      <div>
                        <Label>Options</Label>
                        {attributeForm.options && attributeForm.options.length > 0 && (
                          <div className="mb-2 space-y-1">
                            {attributeForm.options.map((opt, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border">
                                <span className="text-sm">
                                  {opt.label} <span className="text-gray-500">({opt.value})</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOption(idx)}
                                  className="text-red-600 text-sm"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Input
                            placeholder="Value (e.g., standard)"
                            value={optionInput.value}
                            onChange={(e) => setOptionInput({ ...optionInput, value: e.target.value })}
                          />
                          <Input
                            placeholder="Label (e.g., Standard)"
                            value={optionInput.label}
                            onChange={(e) => setOptionInput({ ...optionInput, label: e.target.value })}
                          />
                          <Button type="button" variant="outline" onClick={handleAddOption}>
                            Add
                          </Button>
                        </div>
                      </div>
                    )}

                    <Button
                      type="button"
                      onClick={handleAddAttribute}
                      className="w-full bg-teal-600 hover:bg-teal-700"
                    >
                      {editingAttributeIndex !== null ? 'Update Attribute' : 'Add Attribute'}
                    </Button>

                    {editingAttributeIndex !== null && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingAttributeIndex(null)
                          setAttributeForm({
                            name: '',
                            label: '',
                            type: 'select',
                            required: false,
                            options: [],
                          })
                          setOptionInput({ value: '', label: '' })
                        }}
                        className="w-full"
                      >
                        Cancel Edit
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {submitting ? 'Saving...' : editingProduct ? 'Update Product Type' : 'Create Product Type'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

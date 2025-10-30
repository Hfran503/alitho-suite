'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

type Customer = {
  id: string
  name: string
  company?: string
  salesPerson?: number
}

type JobProductType = {
  id: string
  description: string
  componentType?: number
  colorsSide1?: number
  colorsSide2?: number
  colorsTotal?: number
}

type EstimatePart = {
  jobProductTypeId: string
  jobProductTypeName: string
  description: string
  quantity: number
}

export default function CreateEstimatePage() {
  const router = useRouter()

  // Form state - Set defaults for testing
  const [customer, setCustomer] = useState('00001005') // Default customer
  const [salesPerson, setSalesPerson] = useState<number | ''>(19) // Auto-populated
  const [estimator] = useState<number | ''>(5043) // Default estimator - fixed value
  const [description, setDescription] = useState('Calitho Suite Estimate Test')
  const [dueDate, setDueDate] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [reference, setReference] = useState('')
  const [parts, setParts] = useState<EstimatePart[]>([
    {
      jobProductTypeId: 'C2',
      jobProductTypeName: 'EQ - Carton | Diecut/Score/Glue',
      description: 'EQ - Carton | Diecut/Score/Glue',
      quantity: 10000,
    }
  ])

  // Lookup data - Mock data for testing
  const [customers] = useState<Customer[]>([
    { id: '00001005', name: 'Test Customer', company: 'Test Company', salesPerson: 19 }
  ])
  const [jobProductTypes] = useState<JobProductType[]>([
    {
      id: 'C2',
      description: 'EQ - Carton | Diecut/Score/Glue',
      componentType: 1,
      colorsSide1: 4,
      colorsSide2: 4,
      colorsTotal: 4,
    }
  ])

  // UI state
  const [loading, setLoading] = useState(false)
  const [loadingData] = useState(false) // Skip loading for testing
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [createdEstimateId, setCreatedEstimateId] = useState<string | null>(null)
  const [createdEstimateData, setCreatedEstimateData] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Load lookup data - DISABLED FOR TESTING
  useEffect(() => {
    // loadLookupData() // Commented out for faster testing
  }, [])

  // Commented out for testing - uncomment when ready to load real data
  /* const loadLookupData = async () => {
    setLoadingData(true)
    try {
      const [customersRes, csrsRes, jobProductTypesRes] = await Promise.all([
        fetch('/api/pace/customers').catch(err => {
          console.error('Customers fetch failed:', err)
          return null
        }),
        fetch('/api/pace/csrs').catch(err => {
          console.error('CSRs fetch failed:', err)
          return null
        }),
        fetch('/api/pace/job-product-types').catch(err => {
          console.error('JobProductTypes fetch failed:', err)
          return null
        }),
      ])

      if (customersRes?.ok) {
        const customersData = await customersRes.json()
        setCustomers(customersData.data || [])
        console.log('Loaded customers:', customersData.data?.length || 0)
      } else if (customersRes) {
        const errorData = await customersRes.json()
        console.error('Customers API error:', errorData)
      }

      if (csrsRes?.ok) {
        const csrsData = await csrsRes.json()
        setCSRs(csrsData.data || [])
        console.log('Loaded CSRs:', csrsData.data?.length || 0)
      } else if (csrsRes) {
        const errorData = await csrsRes.json()
        console.error('CSRs API error:', errorData)
      }

      if (jobProductTypesRes?.ok) {
        const jobProductTypesData = await jobProductTypesRes.json()
        setJobProductTypes(jobProductTypesData.data?.items || [])
        console.log('Loaded JobProductTypes:', jobProductTypesData.data?.items?.length || 0)
      } else if (jobProductTypesRes) {
        const errorData = await jobProductTypesRes.json()
        console.error('JobProductTypes API error:', errorData)
      }

      // Show warning if customers failed to load but allow form to work
      if (!customersRes?.ok) {
        setError('Warning: Could not load customers list. You can still enter a customer ID manually.')
      }
    } catch (err) {
      console.error('Error loading lookup data:', err)
      setError('Failed to load some form data. Check console for details.')
    } finally {
      setLoadingData(false)
    }
  } */

  // Auto-select salesperson when customer changes
  const handleCustomerChange = (customerId: string) => {
    setCustomer(customerId)

    // Find the customer and auto-set their salesperson
    const selectedCustomer = customers.find(c => c.id === customerId)
    if (selectedCustomer?.salesPerson) {
      setSalesPerson(selectedCustomer.salesPerson)
      console.log(`Auto-selected salesperson ${selectedCustomer.salesPerson} from customer ${customerId}`)
    }
  }

  const addPart = () => {
    setParts([
      ...parts,
      {
        jobProductTypeId: '',
        jobProductTypeName: '',
        description: '',
        quantity: 1,
      },
    ])
  }

  const removePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index))
  }

  const updatePart = (index: number, field: keyof EstimatePart, value: any) => {
    const newParts = [...parts]
    newParts[index] = { ...newParts[index], [field]: value }

    // If JobProductType is selected, auto-fill description
    if (field === 'jobProductTypeId' && value) {
      const selectedType = jobProductTypes.find((t) => t.id === value)
      if (selectedType) {
        newParts[index].jobProductTypeName = selectedType.description || ''
        newParts[index].description = selectedType.description || ''
      }
    }

    setParts(newParts)
  }

  const handlePreview = async () => {
    setError(null)
    setLoadingPreview(true)

    try {
      // Validation
      if (!customer) {
        throw new Error('Please select a customer')
      }
      if (!description.trim()) {
        throw new Error('Please enter a description')
      }
      if (parts.length === 0) {
        throw new Error('Please add at least one part')
      }
      for (let i = 0; i < parts.length; i++) {
        if (!parts[i].jobProductTypeId) {
          throw new Error(`Part ${i + 1}: Please select a Job Product Type`)
        }
        if (parts[i].quantity <= 0) {
          throw new Error(`Part ${i + 1}: Quantity must be greater than 0`)
        }
      }

      const response = await fetch('/api/pace/estimates/create-debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer,
          salesPerson: salesPerson || undefined,
          estimator: estimator || undefined,
          description,
          dueDate: dueDate || undefined,
          deliveryDate: deliveryDate || undefined,
          notes: notes || undefined,
          reference: reference || undefined,
          parts: parts.map((p) => ({
            jobProductTypeId: p.jobProductTypeId,
            description: p.description,
            quantity: p.quantity,
          })),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate preview data')
      }

      setPreviewData(result)
      setShowPreview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validation
      if (!customer) {
        throw new Error('Please select a customer')
      }
      if (!description.trim()) {
        throw new Error('Please enter a description')
      }
      if (parts.length === 0) {
        throw new Error('Please add at least one part')
      }
      for (let i = 0; i < parts.length; i++) {
        if (!parts[i].jobProductTypeId) {
          throw new Error(`Part ${i + 1}: Please select a Job Product Type`)
        }
        if (parts[i].quantity <= 0) {
          throw new Error(`Part ${i + 1}: Quantity must be greater than 0`)
        }
      }

      const response = await fetch('/api/pace/estimates/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer,
          salesPerson: salesPerson || undefined,
          estimator: estimator || undefined,
          description,
          dueDate: dueDate || undefined,
          deliveryDate: deliveryDate || undefined,
          notes: notes || undefined,
          reference: reference || undefined,
          parts: parts.map((p) => ({
            jobProductTypeId: p.jobProductTypeId,
            description: p.description,
            quantity: p.quantity,
          })),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create estimate')
      }

      setSuccess(true)
      setCreatedEstimateId(result.estimate.id)
      setCreatedEstimateData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading form data...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success && createdEstimateId) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <CardTitle className="text-green-900">Estimate Created Successfully!</CardTitle>
                <CardDescription className="text-green-700">
                  Your estimate has been created and calculated in PACE
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Estimate Summary */}
            <div className="bg-white p-4 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-gray-600">Estimate ID</p>
              <p className="text-2xl font-bold text-gray-900">{createdEstimateId}</p>
              {createdEstimateData?.estimate?.state && (
                <Badge className="mt-2" variant="secondary">
                  {createdEstimateData.estimate.state}
                </Badge>
              )}
            </div>

            {/* Parts with Paper Info and Pricing */}
            {createdEstimateData?.parts && createdEstimateData.parts.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Parts & Pricing</h3>
                {createdEstimateData.parts.map((part: any, index: number) => (
                  <Card key={index} className="bg-white">
                    <CardHeader>
                      <CardTitle className="text-base">
                        Part {index + 1}: {part.description}
                      </CardTitle>
                      <CardDescription>
                        ID: {part.partId} | Quantity: {part.quantity?.toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Paper Information */}
                      {part.paperInfo && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <h4 className="font-medium text-blue-900 mb-3">Paper Specifications</h4>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-blue-700 font-medium">Paper Type:</span>
                              <span className="ml-2 text-blue-900">{part.paperInfo.paperType}</span>
                            </div>
                            <div>
                              <span className="text-blue-700 font-medium">Standard Type:</span>
                              <span className="ml-2 text-blue-900">{part.paperInfo.standardPaperType}</span>
                            </div>
                            <div>
                              <span className="text-blue-700 font-medium">Weight:</span>
                              <span className="ml-2 text-blue-900">{part.paperInfo.weight}</span>
                            </div>
                            <div>
                              <span className="text-blue-700 font-medium">Buy Size Grain:</span>
                              <span className="ml-2 text-blue-900">{part.paperInfo.buySizeGrain}</span>
                            </div>
                            <div>
                              <span className="text-blue-700 font-medium">Run Size:</span>
                              <span className="ml-2 text-blue-900">{part.paperInfo.runSize}</span>
                            </div>
                            <div>
                              <span className="text-blue-700 font-medium">Paper Price:</span>
                              <span className="ml-2 text-blue-900">
                                ${part.paperInfo.paperPrice} / {part.paperInfo.paperPriceUOM}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Pricing Information */}
                      {part.quantities && part.quantities.length > 0 && (
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <h4 className="font-medium text-green-900 mb-3">Pricing Details</h4>
                          {part.quantities.map((qty: any, qtyIndex: number) => (
                            <div key={qtyIndex} className="mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-b-0 border-green-200">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <span className="text-green-700 font-medium">Quantity:</span>
                                  <span className="ml-2 text-green-900">{qty.quantityOrdered?.toLocaleString()}</span>
                                </div>
                                <div>
                                  <span className="text-green-700 font-medium">Price:</span>
                                  <span className="ml-2 text-green-900 font-semibold">
                                    ${qty.price?.toFixed(2) || '0.00'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-green-700 font-medium">Cost:</span>
                                  <span className="ml-2 text-green-900">
                                    ${qty.cost?.toFixed(2) || '0.00'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-green-700 font-medium">Grand Total:</span>
                                  <span className="ml-2 text-green-900 font-semibold">
                                    ${qty.grandTotal?.toFixed(2) || '0.00'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={() => router.push('/estimates')} variant="outline">
                View All Estimates
              </Button>
              <Button onClick={() => window.location.reload()}>
                Create Another Estimate
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Create New Estimate</h1>
        <p className="text-muted-foreground mt-1">
          Create an estimate with multiple parts using Job Product Type templates
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Estimate Information</CardTitle>
            <CardDescription>Basic details about the estimate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              {customers.length > 0 ? (
                <select
                  value={customer}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  required
                >
                  <option value="">Select a customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company && c.company !== c.name && `(${c.company})`}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="Enter customer ID (e.g., 00001005)"
                  required
                />
              )}
              <p className="text-xs text-gray-500 mt-1">
                {customers.length > 0
                  ? `${customers.length} customers available`
                  : 'Enter customer ID directly'}
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the estimate"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sales Person - Auto-populated from customer */}
              <div>
                <label className="block text-sm font-medium mb-1">Salesperson ID</label>
                <Input
                  type="number"
                  value={salesPerson}
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                  placeholder="Auto-populated from customer"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Auto-populated from customer's salesperson
                </p>
              </div>

              {/* Estimator - Fixed to 5043 */}
              <div>
                <label className="block text-sm font-medium mb-1">Estimator ID</label>
                <Input
                  type="number"
                  value={5043}
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Fixed estimator ID
                </p>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium mb-1">Due Date</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              {/* Delivery Date */}
              <div>
                <label className="block text-sm font-medium mb-1">Delivery Date</label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
            </div>

            {/* Reference */}
            <div>
              <label className="block text-sm font-medium mb-1">Reference</label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="PO number, project code, etc."
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                rows={3}
                placeholder="Additional notes or instructions"
              />
            </div>
          </CardContent>
        </Card>

        {/* Parts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Parts</CardTitle>
                <CardDescription>
                  Add parts using Job Product Type templates
                </CardDescription>
              </div>
              <Button type="button" onClick={addPart} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Part
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {parts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="mb-2">No parts added yet</p>
                <Button type="button" onClick={addPart} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Part
                </Button>
              </div>
            ) : (
              parts.map((part, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary">Part {index + 1}</Badge>
                    <Button
                      type="button"
                      onClick={() => removePart(index)}
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Job Product Type */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Job Product Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={part.jobProductTypeId}
                      onChange={(e) =>
                        updatePart(index, 'jobProductTypeId', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
                      required
                    >
                      <option value="">Select a type...</option>
                      {jobProductTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.description || type.id}
                        </option>
                      ))}
                    </select>
                    {part.jobProductTypeId && (
                      <p className="text-xs text-gray-500 mt-1">
                        Defaults will be inherited from this product type
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Description */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Description</label>
                      <Input
                        value={part.description}
                        onChange={(e) =>
                          updatePart(index, 'description', e.target.value)
                        }
                        placeholder="Override default description"
                      />
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Quantity <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={part.quantity}
                        onChange={(e) =>
                          updatePart(index, 'quantity', parseInt(e.target.value) || 1)
                        }
                        required
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-start gap-3 pt-6">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview Data Section */}
        {showPreview && previewData && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-blue-900">Data Preview</CardTitle>
                  <CardDescription className="text-blue-700">
                    Review all data that will be sent to PACE API
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                  className="text-blue-700 hover:text-blue-900"
                >
                  {showPreview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Hide
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Step 1: Estimate Data */}
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Step 1: Create Estimate
                </h4>
                <p className="text-xs text-gray-500 mb-3 font-mono">POST /CreateObject/createEstimate</p>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                  {JSON.stringify(previewData.step1_estimateData, null, 2)}
                </pre>
              </div>

              {/* Step 2: Estimate Part Data */}
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Step 2: Create Estimate Part
                </h4>
                <p className="text-xs text-gray-500 mb-3 font-mono">POST /CreateObject/createEstimatePart</p>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                  {JSON.stringify(previewData.step2_estimatePartData, null, 2)}
                </pre>
              </div>

              {/* Step 3: Estimate Quantity Data */}
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Step 3: Create Estimate Quantity
                </h4>
                <p className="text-xs text-gray-500 mb-3 font-mono">POST /CreateObject/createEstimateQuantity</p>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                  {JSON.stringify(previewData.step3_estimateQuantityData, null, 2)}
                </pre>
              </div>

              {/* Step 4: Estimate Paper Data */}
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Step 4: Create Estimate Paper
                </h4>
                <p className="text-xs text-gray-500 mb-3 font-mono">POST /CreateObject/createEstimatePaper</p>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                  {JSON.stringify(previewData.step4_estimatePaperData, null, 2)}
                </pre>
              </div>

              {/* Step 5: Estimate Press Data */}
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Step 5: Create Estimate Press
                </h4>
                <p className="text-xs text-gray-500 mb-3 font-mono">POST /CreateObject/createEstimatePress</p>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                  {JSON.stringify(previewData.step5_estimatePressData, null, 2)}
                </pre>
              </div>

              {/* Summary */}
              <div className="bg-white p-4 rounded-lg border border-blue-300">
                <h4 className="font-semibold text-blue-900 mb-3">Summary</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-blue-700">Customer:</span>
                    <span className="ml-2 text-blue-900">{previewData.step1_estimateData.customer}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Estimate Number:</span>
                    <span className="ml-2 text-blue-900">{previewData.step1_estimateData.estimateNumber}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Sales Person:</span>
                    <span className="ml-2 text-blue-900">{previewData.step1_estimateData.salesPerson}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Estimator:</span>
                    <span className="ml-2 text-blue-900">{previewData.step1_estimateData.estimator}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Job Product Type:</span>
                    <span className="ml-2 text-blue-900">{previewData.step2_estimatePartData.jobProductType}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Quantity:</span>
                    <span className="ml-2 text-blue-900">{previewData.step3_estimateQuantityData.quantityOrdered?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Paper Inventory Item:</span>
                    <span className="ml-2 text-blue-900">{previewData.step4_estimatePaperData.inventoryItem}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Press:</span>
                    <span className="ml-2 text-blue-900">{previewData.step5_estimatePressData.press}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Press Forced:</span>
                    <span className="ml-2 text-blue-900">{previewData.step5_estimatePressData.pressForced ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading || loadingPreview}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handlePreview}
            disabled={loading || loadingPreview || parts.length === 0}
          >
            {loadingPreview ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                Loading Preview...
              </>
            ) : (
              'Review Data'
            )}
          </Button>
          <Button type="submit" disabled={loading || loadingPreview || parts.length === 0}>
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating Estimate...
              </>
            ) : (
              'Create Estimate'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

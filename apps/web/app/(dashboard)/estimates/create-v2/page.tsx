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
  inkType?: string
  salesCategory?: number
  productionType?: number
  prepressWorkflow?: number
  shippingWorkflow?: number
  foldPatternKey?: string
  itemsFoldPattern?: number
  numPages?: number
  numSigs?: number
  secondWeb?: boolean
  standardPaperType?: number
  paperType?: string
  weight?: number
  buySizeGrain?: string
  paperPrice?: number
  paperPriceUOM?: string
  usePriceListPricing?: boolean
}

type SalesPerson = {
  id: number
  name: string
  email?: string
}

type InventoryItem = {
  id: string
  description: string
  sizeWidth?: number
  sizeLength?: number
}

type EstimatePart = {
  jobProductTypeId: string
  jobProductTypeName: string
  description: string
  quantities: number[] // Changed from single quantity to array
  sequence?: number
  finalSizeWidth?: number
  finalSizeHeight?: number
  runSizeWidth?: number
  runSizeHeight?: number
  buySizeWidth?: number
  buySizeHeight?: number
  inventoryItem?: string
  componentType?: number
  colorsSide1?: number
  colorsSide2?: number
  colorsTotal?: number
  inkType?: string
  salesCategory?: number
  usePriceListPricing?: boolean
  productionType?: number
  prepressWorkflow?: number
  shippingWorkflow?: number
  foldPatternKey?: string
  itemsFoldPattern?: number
  numPages?: number
  numSigs?: number
  secondWeb?: boolean
  standardPaperType?: number
  paperType?: string
  weight?: number
  buySizeGrain?: string
  paperPrice?: number
  paperPriceUOM?: string
}

export default function CreateEstimatePage() {
  const router = useRouter()

  // Form state
  const [customer, setCustomer] = useState('') // No default, user will select
  const [salesPerson, setSalesPerson] = useState<number | ''>('') // Auto-populated from customer
  const [estimator] = useState<number | ''>(5043) // Default estimator - fixed value
  const [description, setDescription] = useState('Calitho Suite Estimate Test')
  const [parts, setParts] = useState<EstimatePart[]>([])

  // Lookup data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([])
  const [_csrs, setCSRs] = useState<SalesPerson[]>([])
  const [estimators, setEstimators] = useState<SalesPerson[]>([])
  const [jobProductTypes, setJobProductTypes] = useState<JobProductType[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [allowedJobProductTypes, setAllowedJobProductTypes] = useState<Array<{
    jobProductTypeId: string
    customName?: string
    customDescription?: string
    allowedInventoryItemIds: string[]
  }>>([])
  const [allowedJobProductTypeIds, setAllowedJobProductTypeIds] = useState<string[]>([])

  // UI state
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [createdEstimateId, setCreatedEstimateId] = useState<string | null>(null)
  const [createdEstimateData, setCreatedEstimateData] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [expandedParts, setExpandedParts] = useState<{ [key: string]: boolean }>({})
  const [markups, setMarkups] = useState<{ [key: string]: number }>({}) // Store markup % per quantity

  // Load lookup data
  useEffect(() => {
    loadLookupData()
  }, [])

  const loadLookupData = async () => {
    setLoadingData(true)
    try {
      const [customersRes, salespeopleRes, csrsRes, estimatorsRes, jobProductTypesRes, inventoryItemsRes, estimateSettingsRes] = await Promise.all([
        fetch('/api/pace/customers').catch(err => {
          console.error('Customers fetch failed:', err)
          return null
        }),
        fetch('/api/pace/salespeople').catch(err => {
          console.error('Salespeople fetch failed:', err)
          return null
        }),
        fetch('/api/pace/csrs').catch(err => {
          console.error('CSRs fetch failed:', err)
          return null
        }),
        fetch('/api/pace/estimators').catch(err => {
          console.error('Estimators fetch failed:', err)
          return null
        }),
        fetch('/api/pace/job-product-types').catch(err => {
          console.error('Job Product Types fetch failed:', err)
          return null
        }),
        fetch('/api/pace/inventory-items').catch(err => {
          console.error('Inventory Items fetch failed:', err)
          return null
        }),
        fetch('/api/settings/estimate-settings').catch(err => {
          console.error('Estimate Settings fetch failed:', err)
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
        setError('Warning: Could not load customers list. You can still enter a customer ID manually.')
      }

      if (salespeopleRes?.ok) {
        const salespeopleData = await salespeopleRes.json()
        setSalesPeople(salespeopleData.data || [])
        console.log('Loaded salespeople:', salespeopleData.data?.length || 0)
        console.log('Salespeople data:', salespeopleData.data)
      } else if (salespeopleRes) {
        const errorData = await salespeopleRes.json()
        console.error('Salespeople API error:', errorData)
      }

      if (csrsRes?.ok) {
        const csrsData = await csrsRes.json()
        setCSRs(csrsData.data || [])
        console.log('Loaded CSRs:', csrsData.data?.length || 0)
      } else if (csrsRes) {
        const errorData = await csrsRes.json()
        console.error('CSRs API error:', errorData)
      }

      if (estimatorsRes?.ok) {
        const estimatorsData = await estimatorsRes.json()
        setEstimators(estimatorsData.data || [])
        console.log('Loaded Estimators:', estimatorsData.data?.length || 0)
      } else if (estimatorsRes) {
        const errorData = await estimatorsRes.json()
        console.error('Estimators API error:', errorData)
      }

      if (jobProductTypesRes?.ok) {
        const jobProductTypesData = await jobProductTypesRes.json()
        setJobProductTypes(jobProductTypesData.data?.items || [])
        console.log('Loaded Job Product Types:', jobProductTypesData.data?.items?.length || 0)
      } else if (jobProductTypesRes) {
        const errorData = await jobProductTypesRes.json()
        console.error('Job Product Types API error:', errorData)
      }

      // Store inventory items data for later use
      let loadedInventoryItems: InventoryItem[] = []

      if (inventoryItemsRes?.ok) {
        const inventoryItemsData = await inventoryItemsRes.json()
        loadedInventoryItems = inventoryItemsData.data || []
        setInventoryItems(loadedInventoryItems)
        console.log('Loaded Inventory Items:', loadedInventoryItems.length)
      } else if (inventoryItemsRes) {
        const errorData = await inventoryItemsRes.json()
        console.error('Inventory Items API error:', errorData)
      }

      if (estimateSettingsRes?.ok) {
        const estimateSettingsData = await estimateSettingsRes.json()
        if (estimateSettingsData.estimateSettings?.allowedJobProductTypes) {
          // New format with custom names and inventory items
          setAllowedJobProductTypes(estimateSettingsData.estimateSettings.allowedJobProductTypes)
          const ids = estimateSettingsData.estimateSettings.allowedJobProductTypes.map((jpt: any) => jpt.jobProductTypeId)
          setAllowedJobProductTypeIds(ids)
          console.log('Loaded Estimate Settings:', ids.length, 'configured types')

          // Collect all unique linked inventory item IDs
          const linkedInventoryItemIds = new Set<string>()
          estimateSettingsData.estimateSettings.allowedJobProductTypes.forEach((jpt: any) => {
            jpt.allowedInventoryItemIds?.forEach((itemId: string) => linkedInventoryItemIds.add(itemId))
          })

          // Fetch details for linked inventory items that might not be in the main list
          if (linkedInventoryItemIds.size > 0) {
            console.log('Fetching', linkedInventoryItemIds.size, 'linked inventory items')
            const linkedItemsPromises = Array.from(linkedInventoryItemIds).map(async (itemId) => {
              try {
                const itemRes = await fetch(`/api/pace/inventory-items/${encodeURIComponent(itemId)}`)
                const itemData = await itemRes.json()
                if (itemRes.ok && itemData.data) {
                  return itemData.data
                }
              } catch (error) {
                console.error(`Error fetching linked inventory item ${itemId}:`, error)
              }
              return null
            })

            const linkedItems = (await Promise.all(linkedItemsPromises)).filter((item): item is InventoryItem => item !== null)

            // Merge linked items with existing inventory items (avoid duplicates)
            const existingIds = new Set(loadedInventoryItems.map((item: InventoryItem) => item.id))
            const newItems = linkedItems.filter(item => !existingIds.has(item.id))

            if (newItems.length > 0) {
              console.log('Added', newItems.length, 'linked inventory items to the list')
              setInventoryItems([...loadedInventoryItems, ...newItems])
            }
          }
        } else if (estimateSettingsData.estimateSettings?.allowedJobProductTypeIds) {
          // Old format - just IDs
          setAllowedJobProductTypeIds(estimateSettingsData.estimateSettings.allowedJobProductTypeIds)
          console.log('Loaded Estimate Settings (legacy):', estimateSettingsData.estimateSettings.allowedJobProductTypeIds.length, 'allowed types')
        }
      } else if (estimateSettingsRes) {
        const errorData = await estimateSettingsRes.json()
        console.error('Estimate Settings API error:', errorData)
      }
    } catch (err) {
      console.error('Error loading lookup data:', err)
      setError('Failed to load customer data. Check console for details.')
    } finally {
      setLoadingData(false)
    }
  }

  // Filter job product types based on settings
  // If allowedJobProductTypeIds is empty, show all types
  // If it has values, only show the allowed types
  const filteredJobProductTypes = allowedJobProductTypeIds.length > 0
    ? jobProductTypes.filter(jpt => allowedJobProductTypeIds.includes(jpt.id))
    : jobProductTypes

  // Get custom name for a job product type (if configured)
  const getJobProductTypeName = (jptId: string) => {
    const config = allowedJobProductTypes.find(ajpt => ajpt.jobProductTypeId === jptId)
    if (config?.customName) return config.customName

    const jpt = jobProductTypes.find(j => j.id === jptId)
    return jpt?.description || jptId
  }

  // Get custom description for a job product type (if configured)
  const getJobProductTypeDescription = (jptId: string) => {
    const config = allowedJobProductTypes.find(ajpt => ajpt.jobProductTypeId === jptId)
    return config?.customDescription
  }

  // Get filtered inventory items for a specific job product type
  const getFilteredInventoryItems = (jptId: string) => {
    const config = allowedJobProductTypes.find(ajpt => ajpt.jobProductTypeId === jptId)

    // If this job product type has linked inventory items, filter to only those
    if (config && config.allowedInventoryItemIds.length > 0) {
      return inventoryItems.filter(item => config.allowedInventoryItemIds.includes(item.id))
    }

    // Otherwise, return all inventory items
    return inventoryItems
  }

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
        quantities: [1000], // Start with one default quantity
        sequence: (parts.length + 1) * 10,
        numSigs: 1,
      },
    ])
  }

  const addQuantity = (partIndex: number) => {
    const newParts = [...parts]
    const lastQuantity = newParts[partIndex].quantities[newParts[partIndex].quantities.length - 1] || 1000
    newParts[partIndex].quantities.push(lastQuantity)
    setParts(newParts)
  }

  const removeQuantity = (partIndex: number, quantityIndex: number) => {
    const newParts = [...parts]
    if (newParts[partIndex].quantities.length > 1) {
      newParts[partIndex].quantities.splice(quantityIndex, 1)
      setParts(newParts)
    }
  }

  const updateQuantity = (partIndex: number, quantityIndex: number, value: number) => {
    const newParts = [...parts]
    newParts[partIndex].quantities[quantityIndex] = value
    setParts(newParts)
  }

  const removePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index))
  }

  const updatePart = (index: number, field: keyof EstimatePart, value: any) => {
    const newParts = [...parts]
    newParts[index] = { ...newParts[index], [field]: value }
    console.log(`Updating part ${index}, field ${field} to:`, value)

    // If JobProductType is selected, auto-fill ALL fields from the template
    if (field === 'jobProductTypeId' && value) {
      const selectedType = jobProductTypes.find((t) => t.id === value)
      if (selectedType) {
        console.log('Selected Job Product Type:', selectedType)

        // Calculate foldPatternKey from numPages and itemsFoldPattern
        const foldPatternKey = selectedType.numPages && selectedType.itemsFoldPattern
          ? `${selectedType.numPages}:${selectedType.itemsFoldPattern}`
          : selectedType.foldPatternKey

        newParts[index] = {
          ...newParts[index],
          jobProductTypeName: selectedType.description || '',
          description: selectedType.description || '',
          // Copy all fields from Job Product Type
          componentType: selectedType.componentType,
          colorsSide1: selectedType.colorsSide1,
          colorsSide2: selectedType.colorsSide2,
          colorsTotal: selectedType.colorsTotal,
          inkType: selectedType.inkType,
          salesCategory: selectedType.salesCategory,
          productionType: selectedType.productionType,
          prepressWorkflow: selectedType.prepressWorkflow,
          shippingWorkflow: selectedType.shippingWorkflow,
          foldPatternKey: foldPatternKey,
          itemsFoldPattern: selectedType.itemsFoldPattern,
          numPages: selectedType.numPages,
          // numSigs is user-editable and not from product type
          secondWeb: selectedType.secondWeb,
          standardPaperType: selectedType.standardPaperType,
          paperType: selectedType.paperType,
          weight: selectedType.weight,
          buySizeGrain: selectedType.buySizeGrain,
          paperPrice: selectedType.paperPrice,
          paperPriceUOM: selectedType.paperPriceUOM,
          usePriceListPricing: selectedType.usePriceListPricing,
        }
      }
    }

    // If InventoryItem is selected, auto-fill Run Size and Buy Size from inventory item size
    if (field === 'inventoryItem' && value) {
      const selectedItem = inventoryItems.find((i) => i.id === value)
      if (selectedItem) {
        console.log('Selected Inventory Item:', selectedItem)
        newParts[index].runSizeWidth = selectedItem.sizeWidth
        newParts[index].runSizeHeight = selectedItem.sizeLength
        newParts[index].buySizeWidth = selectedItem.sizeWidth
        newParts[index].buySizeHeight = selectedItem.sizeLength
      }
    }

    console.log('Updated parts state:', newParts)
    setParts(newParts)
  }

  const handlePreview = async () => {
    setError(null)
    setLoadingPreview(true)

    try {
      console.log('Preview - Current parts state:', parts)

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
        if (!parts[i].description?.trim()) {
          throw new Error(`Part ${i + 1}: Description is required`)
        }
        if (!parts[i].sequence) {
          throw new Error(`Part ${i + 1}: Sequence is required`)
        }
        if (!parts[i].quantities || parts[i].quantities.length === 0) {
          throw new Error(`Part ${i + 1}: Please add at least one quantity`)
        }
        if (parts[i].quantities.some(q => q <= 0)) {
          throw new Error(`Part ${i + 1}: All quantities must be greater than 0`)
        }
        if (!parts[i].finalSizeWidth || !parts[i].finalSizeHeight) {
          throw new Error(`Part ${i + 1}: Final size (width and height) is required`)
        }
        if (!parts[i].numSigs) {
          throw new Error(`Part ${i + 1}: Number of versions is required`)
        }
        if (!parts[i].inventoryItem) {
          throw new Error(`Part ${i + 1}: Inventory item is required`)
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
          parts: parts.map((p) => ({
            jobProductTypeId: p.jobProductTypeId,
            description: p.description,
            quantities: p.quantities,
            sequence: p.sequence,
            finalSizeWidth: p.finalSizeWidth,
            finalSizeHeight: p.finalSizeHeight,
            runSizeWidth: p.runSizeWidth,
            runSizeHeight: p.runSizeHeight,
            buySizeWidth: p.buySizeWidth,
            buySizeHeight: p.buySizeHeight,
            inventoryItem: p.inventoryItem,
            componentType: p.componentType,
            colorsSide1: p.colorsSide1,
            colorsSide2: p.colorsSide2,
            colorsTotal: p.colorsTotal,
            inkType: p.inkType,
            salesCategory: p.salesCategory,
            usePriceListPricing: p.usePriceListPricing,
            productionType: p.productionType,
            prepressWorkflow: p.prepressWorkflow,
            shippingWorkflow: p.shippingWorkflow,
            foldPatternKey: p.foldPatternKey,
            itemsFoldPattern: p.itemsFoldPattern,
            numPages: p.numPages,
            numSigs: p.numSigs,
            secondWeb: p.secondWeb,
            standardPaperType: p.standardPaperType,
            paperType: p.paperType,
            weight: p.weight,
            buySizeGrain: p.buySizeGrain,
            paperPrice: p.paperPrice,
            paperPriceUOM: p.paperPriceUOM,
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
        if (!parts[i].description?.trim()) {
          throw new Error(`Part ${i + 1}: Description is required`)
        }
        if (!parts[i].sequence) {
          throw new Error(`Part ${i + 1}: Sequence is required`)
        }
        if (!parts[i].quantities || parts[i].quantities.length === 0) {
          throw new Error(`Part ${i + 1}: Please add at least one quantity`)
        }
        if (parts[i].quantities.some(q => q <= 0)) {
          throw new Error(`Part ${i + 1}: All quantities must be greater than 0`)
        }
        if (!parts[i].finalSizeWidth || !parts[i].finalSizeHeight) {
          throw new Error(`Part ${i + 1}: Final size (width and height) is required`)
        }
        if (!parts[i].numSigs) {
          throw new Error(`Part ${i + 1}: Number of versions is required`)
        }
        if (!parts[i].inventoryItem) {
          throw new Error(`Part ${i + 1}: Inventory item is required`)
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
          parts: parts.map((p) => ({
            jobProductTypeId: p.jobProductTypeId,
            description: p.description,
            quantities: p.quantities,
            sequence: p.sequence,
            finalSizeWidth: p.finalSizeWidth,
            finalSizeHeight: p.finalSizeHeight,
            runSizeWidth: p.runSizeWidth,
            runSizeHeight: p.runSizeHeight,
            buySizeWidth: p.buySizeWidth,
            buySizeHeight: p.buySizeHeight,
            inventoryItem: p.inventoryItem,
            componentType: p.componentType,
            colorsSide1: p.colorsSide1,
            colorsSide2: p.colorsSide2,
            colorsTotal: p.colorsTotal,
            inkType: p.inkType,
            salesCategory: p.salesCategory,
            usePriceListPricing: p.usePriceListPricing,
            productionType: p.productionType,
            prepressWorkflow: p.prepressWorkflow,
            shippingWorkflow: p.shippingWorkflow,
            foldPatternKey: p.foldPatternKey,
            itemsFoldPattern: p.itemsFoldPattern,
            numPages: p.numPages,
            numSigs: p.numSigs,
            secondWeb: p.secondWeb,
            standardPaperType: p.standardPaperType,
            paperType: p.paperType,
            weight: p.weight,
            buySizeGrain: p.buySizeGrain,
            paperPrice: p.paperPrice,
            paperPriceUOM: p.paperPriceUOM,
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

  const handleNewEstimate = () => {
    setSuccess(false)
    setCreatedEstimateId(null)
    setCreatedEstimateData(null)
    setError(null)
    // Optionally reset form fields if you want
    // setCustomer('')
    // setSalesPerson('')
    // setDescription('Calitho Suite Estimate Test')
    // setParts([])
  }

  return (
    <div className="container mx-auto p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Create New Estimate</h1>
        <p className="text-muted-foreground mt-1">
          Create an estimate with multiple parts using Job Product Type templates
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Form (60%) */}
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Estimate Information</CardTitle>
            <CardDescription>Basic details about the estimate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer, Salesperson, and Estimator Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        {c.id} - {c.name}
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

              {/* Sales Person - Auto-populated from customer */}
              <div>
                <label className="block text-sm font-medium mb-1">Salesperson</label>
                <Input
                  type="text"
                  value={
                    salesPerson
                      ? salesPeople.find(sp => sp.id === Number(salesPerson))?.name || `ID: ${salesPerson}`
                      : ''
                  }
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
                <label className="block text-sm font-medium mb-1">Estimator</label>
                <Input
                  type="text"
                  value={
                    estimator
                      ? estimators.find(est => est.id === Number(estimator))?.name || `ID: ${estimator}`
                      : ''
                  }
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Fixed estimator ID: 5043
                </p>
              </div>
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
                      {filteredJobProductTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {getJobProductTypeName(type.id)}
                        </option>
                      ))}
                    </select>
                    {part.jobProductTypeId && getJobProductTypeDescription(part.jobProductTypeId) && (
                      <p className="text-xs text-blue-600 mt-1 bg-blue-50 p-2 rounded border border-blue-200">
                        {getJobProductTypeDescription(part.jobProductTypeId)}
                      </p>
                    )}
                    {part.jobProductTypeId && (
                      <p className="text-xs text-gray-500 mt-1">
                        Defaults will be inherited from this product type
                      </p>
                    )}
                    {allowedJobProductTypeIds.length > 0 && filteredJobProductTypes.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        No Job Product Types configured. Go to Settings → Estimates to add types.
                      </p>
                    )}
                  </div>

                  {/* Description and Inventory Item */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={part.description}
                        onChange={(e) =>
                          updatePart(index, 'description', e.target.value)
                        }
                        placeholder="Override default description"
                        required
                      />
                    </div>

                    {/* Inventory Item */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Inventory Item <span className="text-red-500">*</span>
                      </label>
                      {inventoryItems.length > 0 ? (
                        <>
                          <select
                            value={part.inventoryItem || ''}
                            onChange={(e) =>
                              updatePart(index, 'inventoryItem', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
                            required
                            disabled={!part.jobProductTypeId}
                          >
                            <option value="">
                              {part.jobProductTypeId ? 'Select inventory item...' : 'Select a Job Product Type first'}
                            </option>
                            {part.jobProductTypeId && getFilteredInventoryItems(part.jobProductTypeId).map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.id} - {item.description}
                                {item.sizeWidth && item.sizeLength && ` (${item.sizeWidth} × ${item.sizeLength})`}
                              </option>
                            ))}
                          </select>
                          {part.jobProductTypeId && getFilteredInventoryItems(part.jobProductTypeId).length === 0 && (
                            <p className="text-xs text-amber-600 mt-1">
                              No inventory items linked to this product type. Configure them in Settings → Estimates.
                            </p>
                          )}
                          {part.jobProductTypeId && getFilteredInventoryItems(part.jobProductTypeId).length < inventoryItems.length && (
                            <p className="text-xs text-blue-600 mt-1">
                              Showing {getFilteredInventoryItems(part.jobProductTypeId).length} of {inventoryItems.length} items (filtered by product type)
                            </p>
                          )}
                        </>
                      ) : (
                        <Input
                          value={part.inventoryItem || ''}
                          onChange={(e) =>
                            updatePart(index, 'inventoryItem', e.target.value)
                          }
                          placeholder="Loading..."
                          disabled
                        />
                      )}
                    </div>
                  </div>

                  {/* Final Size, # of versions, and Quantities - All in one row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Final Size */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Final Size <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={part.finalSizeWidth || ''}
                          onChange={(e) =>
                            updatePart(index, 'finalSizeWidth', parseFloat(e.target.value) || undefined)
                          }
                          placeholder="Width"
                          className="flex-1"
                          required
                        />
                        <span className="text-gray-500 font-medium">×</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={part.finalSizeHeight || ''}
                          onChange={(e) =>
                            updatePart(index, 'finalSizeHeight', parseFloat(e.target.value) || undefined)
                          }
                          placeholder="Height"
                          className="flex-1"
                          required
                        />
                      </div>
                    </div>

                    {/* # of versions (numSigs) */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        # of versions <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={part.numSigs || 1}
                        onChange={(e) =>
                          updatePart(index, 'numSigs', parseInt(e.target.value) || 1)
                        }
                        placeholder="Number of versions"
                        required
                      />
                    </div>

                    {/* Quantities */}
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-amber-900">
                          Quantities <span className="text-red-500">*</span>
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addQuantity(index)}
                          className="h-7 text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {part.quantities.map((qty, qtyIndex) => (
                          <div key={qtyIndex} className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              value={qty}
                              onChange={(e) =>
                                updateQuantity(index, qtyIndex, parseInt(e.target.value) || 1)
                              }
                              className="flex-1"
                              placeholder="Quantity"
                              required
                            />
                            {part.quantities.length > 1 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removeQuantity(index, qtyIndex)}
                                className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Advanced Options - Collapsible */}
                  <div className="bg-gray-50 rounded-lg border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setExpandedParts({ ...expandedParts, [`${index}-advanced`]: !expandedParts[`${index}-advanced`] })}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-100 transition-colors"
                    >
                      <h4 className="font-medium text-sm text-gray-700">
                        Advanced Options
                      </h4>
                      {expandedParts[`${index}-advanced`] ? (
                        <ChevronUp className="h-4 w-4 text-gray-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-600" />
                      )}
                    </button>

                    {expandedParts[`${index}-advanced`] && (
                      <div className="px-3 pb-3 space-y-3">
                        {/* Sequence */}
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Sequence <span className="text-red-500">*</span>
                          </label>
                          <Input
                            type="number"
                            value={part.sequence || ''}
                            onChange={(e) =>
                              updatePart(index, 'sequence', parseInt(e.target.value) || undefined)
                            }
                            required
                            className="w-full md:w-1/2"
                          />
                        </div>

                        {/* Run Size and Buy Size */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Run Size - Read Only */}
                          <div>
                            <label className="block text-sm font-medium mb-1">Run Size</label>
                            <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-md border border-gray-300">
                              <span className="flex-1 text-gray-700">
                                {part.runSizeWidth || '-'}
                              </span>
                              <span className="text-gray-500 font-medium">×</span>
                              <span className="flex-1 text-gray-700">
                                {part.runSizeHeight || '-'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Auto-filled from inventory item</p>
                          </div>

                          {/* Buy Size - Read Only */}
                          <div>
                            <label className="block text-sm font-medium mb-1">Buy Size</label>
                            <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-md border border-gray-300">
                              <span className="flex-1 text-gray-700">
                                {part.buySizeWidth || '-'}
                              </span>
                              <span className="text-gray-500 font-medium">×</span>
                              <span className="flex-1 text-gray-700">
                                {part.buySizeHeight || '-'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Auto-filled from inventory item</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Color & Component Details (Read-Only from Job Product Type) - Collapsible */}
                  <div className="bg-purple-50 rounded-lg border border-purple-200">
                    <button
                      type="button"
                      onClick={() => setExpandedParts({ ...expandedParts, [`${index}-colors`]: !expandedParts[`${index}-colors`] })}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-purple-100 transition-colors"
                    >
                      <h4 className="font-medium text-sm text-purple-900">
                        Color & Component Details (Read-Only)
                      </h4>
                      {expandedParts[`${index}-colors`] ? (
                        <ChevronUp className="h-4 w-4 text-purple-700" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-purple-700" />
                      )}
                    </button>

                    {expandedParts[`${index}-colors`] && (
                      <div className="px-3 pb-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div>
                            <span className="text-xs font-medium text-purple-700">Component Type:</span>
                            <p className="text-purple-900">{part.componentType ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Colors Side 1:</span>
                            <p className="text-purple-900">{part.colorsSide1 ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Colors Side 2:</span>
                            <p className="text-purple-900">{part.colorsSide2 ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Colors Total:</span>
                            <p className="text-purple-900">{part.colorsTotal ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Ink Type:</span>
                            <p className="text-purple-900">{part.inkType ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Sales Category:</span>
                            <p className="text-purple-900">{part.salesCategory ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Fold Pattern Key:</span>
                            <p className="text-purple-900">{part.foldPatternKey ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Num Pages:</span>
                            <p className="text-purple-900">{part.numPages ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Fold Pattern (Items):</span>
                            <p className="text-purple-900">{part.itemsFoldPattern ?? 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Production & Paper Specifications (Read-Only from Job Product Type) - Collapsible */}
                  <div className="bg-purple-50 rounded-lg border border-purple-200">
                    <button
                      type="button"
                      onClick={() => setExpandedParts({ ...expandedParts, [`${index}-production`]: !expandedParts[`${index}-production`] })}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-purple-100 transition-colors"
                    >
                      <h4 className="font-medium text-sm text-purple-900">
                        Production & Paper Specifications (Read-Only)
                      </h4>
                      {expandedParts[`${index}-production`] ? (
                        <ChevronUp className="h-4 w-4 text-purple-700" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-purple-700" />
                      )}
                    </button>

                    {expandedParts[`${index}-production`] && (
                      <div className="px-3 pb-3">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                          <div>
                            <span className="text-xs font-medium text-purple-700">Production Type:</span>
                            <p className="text-purple-900">{part.productionType ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Prepress Workflow:</span>
                            <p className="text-purple-900">{part.prepressWorkflow ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Shipping Workflow:</span>
                            <p className="text-purple-900">{part.shippingWorkflow ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Second Web:</span>
                            <p className="text-purple-900">{part.secondWeb ? 'Yes' : 'No'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Std Paper Type:</span>
                            <p className="text-purple-900">{part.standardPaperType ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Paper Type:</span>
                            <p className="text-purple-900">{part.paperType ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Weight:</span>
                            <p className="text-purple-900">{part.weight ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Buy Size Grain:</span>
                            <p className="text-purple-900">{part.buySizeGrain ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Paper Price:</span>
                            <p className="text-purple-900">{part.paperPrice ? `$${part.paperPrice}` : 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Paper Price UOM:</span>
                            <p className="text-purple-900">{part.paperPriceUOM ?? 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-purple-700">Use Price List:</span>
                            <p className="text-purple-900">{part.usePriceListPricing ? 'Yes' : 'No'}</p>
                          </div>
                        </div>
                      </div>
                    )}
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

        {/* Preview Data Section - Collapsible */}
        {showPreview && previewData && (
          <details className="group">
            <summary className="cursor-pointer list-none">
              <Card className="border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-blue-900 text-sm">Technical Preview</CardTitle>
                      <CardDescription className="text-blue-700 text-xs">
                        Click to view API data details
                      </CardDescription>
                    </div>
                    <ChevronDown className="h-4 w-4 text-blue-700 group-open:rotate-180 transition-transform" />
                  </div>
                </CardHeader>
              </Card>
            </summary>
            <Card className="border-blue-200 bg-blue-50 mt-2">
              <CardContent className="pt-4 space-y-3">
                {/* Compact Summary */}
                <div className="bg-white p-3 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2 text-xs">Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="font-medium text-blue-700">Customer:</span>
                      <span className="ml-1 text-blue-900">{previewData.step1_estimateData.customer}</span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-700">Estimator:</span>
                      <span className="ml-1 text-blue-900">{previewData.step1_estimateData.estimator}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium text-blue-700">Job Product Type:</span>
                      <span className="ml-1 text-blue-900">{previewData.step2_estimatePartData.jobProductType}</span>
                    </div>
                  </div>
                </div>

                {/* Expandable JSON Data */}
                <details className="bg-white p-3 rounded-lg border border-blue-200">
                  <summary className="cursor-pointer font-semibold text-blue-900 text-xs">
                    View Full API Payload
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div>
                      <p className="text-xs text-gray-500 font-mono mb-1">Step 1: Estimate</p>
                      <pre className="bg-gray-100 p-2 rounded text-[10px] overflow-x-auto">
                        {JSON.stringify(previewData.step1_estimateData, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-mono mb-1">Step 2: Part</p>
                      <pre className="bg-gray-100 p-2 rounded text-[10px] overflow-x-auto">
                        {JSON.stringify(previewData.step2_estimatePartData, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-mono mb-1">Step 3: Quantity</p>
                      <pre className="bg-gray-100 p-2 rounded text-[10px] overflow-x-auto">
                        {JSON.stringify(previewData.step3_estimateQuantityData, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
              </CardContent>
            </Card>
          </details>
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

        {/* Right Column - Results (40%) */}
        <div className="lg:col-span-2">
          {!success && !createdEstimateId && (
            <Card className="sticky top-6 border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-gray-400 mb-4">
                  <CheckCircle className="h-16 w-16 mx-auto" />
                </div>
                <p className="text-gray-500 font-medium">No estimate yet</p>
                <p className="text-sm text-gray-400 mt-2">
                  Results will appear here after creating an estimate
                </p>
              </CardContent>
            </Card>
          )}

          {success && createdEstimateId && (
            <div className="sticky top-6 space-y-4">
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <div className="flex-1">
                      <CardTitle className="text-green-900 text-lg">Success!</CardTitle>
                      <CardDescription className="text-green-700">
                        Estimate created in PACE
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Estimate Summary */}
                  <div className="bg-white p-3 rounded-lg border border-green-200">
                    <p className="text-xs font-medium text-gray-600">Estimate Number</p>
                    <p className="text-xl font-bold text-gray-900">
                      {createdEstimateData?.estimate?.number || createdEstimateId}
                    </p>
                    {createdEstimateData?.estimate?.state && (
                      <Badge className="mt-2" variant="secondary">
                        {createdEstimateData.estimate.state}
                      </Badge>
                    )}
                  </div>

                  {/* Parts with Pricing */}
                  {createdEstimateData?.parts && createdEstimateData.parts.length > 0 && (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      <h3 className="text-sm font-semibold text-gray-900">Parts & Pricing</h3>
                      {createdEstimateData.parts.map((part: any, index: number) => (
                        <Card key={index} className="bg-white">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">
                              Part {index + 1}: {part.description}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              ID: {part.partId}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {/* Paper Information */}
                            {part.paperInfo && (
                              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                <h4 className="font-medium text-blue-900 mb-2 text-xs">Paper Specs</h4>
                                <div className="space-y-1 text-xs">
                                  {part.paperInfo.paperType && (
                                    <div className="text-blue-900">
                                      <span className="font-medium">{part.paperInfo.paperType}</span>
                                      {part.paperInfo.weight && <span className="ml-1">- {part.paperInfo.weight}</span>}
                                    </div>
                                  )}
                                  {part.paperInfo.standardPaperType && (
                                    <div className="text-blue-800">
                                      {part.paperInfo.standardPaperType}
                                    </div>
                                  )}
                                  {part.paperInfo.runSize && (
                                    <div>
                                      <span className="text-blue-700 font-medium">Size:</span>
                                      <span className="ml-1 text-blue-900">{part.paperInfo.runSize}</span>
                                    </div>
                                  )}
                                  {part.paperInfo.buySizeGrain && (
                                    <div>
                                      <span className="text-blue-700 font-medium">Grain:</span>
                                      <span className="ml-1 text-blue-900">{part.paperInfo.buySizeGrain}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Pricing Information */}
                            {part.quantities && part.quantities.length > 0 && (
                              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                <h4 className="font-medium text-green-900 mb-2 text-xs">Pricing</h4>
                                {part.quantities.map((qty: any, qtyIndex: number) => {
                                  const markupKey = `${part.partId}-${qtyIndex}`
                                  const currentMarkup = markups[markupKey] || 0
                                  const basePrice = qty.price || 0
                                  const finalPrice = basePrice * (1 + currentMarkup / 100)

                                  const unitPrice = qty.quantityOrdered ? (finalPrice / qty.quantityOrdered) : 0
                                  const unitCost = qty.quantityOrdered ? (basePrice / qty.quantityOrdered) : 0

                                  return (
                                    <div key={qtyIndex} className="mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-b-0 border-green-200">
                                      {/* Qty, Estimate Price, Estimate Unit Cost in single line */}
                                      <div className="flex items-center gap-3 text-xs mb-2 flex-wrap">
                                        <div>
                                          <span className="text-green-700 font-medium">Qty:</span>
                                          <span className="ml-1 text-green-900">{qty.quantityOrdered?.toLocaleString()}</span>
                                        </div>
                                        <div>
                                          <span className="text-green-700 font-medium">Estimate Price:</span>
                                          <span className="ml-1 text-green-900 font-semibold">
                                            ${qty.price?.toFixed(2) || '0.00'}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-green-700 font-medium">Estimate Unit Cost:</span>
                                          <span className="ml-1 text-green-900">
                                            ${unitCost.toFixed(4)}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Markup Calculator */}
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-green-700 font-medium">Markup:</span>
                                          <div className="flex gap-1">
                                            {[10, 25, 50].map((percentage) => (
                                              <button
                                                key={percentage}
                                                type="button"
                                                onClick={() => setMarkups({ ...markups, [markupKey]: percentage })}
                                                className={`px-2 py-1 text-xs rounded ${
                                                  currentMarkup === percentage
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-white text-green-700 border border-green-300 hover:bg-green-100'
                                                }`}
                                              >
                                                {percentage}%
                                              </button>
                                            ))}
                                            <input
                                              key={markupKey}
                                              type="number"
                                              step="any"
                                              defaultValue={currentMarkup || 0}
                                              onBlur={(e) => {
                                                const val = e.target.value
                                                const parsed = parseFloat(val)
                                                setMarkups({ ...markups, [markupKey]: isNaN(parsed) ? 0 : parsed })
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  const val = (e.target as HTMLInputElement).value
                                                  const parsed = parseFloat(val)
                                                  setMarkups({ ...markups, [markupKey]: isNaN(parsed) ? 0 : parsed })
                                                }
                                              }}
                                              className="w-16 px-2 py-1 text-xs border border-green-300 rounded text-center"
                                              placeholder="%"
                                            />
                                          </div>
                                        </div>

                                        {/* Final Price with Markup/Markdown and Unit Price */}
                                        <div className="text-xs bg-white p-2 rounded border border-green-300 space-y-1">
                                          <div>
                                            <span className="text-green-700 font-medium">
                                              Final Price ({currentMarkup}% {currentMarkup < 0 ? 'markdown' : 'markup'}):
                                            </span>
                                            <span className="ml-2 text-green-900 font-bold text-sm">
                                              ${finalPrice.toFixed(2)}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-green-700 font-medium">Unit Price:</span>
                                            <span className="ml-2 text-green-900 font-semibold">
                                              ${unitPrice.toFixed(4)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-2">
                    <Button onClick={handleNewEstimate} className="w-full" size="sm">
                      Create Another Estimate
                    </Button>
                    <Button onClick={() => router.push('/estimates')} variant="outline" className="w-full" size="sm">
                      View All Estimates
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

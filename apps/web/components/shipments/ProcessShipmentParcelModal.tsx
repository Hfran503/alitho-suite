'use client'

import { useState, useEffect } from 'react'

interface ProcessShipmentParcelModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  shipment: any
}

type Step = 1 | 2 | 3 | 4

interface CartonConfig {
  length: string
  width: string
  height: string
  weight: string
  count: number
  contents: Array<{
    itemId?: string
    quantity: number
  }>
}

interface AddressData {
  name: string
  company: string
  street1: string
  street2: string
  city: string
  state: string
  zip: string
  country: string
  phone: string
  email: string
}

interface Rate {
  id: string
  carrier: string
  service: string
  rate: number
  listRate?: number | null
  retailRate?: number | null
  currency: string
  deliveryDays: number | null
  deliveryDate: string | null
}

export function ProcessShipmentParcelModal({
  isOpen,
  onClose,
  onSuccess,
  shipment,
}: ProcessShipmentParcelModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1 data - array of carton configurations
  const [cartons, setCartons] = useState<CartonConfig[]>([
    {
      length: '',
      width: '',
      height: '',
      weight: '',
      count: 1,
      contents: [{ itemId: '', quantity: 0 }],
    },
  ])

  // Job items for content selection
  const [jobItems, setJobItems] = useState<{
    components: Array<{ id: number; description: string; itemNumber?: string; qtyOrdered?: number; po?: string }>
    products: Array<{ id: number; description: string; productID?: string }>
    parts: Array<{ id: string; description: string; partName?: string }>
  } | null>(null)
  const [loadingItems, setLoadingItems] = useState(false)

  // Step 2 data
  const [fromAddress, setFromAddress] = useState<AddressData>({
    name: 'Calitho',
    company: 'Calitho',
    street1: '417 MONTGOMERY ST',
    street2: 'FLOOR 5',
    city: 'SAN FRANCISCO',
    state: 'CA',
    zip: '94104',
    country: 'US',
    phone: '415-123-4567',
    email: 'shipping@calitho.com',
  })

  const [toAddress, setToAddress] = useState<AddressData>({
    name: shipment?.contactFirstName && shipment?.contactLastName
      ? `${shipment.contactFirstName} ${shipment.contactLastName}`
      : shipment?.customerName || '',
    company: shipment?.customerName || '',
    street1: shipment?.address1 || '',
    street2: shipment?.address2 || '',
    city: shipment?.city || '',
    state: shipment?.state || '',
    zip: shipment?.zip || '',
    country: 'US',
    phone: shipment?.phone || '',
    email: shipment?.email || '',
  })

  // Step 3 data - can be multiple shipment IDs for multi-parcel
  const [shipmentIds, setShipmentIds] = useState<string[]>([])
  const [rates, setRates] = useState<Rate[]>([])
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null)

  // Step 4 data - array of label data for each purchased label
  const [labelData, setLabelData] = useState<Array<{
    trackingCode: string
    trackingUrl: string
    labelUrl: string
    labelPdfUrl?: string
    carrier: string
    service: string
    cost: number
    fees?: Array<{
      type: string
      amount: number
      charged: boolean
      refunded: boolean
    }>
  }>>([])
  const [totalCost, setTotalCost] = useState<number>(0)

  // Load default ship-from address from integration settings
  useEffect(() => {
    const loadDefaultFromAddress = async () => {
      try {
        const response = await fetch('/api/integrations/easypost')
        if (response.ok) {
          const data = await response.json()
          if (data.data?.config?.defaultFromAddress) {
            setFromAddress(data.data.config.defaultFromAddress)
          }
        }
      } catch (error) {
        console.error('Failed to load default ship-from address:', error)
        // Keep using the hardcoded default if fetch fails
      }
    }

    if (isOpen) {
      loadDefaultFromAddress()
    }
  }, [isOpen])

  // Load job items for carton contents selection
  useEffect(() => {
    const loadJobItems = async () => {
      if (!shipment?.job) return

      setLoadingItems(true)
      try {
        const response = await fetch(`/api/pace/jobs/${encodeURIComponent(shipment.job)}/items`)
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setJobItems(data.data)
          }
        }
      } catch (err) {
        console.error('Failed to load job items:', err)
      } finally {
        setLoadingItems(false)
      }
    }

    if (isOpen && shipment?.job) {
      loadJobItems()
    }
  }, [isOpen, shipment?.job])

  const handleNext = async () => {
    setError('')

    if (currentStep === 1) {
      // Validate all cartons
      for (let i = 0; i < cartons.length; i++) {
        const carton = cartons[i]

        if (!carton.length || !carton.width || !carton.height || !carton.weight) {
          setError(`Carton ${i + 1}: Please fill in all dimensions and weight`)
          return
        }

        if (carton.count < 1) {
          setError(`Carton ${i + 1}: Count must be at least 1`)
          return
        }

        // Validate that all contents have both itemId and quantity
        const hasInvalidContents = carton.contents.some(
          (c) => !c.itemId || !c.quantity || c.quantity <= 0
        )
        if (hasInvalidContents) {
          setError(`Carton ${i + 1}: Please select items and enter valid quantities for all contents`)
          return
        }
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      // Validate addresses and get rates
      if (!toAddress.street1 || !toAddress.city || !toAddress.state || !toAddress.zip) {
        setError('Please fill in all required address fields')
        return
      }

      setIsLoading(true)
      try {
        // Build parcels array - expand each carton by its count
        const parcels = []
        for (const carton of cartons) {
          // Create 'count' number of identical parcels
          for (let i = 0; i < carton.count; i++) {
            parcels.push({
              length: parseFloat(carton.length),
              width: parseFloat(carton.width),
              height: parseFloat(carton.height),
              weight: parseFloat(carton.weight),
            })
          }
        }

        // Create a single multi-piece shipment with all parcels
        const response = await fetch('/api/easypost/shipments/create-and-rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromAddress,
            toAddress,
            parcels, // Send all parcels at once for multi-piece shipment
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to get shipping rates')
        }

        const data = await response.json()
        setShipmentIds(data.data.shipmentIds || [data.data.shipmentId])
        setRates(data.data.rates)
        setCurrentStep(3)
      } catch (err: any) {
        setError(err.message || 'Failed to get shipping rates')
      } finally {
        setIsLoading(false)
      }
    } else if (currentStep === 3) {
      // Purchase label for the multi-piece shipment
      if (!selectedRate) {
        setError('Please select a shipping rate')
        return
      }

      setIsLoading(true)
      try {
        const purchasedLabels = []
        let total = 0

        // For multi-shipment scenarios, we need to find the matching rate for each shipment
        // The selectedRate contains shipmentIds and rateIds arrays if it's aggregated
        const isAggregated = (selectedRate as any).shipmentIds && (selectedRate as any).rateIds

        if (isAggregated) {
          // Purchase label for each shipment with its matching rate
          const aggregatedRate = selectedRate as any

          for (let i = 0; i < aggregatedRate.shipmentIds.length; i++) {
            const buyResponse = await fetch('/api/easypost/shipments/buy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                shipmentId: aggregatedRate.shipmentIds[i],
                rateId: aggregatedRate.rateIds[i],
              }),
            })

            if (!buyResponse.ok) {
              const errorData = await buyResponse.json()
              throw new Error(errorData.message || 'Failed to purchase label')
            }

            const buyData = await buyResponse.json()

            purchasedLabels.push({
              trackingCode: buyData.data.trackingCode,
              trackingUrl: buyData.data.trackingUrl,
              labelUrl: buyData.data.labelUrl,
              labelPdfUrl: buyData.data.labelPdfUrl,
              carrier: selectedRate.carrier,
              service: selectedRate.service,
              cost: parseFloat(buyData.data.selectedRate?.rate || '0'),
              easypostShipmentId: aggregatedRate.shipmentIds[i], // Store for cancellation
              fees: buyData.data.fees || [],
            })

            total += parseFloat(buyData.data.selectedRate?.rate || '0')
          }
        } else {
          // Single shipment
          const buyResponse = await fetch('/api/easypost/shipments/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shipmentId: shipmentIds[0],
              rateId: selectedRate.id,
            }),
          })

          if (!buyResponse.ok) {
            const errorData = await buyResponse.json()
            throw new Error(errorData.message || 'Failed to purchase label')
          }

          const buyData = await buyResponse.json()

          purchasedLabels.push({
            trackingCode: buyData.data.trackingCode,
            trackingUrl: buyData.data.trackingUrl,
            labelUrl: buyData.data.labelUrl,
            labelPdfUrl: buyData.data.labelPdfUrl,
            carrier: selectedRate.carrier,
            service: selectedRate.service,
            cost: selectedRate.rate,
            easypostShipmentId: shipmentIds[0], // Store for cancellation
            fees: buyData.data.fees || [],
          })

          total = selectedRate.rate
        }

        setLabelData(purchasedLabels)
        setTotalCost(total)

        // Create all cartons in PACE with their respective tracking info
        let labelIndex = 0
        for (let i = 0; i < cartons.length; i++) {
          const carton = cartons[i]

          // Map contents to PACE format
          const mappedContents = carton.contents.map((content) => {
            const baseContent: any = {
              quantity: content.quantity,
            }

            // Parse itemId format: "type:value"
            if (content.itemId) {
              const parts = content.itemId.split(':')
              const type = parts[0]

              if (type === 'job') {
                baseContent.job = parseInt(parts[1])
              } else if (type === 'component') {
                baseContent.jobComponent = parseInt(parts[1])
              } else if (type === 'product') {
                baseContent.jobProduct = parseInt(parts[1])
              } else if (type === 'part') {
                // Format: "part:jobId:partNum"
                // JobPart requires jobPartJob as integer and jobPart as string (part number)
                baseContent.jobPartJob = parseInt(parts[1])
                baseContent.jobPart = parts[2]
              } else if (type === 'material') {
                baseContent.jobMaterial = parseInt(parts[1])
              }
            }

            return baseContent
          })

          // Create carton(s) for this configuration
          // Each carton config may have a count > 1, and each gets a label
          for (let j = 0; j < carton.count; j++) {
            const label = purchasedLabels[labelIndex]

            const cartonResponse = await fetch(
              `/api/pace/shipments/${shipment.id}/create-parcel-carton`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  count: 1, // Each API call creates 1 carton with this label
                  weight: parseFloat(carton.weight),
                  trackingNumber: label.trackingCode,
                  trackingLink: label.trackingUrl,
                  carrier: label.carrier,
                  service: label.service,
                  shippingCost: label.cost,
                  easypostShipmentId: label.easypostShipmentId, // Store for cancellation
                  labelUrl: label.labelUrl,
                  provider: 'easypost',
                  shipFrom: fromAddress,
                  shipTo: toAddress,
                  length: parseFloat(carton.length),
                  width: parseFloat(carton.width),
                  height: parseFloat(carton.height),
                  contents: mappedContents,
                }),
              }
            )

            if (!cartonResponse.ok) {
              console.error('Failed to create carton in PACE, but label was purchased')
            }

            labelIndex++
          }
        }

        // Update shipment with aggregated tracking and total cost
        try {
          const updateTrackingResponse = await fetch(
            `/api/pace/shipments/${shipment.id}/update-tracking`,
            {
              method: 'POST',
            }
          )

          if (!updateTrackingResponse.ok) {
            console.error('Failed to update shipment tracking aggregation')
          } else {
            const trackingData = await updateTrackingResponse.json()
            console.log('Updated shipment with aggregated tracking:', trackingData)
          }
        } catch (error) {
          console.error('Error updating shipment tracking:', error)
          // Don't fail the whole process if this fails
        }

        setCurrentStep(4)
      } catch (err: any) {
        setError(err.message || 'Failed to purchase labels')
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleBack = () => {
    setError('')
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step)
    }
  }

  const handleComplete = () => {
    onSuccess()
    handleClose()
  }

  const handleClose = () => {
    setCurrentStep(1)
    setError('')
    setCartons([
      {
        length: '',
        width: '',
        height: '',
        weight: '',
        count: 1,
        contents: [{ itemId: '', quantity: 0 }],
      },
    ])
    setShipmentIds([])
    setRates([])
    setSelectedRate(null)
    setLabelData([])
    setTotalCost(0)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Process Shipment for Parcel</h3>
            <p className="text-sm text-gray-500 mt-0.5">Shipment #{shipment?.id}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Progress Steps */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base shadow-sm transition-all ${
                          step < currentStep
                            ? 'bg-green-500 text-white ring-4 ring-green-100'
                            : step === currentStep
                            ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                            : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                        }`}
                      >
                        {step < currentStep ? (
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          step
                        )}
                      </div>
                      <div className={`mt-3 text-sm text-center font-medium ${
                        step === currentStep ? 'text-blue-600' : step < currentStep ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {step === 1 && 'Parcel Details'}
                        {step === 2 && 'Addresses'}
                        {step === 3 && 'Select Rate'}
                        {step === 4 && 'Label'}
                      </div>
                    </div>
                    {step < 4 && (
                      <div
                        className={`h-1.5 flex-1 mx-4 rounded-full transition-all ${
                          step < currentStep ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg shadow-sm">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-800 font-medium">{error}</p>
                </div>
              </div>
            )}

            {/* Step Content */}
            <div className="min-h-[400px]">
              {currentStep === 1 && (
                <Step1ParcelDetails
                  cartons={cartons}
                  setCartons={setCartons}
                  shipment={shipment}
                  jobItems={jobItems}
                  loadingItems={loadingItems}
                />
              )}
              {currentStep === 2 && (
                <Step2Addresses
                  fromAddress={fromAddress}
                  toAddress={toAddress}
                  setFromAddress={setFromAddress}
                  setToAddress={setToAddress}
                />
              )}
              {currentStep === 3 && (
                <Step3SelectRate
                  rates={rates}
                  selectedRate={selectedRate}
                  setSelectedRate={setSelectedRate}
                  isLoading={isLoading}
                />
              )}
              {currentStep === 4 && <Step4Label labelData={labelData} totalCost={totalCost} />}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={currentStep === 1 ? handleClose : handleBack}
            disabled={isLoading}
            className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium transition-colors shadow-sm"
          >
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>

          <button
            type="button"
            onClick={currentStep === 4 ? handleComplete : handleNext}
            disabled={isLoading}
            className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : currentStep === 4 ? 'Complete' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Step 1: Parcel Details
function Step1ParcelDetails({
  cartons,
  setCartons,
  shipment,
  jobItems,
  loadingItems,
}: {
  cartons: CartonConfig[]
  setCartons: (cartons: CartonConfig[]) => void
  shipment: any
  jobItems: {
    components: Array<{ id: number; description: string; itemNumber?: string; qtyOrdered?: number; po?: string }>
    products: Array<{ id: number; description: string; productID?: string }>
    parts: Array<{ id: string; description: string; partName?: string }>
  } | null
  loadingItems: boolean
}) {
  const addCarton = () => {
    setCartons([
      ...cartons,
      {
        length: '',
        width: '',
        height: '',
        weight: '',
        count: 1,
        contents: [{ itemId: '', quantity: 0 }],
      },
    ])
  }

  const removeCarton = (cartonIndex: number) => {
    setCartons(cartons.filter((_, i) => i !== cartonIndex))
  }

  const addContent = (cartonIndex: number) => {
    const newCartons = [...cartons]
    newCartons[cartonIndex].contents.push({ itemId: '', quantity: 0 })
    setCartons(newCartons)
  }

  const removeContent = (cartonIndex: number, contentIndex: number) => {
    const newCartons = [...cartons]
    newCartons[cartonIndex].contents = newCartons[cartonIndex].contents.filter(
      (_, i) => i !== contentIndex
    )
    setCartons(newCartons)
  }

  const updateCarton = (cartonIndex: number, field: keyof CartonConfig, value: any) => {
    const newCartons = [...cartons]
    ;(newCartons[cartonIndex] as any)[field] = value
    setCartons(newCartons)
  }

  const updateContent = (
    cartonIndex: number,
    contentIndex: number,
    field: 'itemId' | 'quantity',
    value: any
  ) => {
    const newCartons = [...cartons]
    const content = newCartons[cartonIndex].contents[contentIndex]

    if (field === 'itemId') {
      content.itemId = value
    } else if (field === 'quantity') {
      content.quantity = value
    }

    setCartons(newCartons)
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Parcel Details</h3>
            <p className="text-sm text-gray-700">
              Configure each carton with its contents, dimensions, weight, and quantity of identical cartons.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {cartons.map((carton, cartonIndex) => (
          <div key={cartonIndex} className="border-2 border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
            {/* Carton Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b-2 border-gray-200">
              <h4 className="text-base font-bold text-gray-900">Carton {cartonIndex + 1}</h4>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => addContent(cartonIndex)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Item
                </button>
                {cartons.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCarton(cartonIndex)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Contents Table */}
            <div className="divide-y divide-gray-100">
              {carton.contents.map((content, contentIndex) => (
                <div
                  key={contentIndex}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50"
                >
                  {/* Item Selector */}
                  <div className="flex-1">
                    {loadingItems ? (
                      <div className="px-3 py-2 text-sm text-gray-500">Loading items...</div>
                    ) : (
                      <select
                        value={content.itemId || ''}
                        onChange={(e) =>
                          updateContent(cartonIndex, contentIndex, 'itemId', e.target.value)
                        }
                        required
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                      >
                        <option value="">Select item to ship...</option>

                        {/* Job Option */}
                        {shipment?.job && (
                          <option value={`job:${shipment.job}`}>🔹 Job #{shipment.job}</option>
                        )}

                        {/* Components */}
                        {jobItems?.components && jobItems.components.length > 0 && (
                          <optgroup label="━━━ Components ━━━">
                            {jobItems.components.map((comp) => (
                              <option key={`component:${comp.id}`} value={`component:${comp.id}`}>
                                {comp.itemNumber || comp.description}
                                {comp.itemNumber && comp.description ? ` - ${comp.description}` : ''}
                                {comp.po ? ` | PO: ${comp.po}` : ''}
                                {comp.qtyOrdered ? ` | Qty: ${comp.qtyOrdered}` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}

                        {/* Products */}
                        {jobItems?.products && jobItems.products.length > 0 && (
                          <optgroup label="━━━ Products ━━━">
                            {jobItems.products.map((prod) => (
                              <option key={`product:${prod.id}`} value={`product:${prod.id}`}>
                                {prod.description} {prod.productID ? `(${prod.productID})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}

                        {/* Parts */}
                        {jobItems?.parts && jobItems.parts.length > 0 && (
                          <optgroup label="━━━ Parts ━━━">
                            {jobItems.parts.map((part) => (
                              <option key={part.id} value={part.id}>
                                {part.partName || part.description}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    )}
                  </div>

                  {/* Quantity Input */}
                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      required
                      value={content.quantity}
                      onChange={(e) =>
                        updateContent(
                          cartonIndex,
                          contentIndex,
                          'quantity',
                          parseInt(e.target.value) || 0
                        )
                      }
                      placeholder="Qty"
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                    />
                  </div>

                  {/* Delete Button */}
                  {carton.contents.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContent(cartonIndex, contentIndex)}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Remove item"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Dimensions and Weight */}
            <div className="px-5 py-4 border-t-2 border-gray-200 bg-gradient-to-b from-gray-50 to-white">
              <h5 className="text-sm font-semibold text-gray-900 mb-3">Package Specifications</h5>
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Length (in) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={carton.length}
                    onChange={(e) => updateCarton(cartonIndex, 'length', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                    placeholder="12"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Width (in) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={carton.width}
                    onChange={(e) => updateCarton(cartonIndex, 'width', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                    placeholder="8"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Height (in) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={carton.height}
                    onChange={(e) => updateCarton(cartonIndex, 'height', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                    placeholder="6"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Weight (lb) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={carton.weight}
                    onChange={(e) => updateCarton(cartonIndex, 'weight', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                    placeholder="1.0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Qty <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={carton.count}
                    onChange={(e) =>
                      updateCarton(cartonIndex, 'count', parseInt(e.target.value) || 1)
                    }
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                    placeholder="1"
                    required
                  />
                  <p className="mt-1.5 text-xs text-gray-600 font-medium">Identical cartons</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addCarton}
          className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Another Carton
        </button>
      </div>
    </div>
  )
}

// Step 2: Addresses
function Step2Addresses({
  fromAddress,
  toAddress,
  setFromAddress,
  setToAddress,
}: {
  fromAddress: AddressData
  toAddress: AddressData
  setFromAddress: (data: AddressData) => void
  setToAddress: (data: AddressData) => void
}) {
  const [isFromAddressExpanded, setIsFromAddressExpanded] = useState(false)

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Verify Shipping Addresses</h3>
            <p className="text-sm text-gray-700">Confirm the origin and destination addresses for your shipment.</p>
          </div>
        </div>
      </div>

      {/* From Address - Collapsible */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setIsFromAddressExpanded(!isFromAddressExpanded)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <h4 className="font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            From Address (Origin)
          </h4>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 font-medium">
              {fromAddress.company || fromAddress.name || 'Default Address'}
            </span>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${isFromAddressExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isFromAddressExpanded && (
          <div className="px-5 pb-5 border-t-2 border-gray-200 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Company</label>
                <input
                  type="text"
                  value={fromAddress.company}
                  onChange={(e) => setFromAddress({ ...fromAddress, company: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                <input
                  type="text"
                  value={fromAddress.phone}
                  onChange={(e) => setFromAddress({ ...fromAddress, phone: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Street 1</label>
                <input
                  type="text"
                  value={fromAddress.street1}
                  onChange={(e) => setFromAddress({ ...fromAddress, street1: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Street 2</label>
                <input
                  type="text"
                  value={fromAddress.street2}
                  onChange={(e) => setFromAddress({ ...fromAddress, street2: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  value={fromAddress.city}
                  onChange={(e) => setFromAddress({ ...fromAddress, city: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    value={fromAddress.state}
                    onChange={(e) => setFromAddress({ ...fromAddress, state: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">ZIP</label>
                  <input
                    type="text"
                    value={fromAddress.zip}
                    onChange={(e) => setFromAddress({ ...fromAddress, zip: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* To Address */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 p-5 rounded-xl shadow-sm">
        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          To Address (Destination)
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
            <input
              type="text"
              value={toAddress.name}
              onChange={(e) => setToAddress({ ...toAddress, name: e.target.value })}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Company</label>
            <input
              type="text"
              value={toAddress.company}
              onChange={(e) => setToAddress({ ...toAddress, company: e.target.value })}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Street 1 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={toAddress.street1}
              onChange={(e) => setToAddress({ ...toAddress, street1: e.target.value })}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
              required
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Street 2</label>
            <input
              type="text"
              value={toAddress.street2}
              onChange={(e) => setToAddress({ ...toAddress, street2: e.target.value })}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={toAddress.city}
              onChange={(e) => setToAddress({ ...toAddress, city: e.target.value })}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={toAddress.state}
                onChange={(e) => setToAddress({ ...toAddress, state: e.target.value })}
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ZIP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={toAddress.zip}
                onChange={(e) => setToAddress({ ...toAddress, zip: e.target.value })}
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
            <input
              type="text"
              value={toAddress.phone}
              onChange={(e) => setToAddress({ ...toAddress, phone: e.target.value })}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={toAddress.email}
              onChange={(e) => setToAddress({ ...toAddress, email: e.target.value })}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Step 3: Select Rate
function Step3SelectRate({
  rates,
  selectedRate,
  setSelectedRate,
  isLoading,
}: {
  rates: Rate[]
  selectedRate: Rate | null
  setSelectedRate: (rate: Rate) => void
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Getting rates from carriers...</p>
        </div>
      </div>
    )
  }

  if (rates.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No rates available. Please go back and check your addresses.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Shipping Rate</h3>
        <p className="text-sm text-gray-600 mb-2">
          Choose from available carrier rates. Sorted by price (lowest first).
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-amber-800">
              <span className="font-medium">Note:</span> Final cost may include additional surcharges (residential delivery, fuel, insurance, etc.) that will be shown after label purchase.
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {rates.map((rate) => {
          const hasListPrice = rate.listRate && rate.listRate > rate.rate
          const potentialSavings = hasListPrice && rate.listRate ? rate.listRate - rate.rate : 0

          return (
            <div
              key={rate.id}
              onClick={() => setSelectedRate(rate)}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                selectedRate?.id === rate.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedRate?.id === rate.id
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedRate?.id === rate.id && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{rate.carrier}</div>
                      <div className="text-sm text-gray-600">{rate.service}</div>
                    </div>
                  </div>
                  {rate.deliveryDays && (
                    <div className="mt-2 text-sm text-gray-500 ml-8">
                      Estimated delivery: {rate.deliveryDays} {rate.deliveryDays === 1 ? 'day' : 'days'}
                      {rate.deliveryDate && ` (${new Date(rate.deliveryDate).toLocaleDateString()})`}
                    </div>
                  )}
                  {hasListPrice && (
                    <div className="mt-1 text-xs text-green-600 ml-8 font-medium">
                      Save ${potentialSavings.toFixed(2)} vs. retail (${rate.listRate?.toFixed(2)})
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    ${rate.rate.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">{rate.currency}</div>
                  {hasListPrice && (
                    <div className="text-xs text-gray-400 line-through mt-1">
                      ${rate.listRate?.toFixed(2)}
                    </div>
                  )}
                  <div className="text-xs text-amber-600 mt-1">+ fees may apply</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Step 4: Label
function Step4Label({
  labelData,
  totalCost: _totalCost,
}: {
  labelData: Array<{
    trackingCode: string
    trackingUrl: string
    labelUrl: string
    labelPdfUrl?: string
    carrier: string
    service: string
    cost: number
    fees?: Array<{
      type: string
      amount: number
      charged: boolean
      refunded: boolean
    }>
  }>
  totalCost: number
}) {
  if (!labelData || labelData.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Creating labels...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {labelData.length} Label{labelData.length > 1 ? 's' : ''} Created Successfully!
        </h3>
        <p className="text-gray-600">
          Your shipping labels have been created and all cartons have been recorded in PACE.
        </p>
      </div>

      {/* Total Cost Summary */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <div className="mb-2">
          <div className="text-sm font-medium text-blue-900">Total Shipping Cost</div>
          <div className="text-xs text-blue-700">
            {labelData[0]?.carrier} - {labelData[0]?.service}
          </div>
        </div>

        {(() => {
          const totalBaseCost = labelData.reduce((sum, label) => sum + label.cost, 0)
          const totalFees = labelData.reduce((sum, label) => {
            if (!label.fees) return sum
            return sum + label.fees
              .filter(f => f.charged && !f.refunded)
              .reduce((feeSum, f) => feeSum + f.amount, 0)
          }, 0)
          const grandTotal = totalBaseCost + totalFees

          return (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-blue-700">Base Shipping:</span>
                <span className="text-blue-900">${totalBaseCost.toFixed(2)}</span>
              </div>
              {totalFees > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-700">Additional Fees:</span>
                    <span className="text-amber-800">+${totalFees.toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-blue-300 flex justify-between">
                    <span className="font-bold text-blue-900">Grand Total:</span>
                    <span className="text-2xl font-bold text-blue-900">${grandTotal.toFixed(2)}</span>
                  </div>
                </>
              )}
              {totalFees === 0 && (
                <div className="pt-2 border-t border-blue-300 flex justify-between">
                  <span className="font-bold text-blue-900">Total:</span>
                  <span className="text-2xl font-bold text-blue-900">${totalBaseCost.toFixed(2)}</span>
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Individual Labels */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-900">Labels & Tracking</h4>
        {labelData.map((label, index) => (
          <div key={index} className="border border-gray-200 rounded-lg bg-white">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h5 className="text-sm font-semibold text-gray-900">
                Label {index + 1} of {labelData.length}
              </h5>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="text-xs font-medium text-gray-500">Tracking Number</div>
                <div className="text-sm font-mono text-gray-900">{label.trackingCode}</div>
              </div>

              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Cost Breakdown</div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Base Rate:</span>
                    <span className="text-gray-900 font-medium">${label.cost.toFixed(2)}</span>
                  </div>
                  {label.fees && label.fees.length > 0 && (
                    <>
                      {label.fees
                        .filter(fee => fee.charged && !fee.refunded)
                        .map((fee, feeIndex) => (
                          <div key={feeIndex} className="flex justify-between text-xs">
                            <span className="text-amber-600">
                              {fee.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                            </span>
                            <span className="text-amber-700">+${fee.amount.toFixed(2)}</span>
                          </div>
                        ))
                      }
                      <div className="pt-1 border-t border-gray-200 flex justify-between text-sm font-semibold">
                        <span className="text-gray-700">Total Paid:</span>
                        <span className="text-gray-900">
                          ${(label.cost + (label.fees.filter(f => f.charged && !f.refunded).reduce((sum, f) => sum + f.amount, 0))).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {label.labelUrl && (
                  <a
                    href={label.labelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-blue-600 text-white text-center text-xs rounded hover:bg-blue-700 font-medium"
                  >
                    Download PNG
                  </a>
                )}

                {label.labelPdfUrl && (
                  <a
                    href={label.labelPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-gray-700 text-white text-center text-xs rounded hover:bg-gray-800 font-medium"
                  >
                    Download PDF
                  </a>
                )}
              </div>

              {label.trackingUrl && (
                <a
                  href={label.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full px-3 py-2 border border-gray-300 text-gray-700 text-center text-xs rounded hover:bg-gray-50 font-medium"
                >
                  Track Shipment
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

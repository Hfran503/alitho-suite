'use client'

import { useState, useEffect } from 'react'

interface ProcessShipmentShipStationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  shipment: any
  companyName?: string | null
}

type Step = 1 | 2 | 3 | 4 | 5

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

interface RateDetail {
  type: string
  description: string
  amount: number
  currency: string
  billingCode?: string | null
  memo?: string | null
  billingSource?: string
}

interface Rate {
  rateId: string
  carrierId: string
  carrierCode: string
  serviceCode: string
  carrier: string
  service: string
  amount: number
  shippingAmount?: number
  insuranceAmount?: number
  confirmationAmount?: number
  otherAmount?: number
  currency: string
  deliveryDays: number | null
  estimatedDeliveryDate: string | null
  rateDetails?: RateDetail[]
  rateAttributes?: string[] // best_value, cheapest, fastest
  warningMessages?: string[]
}

export function ProcessShipmentShipStationModal({
  isOpen,
  onClose,
  onSuccess,
  shipment,
  companyName,
}: ProcessShipmentShipStationModalProps) {
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
    components: Array<{ id: number; description: string; itemNumber?: string; qtyOrdered?: number }>
    products: Array<{ id: number; description: string; productID?: string }>
    parts: Array<{ id: string; description: string; partName?: string }>
  } | null>(null)
  const [loadingItems, setLoadingItems] = useState(false)

  // Step 2 data - Address validation
  const [validationResult, setValidationResult] = useState<any>(null)
  const [hasValidated, setHasValidated] = useState(false)

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
    name:
      shipment?.contactFirstName && shipment?.contactLastName
        ? `${shipment.contactFirstName} ${shipment.contactLastName}`
        : shipment?.customerName || '',
    company: companyName || shipment?.customerName || '',
    street1: shipment?.address1 || '',
    street2: shipment?.address2 || '',
    city: shipment?.city || '',
    state: shipment?.state || '',
    zip: shipment?.zip || '',
    country: 'US',
    phone: shipment?.phone || '',
    email: shipment?.email || '',
  })

  // Step 3 data
  const [rates, setRates] = useState<Rate[]>([])
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null)

  // Step 4 data - Ship Date and Return Label Options
  const [shipDate, setShipDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [isReturnLabel, setIsReturnLabel] = useState(false)
  const [rmaNumber, setRmaNumber] = useState('')
  const [labelMessages, setLabelMessages] = useState({
    reference1: '',
    reference2: '',
    reference3: '',
  })

  // Set default reference 1 when modal opens: Job# - CL{ShipmentID}
  useEffect(() => {
    if (isOpen && shipment?.job && shipment?.id) {
      setLabelMessages(prev => ({
        ...prev,
        reference1: `${shipment.job} - CL${shipment.id}`
      }))
    }
  }, [isOpen, shipment?.job, shipment?.id])

  // Step 5 data - ShipStation creates outbound label and optionally return label
  const [labelData, setLabelData] = useState<{
    outbound: {
      trackingNumber: string
      labelUrl: string
      shipmentId: string
      totalCost: number
      currency: string
      costBreakdown?: {
        shipmentCost: number
        insuranceCost: number
        confirmationCost: number
        otherCost: number
      }
    }
    return?: {
      trackingNumber: string
      labelUrl: string
      shipmentId: string
      labelId: string
      totalCost: number
      currency: string
      rmaNumber?: string
    }
  } | null>(null)

  // Load default ship-from address from integration settings
  useEffect(() => {
    const loadDefaultFromAddress = async () => {
      try {
        const response = await fetch('/api/integrations/shipstation')
        if (response.ok) {
          const data = await response.json()
          if (data.data?.config?.defaultFromAddress) {
            setFromAddress(data.data.config.defaultFromAddress)
          }
        }
      } catch (error) {
        console.error('Failed to load default ship-from address:', error)
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

      // Check if address validation has been completed
      if (!hasValidated || !validationResult) {
        setError('Please wait for address validation to complete before continuing')
        return
      }

      // Check if there are validation errors
      if (validationResult.status === 'error' || validationResult.status === 'unverified') {
        setError('Address validation failed. Please correct the address or use the "Undo Corrections" button if the suggested address is incorrect.')
        return
      }

      setIsLoading(true)
      try {
        // Build packages array - expand each carton by its count
        const packages = []
        for (const carton of cartons) {
          for (let i = 0; i < carton.count; i++) {
            packages.push({
              length: parseFloat(carton.length),
              width: parseFloat(carton.width),
              height: parseFloat(carton.height),
              weight: parseFloat(carton.weight),
              weightUnit: 'pound',
              dimensionUnit: 'inch',
            })
          }
        }

        // Get rates from ShipStation
        const response = await fetch('/api/shipstation/rates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shipFrom: fromAddress,
            shipTo: toAddress,
            packages,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to get shipping rates')
        }

        const data = await response.json()
        setRates(data.data.rates)
        setCurrentStep(3)
      } catch (err: any) {
        setError(err.message || 'Failed to get shipping rates')
      } finally {
        setIsLoading(false)
      }
    } else if (currentStep === 3) {
      // Validate rate selection and proceed to ship date/options step
      if (!selectedRate) {
        setError('Please select a shipping rate')
        return
      }
      setCurrentStep(4)
    } else if (currentStep === 4) {
      // Validate ship date and create labels
      if (!shipDate) {
        setError('Please select a ship date')
        return
      }

      if (!selectedRate) {
        setError('Please select a shipping rate')
        return
      }

      // Return labels don't require outbound label ID (it's optional for linking)

      setIsLoading(true)
      try {
        // Build packages array with contents references and label messages
        const packages = []
        for (const carton of cartons) {
          for (let i = 0; i < carton.count; i++) {
            const pkg: any = {
              length: parseFloat(carton.length),
              width: parseFloat(carton.width),
              height: parseFloat(carton.height),
              weight: parseFloat(carton.weight),
              weightUnit: 'pound',
              dimensionUnit: 'inch',
            }

            // Add label messages if any are provided
            const hasMessages = labelMessages.reference1 || labelMessages.reference2 || labelMessages.reference3
            if (hasMessages) {
              pkg.label_messages = {
                reference1: labelMessages.reference1 || null,
                reference2: labelMessages.reference2 || null,
                reference3: labelMessages.reference3 || null,
              }
            }

            packages.push(pkg)
          }
        }

        // Create outbound label with ShipStation
        const createResponse = await fetch('/api/shipstation/labels/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shipmentId: shipment.id,
            carrierId: selectedRate.carrierId,
            serviceCode: selectedRate.serviceCode,
            shipFrom: fromAddress,
            shipTo: toAddress,
            packages,
            shipDate: shipDate ? new Date(shipDate).toISOString() : undefined,
            isReturnLabel: false, // Always create outbound first
          }),
        })

        if (!createResponse.ok) {
          const errorData = await createResponse.json()
          throw new Error(errorData.error || 'Failed to create shipping labels')
        }

        const createData = await createResponse.json()

        // Validate we have packages data
        const packagesData = createData.data.packages || []
        console.log('Received outbound packages from ShipStation:', {
          packageCount: packagesData.length,
          packages: packagesData,
        })

        // Prepare label data object
        const newLabelData: any = {
          outbound: {
            trackingNumber: createData.data.trackingNumber,
            labelUrl: createData.data.labelUrl,
            shipmentId: createData.data.shipmentId,
            labelId: createData.data.labelId,
            totalCost: createData.data.totalCost,
            currency: createData.data.currency,
            costBreakdown: createData.data.costBreakdown,
          }
        }

        // If return label requested, create it using the outbound label ID
        if (isReturnLabel) {
          try {
            const returnResponse = await fetch('/api/shipstation/labels/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                shipmentId: shipment.id,
                carrierId: selectedRate.carrierId,
                serviceCode: selectedRate.serviceCode,
                shipFrom: toAddress, // Reversed - customer ships back
                shipTo: fromAddress, // Reversed - to warehouse
                packages,
                shipDate: shipDate ? new Date(shipDate).toISOString() : undefined,
                isReturnLabel: true,
                rmaNumber: rmaNumber || undefined,
                chargeEvent: 'carrier_default',
                outboundLabelId: createData.data.labelId, // Link to outbound label
              }),
            })

            if (returnResponse.ok) {
              const returnData = await returnResponse.json()
              newLabelData.return = {
                trackingNumber: returnData.data.trackingNumber,
                labelUrl: returnData.data.labelUrl,
                shipmentId: returnData.data.shipmentId,
                labelId: returnData.data.labelId,
                totalCost: returnData.data.totalCost,
                currency: returnData.data.currency,
                rmaNumber: rmaNumber,
              }
              console.log('Return label created successfully:', returnData.data)
            } else {
              const errorData = await returnResponse.json()
              console.error('Failed to create return label:', errorData)
              // Don't fail the whole process, just log the error
              setError(`Outbound label created, but return label failed: ${errorData.error}`)
            }
          } catch (err: any) {
            console.error('Error creating return label:', err)
            setError(`Outbound label created, but return label failed: ${err.message}`)
          }
        }

        setLabelData(newLabelData)

        // Save return label to database if created
        if (newLabelData.return) {
          try {
            const saveReturnLabelResponse = await fetch('/api/labels', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                paceShipmentId: shipment.id,
                provider: 'shipstation',
                providerShipmentId: newLabelData.return.shipmentId,
                providerLabelId: newLabelData.return.labelId,
                trackingNumber: newLabelData.return.trackingNumber,
                labelUrl: newLabelData.return.labelUrl,
                carrier: selectedRate.carrier,
                service: selectedRate.service,
                shipFrom: toAddress, // Reversed for return
                shipTo: fromAddress, // Reversed for return
                cost: newLabelData.return.totalCost,
                currency: newLabelData.return.currency,
                isReturnLabel: true,
                outboundLabelId: newLabelData.outbound.labelId,
                rmaNumber: newLabelData.return.rmaNumber,
              }),
            })

            if (!saveReturnLabelResponse.ok) {
              console.error('Failed to save return label to database')
            } else {
              console.log('Return label saved to database successfully')
            }
          } catch (err) {
            console.error('Error saving return label:', err)
          }
        }

        // Create all cartons in PACE with their respective tracking info
        let packageIndex = 0
        for (let i = 0; i < cartons.length; i++) {
          const carton = cartons[i]

          // Map contents to PACE format
          const mappedContents = carton.contents.map((content) => {
            const baseContent: any = {
              quantity: content.quantity,
            }

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
                // JobPart requires jobPartJob as integer and jobPart as string (part number)
                baseContent.jobPartJob = parseInt(parts[1])
                baseContent.jobPart = parts[2]
              }
            }

            return baseContent
          })

          // Create carton(s) for this configuration
          for (let j = 0; j < carton.count; j++) {
            // Get the specific package data for this carton
            const packageData = packagesData[packageIndex] || {}
            const trackingNumber = packageData.trackingNumber || createData.data.trackingNumber
            const labelUrl = packageData.labelDownload?.href || createData.data.labelUrl
            const labelId = packageData.labelId || createData.data.labelId

            console.log(`Creating carton ${packageIndex + 1} with tracking:`, {
              cartonIndex: i,
              copyIndex: j,
              packageIndex,
              trackingNumber,
              labelId,
              packageData,
            })

            const cartonResponse = await fetch(
              `/api/pace/shipments/${shipment.id}/create-parcel-carton`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  count: 1,
                  weight: parseFloat(carton.weight),
                  trackingNumber: trackingNumber,
                  trackingLink: `https://www.shipengine.com/tracking/${trackingNumber}`,
                  carrier: selectedRate.carrier,
                  service: selectedRate.service,
                  shippingCost: createData.data.totalCost / packagesData.length, // Distribute cost
                  shipstationShipmentId: createData.data.shipmentId,
                  shipstationLabelId: labelId, // For voiding labels later
                  labelUrl: labelUrl,
                  provider: 'shipstation',
                  shipFrom: fromAddress,
                  shipTo: toAddress,
                  length: parseFloat(carton.weight),
                  width: parseFloat(carton.width),
                  height: parseFloat(carton.height),
                  contents: mappedContents,
                }),
              }
            )

            if (!cartonResponse.ok) {
              console.error('Failed to create carton in PACE, but label was purchased')
            }

            packageIndex++
          }
        }

        // Update shipment with aggregated tracking, total cost, and final address
        try {
          const updateTrackingResponse = await fetch(
            `/api/pace/shipments/${shipment.id}/update-tracking`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                // Send the final address used on the labels
                address: {
                  street1: toAddress.street1,
                  street2: toAddress.street2,
                  city: toAddress.city,
                  state: toAddress.state,
                  zip: toAddress.zip,
                },
              }),
            }
          )

          if (!updateTrackingResponse.ok) {
            console.error('Failed to update shipment tracking aggregation')
          } else {
            const trackingData = await updateTrackingResponse.json()
            console.log('Updated shipment with aggregated tracking and address:', trackingData)
          }
        } catch (error) {
          console.error('Error updating shipment tracking:', error)
          // Don't fail the whole process if this fails
        }

        setCurrentStep(5)
      } catch (err: any) {
        setError(err.message || 'Failed to create shipping labels')
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleBack = () => {
    setError('')
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step)
    }
  }

  const handleClose = () => {
    setCurrentStep(1)
    setError('')
    setRates([])
    setSelectedRate(null)
    setLabelData(null)
    onClose()
  }

  const handleComplete = () => {
    handleClose()
    onSuccess()
  }

  // Helper function to add a new carton configuration
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

  // Helper function to remove a carton configuration
  const removeCarton = (index: number) => {
    const newCartons = cartons.filter((_, i) => i !== index)
    setCartons(newCartons.length > 0 ? newCartons : [cartons[0]]) // Keep at least one
  }

  // Helper function to update a carton field
  const updateCarton = (index: number, field: keyof CartonConfig, value: any) => {
    const newCartons = [...cartons]
    newCartons[index] = { ...newCartons[index], [field]: value }
    setCartons(newCartons)
  }

  // Helper function to add content to a carton
  const addContent = (cartonIndex: number) => {
    const newCartons = [...cartons]
    newCartons[cartonIndex].contents.push({ itemId: '', quantity: 0 })
    setCartons(newCartons)
  }

  // Helper function to remove content from a carton
  const removeContent = (cartonIndex: number, contentIndex: number) => {
    const newCartons = [...cartons]
    const contents = newCartons[cartonIndex].contents.filter((_, i) => i !== contentIndex)
    newCartons[cartonIndex].contents = contents.length > 0 ? contents : [{ itemId: '', quantity: 0 }]
    setCartons(newCartons)
  }

  // Helper function to update content
  const updateContent = (
    cartonIndex: number,
    contentIndex: number,
    field: 'itemId' | 'quantity',
    value: any
  ) => {
    const newCartons = [...cartons]
    newCartons[cartonIndex].contents[contentIndex] = {
      ...newCartons[cartonIndex].contents[contentIndex],
      [field]: value,
    }
    setCartons(newCartons)
  }

  // Prepare items for dropdown
  const allItems: Array<{ value: string; label: string }> = []
  if (jobItems) {
    // Add job itself as an option
    if (shipment?.job) {
      allItems.push({
        value: `job:${shipment.job}`,
        label: `Job: ${shipment.job}`,
      })
    }
    // Add components
    jobItems.components.forEach((comp) => {
      allItems.push({
        value: `component:${comp.id}`,
        label: `Component: ${comp.itemNumber || comp.description} (Qty: ${comp.qtyOrdered || 0})`,
      })
    })
    // Add products
    jobItems.products.forEach((prod) => {
      allItems.push({
        value: `product:${prod.id}`,
        label: `Product: ${prod.productID || prod.description}`,
      })
    })
    // Add parts
    jobItems.parts.forEach((part) => {
      allItems.push({
        value: part.id, // Already in format "part:jobId:partNum"
        label: `Part: ${part.partName || part.description}`,
      })
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Process Shipment - ShipStation</h3>
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
                {[1, 2, 3, 4, 5].map((step) => (
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
                        {step === 1 && 'Cartons'}
                        {step === 2 && 'Addresses'}
                        {step === 3 && 'Rates'}
                        {step === 4 && 'Options'}
                        {step === 5 && 'Labels'}
                      </div>
                    </div>
                    {step < 5 && (
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

            {/* Error Display */}
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

            {/* Step 1: Carton Configuration */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Configure Cartons</h3>
                      <p className="text-xs text-gray-700 mt-0.5">Add cartons with dimensions, weight, and contents.</p>
                    </div>
                  </div>
                </div>
                {loadingItems && <p className="text-xs text-gray-500">Loading job items...</p>}

                <div className="space-y-3">
                  {cartons.map((carton, cartonIndex) => (
                    <div key={cartonIndex} className="border-2 border-gray-200 rounded-lg bg-white shadow-sm">
                      {/* Carton Header */}
                      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                        <h4 className="text-sm font-bold text-gray-900">Carton {cartonIndex + 1}</h4>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => addContent(cartonIndex)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add
                          </button>
                          {cartons.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCarton(cartonIndex)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                            {allItems.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
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

                      {/* Dimensions, Weight, and Count */}
                      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                        <div className="grid grid-cols-5 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              L(in) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={carton.length}
                              onChange={(e) => updateCarton(cartonIndex, 'length', e.target.value)}
                              className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="12"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              W(in) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={carton.width}
                              onChange={(e) => updateCarton(cartonIndex, 'width', e.target.value)}
                              className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="8"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              H(in) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={carton.height}
                              onChange={(e) => updateCarton(cartonIndex, 'height', e.target.value)}
                              className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="6"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Wt(lb) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={carton.weight}
                              onChange={(e) => updateCarton(cartonIndex, 'weight', e.target.value)}
                              className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="1.0"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Qty <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={carton.count}
                              onChange={(e) =>
                                updateCarton(cartonIndex, 'count', parseInt(e.target.value) || 1)
                              }
                              className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="1"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addCarton}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all text-sm font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Another Carton
                </button>
              </div>
            )}

            {/* Step 2: Addresses */}
            {currentStep === 2 && (
              <Step2AddressesShipStation
                fromAddress={fromAddress}
                toAddress={toAddress}
                setFromAddress={setFromAddress}
                setToAddress={setToAddress}
                shipmentId={shipment?.id}
                validationResult={validationResult}
                setValidationResult={setValidationResult}
                hasValidated={hasValidated}
                setHasValidated={setHasValidated}
              />
            )}

            {/* Step 3: Rate Selection */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Select Shipping Rate</h3>
                      <p className="text-xs text-gray-700 mt-0.5">Compare rates across carriers. Badges show recommended options.</p>
                    </div>
                  </div>
                </div>
                {rates.length === 0 ? (
                  <p className="text-gray-500 text-sm">No rates available</p>
                ) : (
                  (() => {
                    // Group rates by carrier
                    const ratesByCarrier = rates.reduce((acc, rate) => {
                      if (!acc[rate.carrier]) {
                        acc[rate.carrier] = []
                      }
                      acc[rate.carrier].push(rate)
                      return acc
                    }, {} as Record<string, typeof rates>)

                    const carriers = Object.keys(ratesByCarrier)

                    return (
                      <div className={`grid gap-4 ${carriers.length === 1 ? 'grid-cols-1' : carriers.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {carriers.map((carrier) => (
                          <div key={carrier} className="space-y-2">
                            <h4 className="font-bold text-gray-900 text-sm px-2 py-1 bg-gray-100 rounded sticky top-0">{carrier}</h4>
                            {ratesByCarrier[carrier].map((rate) => {
                              const hasDetails = rate.rateDetails && rate.rateDetails.length > 0
                              const shippingDetail = hasDetails ? rate.rateDetails?.find(d => d.type === 'shipping') : null
                              const otherDetails = (hasDetails ? rate.rateDetails?.filter(d => d.type !== 'shipping') : []) ?? []
                              const hasWarnings = rate.warningMessages && rate.warningMessages.length > 0

                              return (
                                <div
                                  key={rate.rateId}
                                  onClick={() => setSelectedRate(rate)}
                                  className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                                    selectedRate?.rateId === rate.rateId
                                      ? 'border-blue-600 bg-blue-50'
                                      : 'border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  {/* Header */}
                                  <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-gray-900 truncate">{rate.service}</p>
                                        {rate.deliveryDays && (
                                          <p className="text-xs text-gray-500">
                                            {rate.deliveryDays} {rate.deliveryDays === 1 ? 'day' : 'days'}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <p className="text-lg font-bold text-gray-900">
                                          ${rate.amount.toFixed(2)}
                                        </p>
                                      </div>
                                    </div>
                                    {rate.rateAttributes && rate.rateAttributes.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {rate.rateAttributes.map((attr) => {
                                          const badgeStyles = {
                                            best_value: 'bg-green-100 text-green-700',
                                            cheapest: 'bg-blue-100 text-blue-700',
                                            fastest: 'bg-purple-100 text-purple-700',
                                          }
                                          const labels = {
                                            best_value: '⭐ Best',
                                            cheapest: '💰 Cheapest',
                                            fastest: '⚡ Fastest',
                                          }
                                          return (
                                            <span
                                              key={attr}
                                              className={`text-xs px-1.5 py-0.5 rounded font-medium ${badgeStyles[attr as keyof typeof badgeStyles] || 'bg-gray-100 text-gray-700'}`}
                                            >
                                              {labels[attr as keyof typeof labels] || attr}
                                            </span>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* Cost Breakdown */}
                                  {hasDetails && (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                      <details className="group">
                                        <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1">
                                          <svg className="w-3 h-3 transform transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                          Details
                                        </summary>
                                        <div className="mt-1 ml-4 space-y-0.5 text-xs">
                                          {shippingDetail && (
                                            <div className="flex justify-between">
                                              <span className="text-gray-600 truncate">{shippingDetail.description}</span>
                                              <span className="font-medium text-gray-900 ml-2">${shippingDetail.amount.toFixed(2)}</span>
                                            </div>
                                          )}
                                          {otherDetails.map((detail, idx) => (
                                            <div key={idx} className="flex justify-between">
                                              <span className="text-amber-700 truncate">{detail.description}</span>
                                              <span className="text-amber-800 ml-2">+${detail.amount.toFixed(2)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </details>
                                    </div>
                                  )}

                                  {/* Warnings */}
                                  {hasWarnings && (
                                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
                                      {rate.warningMessages!.map((warning, idx) => (
                                        <p key={idx} className="text-amber-800">{warning}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    )
                  })()
                )}
              </div>
            )}

            {/* Step 4: Ship Date & Return Label Options */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Ship Date & Label Options</h3>
                      <p className="text-xs text-gray-700 mt-0.5">Configure ship date and optional return label settings.</p>
                    </div>
                  </div>
                </div>

                {/* Ship Date & Label References */}
                <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="mb-3">
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Ship Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={shipDate}
                      onChange={(e) => setShipDate(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      required
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      ShipStation will consider the carrier's operating days for scheduling.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                      Label References <span className="text-gray-500">(Optional - appears on physical label)</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <input
                          type="text"
                          value={labelMessages.reference1}
                          onChange={(e) => setLabelMessages({ ...labelMessages, reference1: e.target.value })}
                          placeholder="Ref 1"
                          maxLength={35}
                          className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-0.5">Ref 1 (35 chr)</p>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={labelMessages.reference2}
                          onChange={(e) => setLabelMessages({ ...labelMessages, reference2: e.target.value })}
                          placeholder="Ref 2"
                          maxLength={30}
                          className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-0.5">Ref 2 (30 chr)</p>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={labelMessages.reference3}
                          onChange={(e) => setLabelMessages({ ...labelMessages, reference3: e.target.value })}
                          placeholder="Ref 3"
                          maxLength={30}
                          className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-0.5">Ref 3 (30 chr)</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Return Label Options */}
                <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-sm">
                  {(() => {
                    const totalPackages = cartons.reduce((sum, c) => sum + c.count, 0)
                    const isMultiPackage = totalPackages > 1

                    return (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <input
                            type="checkbox"
                            id="isReturnLabel"
                            checked={isReturnLabel}
                            onChange={(e) => setIsReturnLabel(e.target.checked)}
                            disabled={isMultiPackage}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <label htmlFor="isReturnLabel" className={`text-sm font-bold ${isMultiPackage ? 'text-gray-400' : 'text-gray-900'}`}>
                            Create as Return Label
                            {isMultiPackage && <span className="ml-2 text-xs font-normal">(Not available for multi-package shipments)</span>}
                          </label>
                        </div>

                        {isMultiPackage && (
                          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                            <strong>Note:</strong> Return labels cannot be created for shipments with multiple packages ({totalPackages} packages).
                            Most carriers, including FedEx, only support return labels for single-package shipments.
                            Please create separate shipments for each package if you need return labels.
                          </div>
                        )}
                      </>
                    )
                  })()}

                  {isReturnLabel && (
                    <div className="space-y-3 mt-3 pt-3 border-t border-gray-200">
                      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
                        <p className="font-semibold mb-1">Return Label Information:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li><strong>BOTH labels will be created:</strong> Outbound shipping label + Return label</li>
                          <li>Include the return label in the package for customer convenience</li>
                          <li>Returns are only supported for domestic shipments</li>
                          <li>Addresses will be reversed automatically for the return label</li>
                          <li>You'll typically only be charged when the customer uses the return label</li>
                        </ul>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          RMA Number <span className="text-gray-500">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={rmaNumber}
                          onChange={(e) => setRmaNumber(e.target.value)}
                          placeholder="e.g., RMA-2024-001"
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Return Merchandise Authorization code for your internal tracking
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

        {/* Step 5: Labels Created */}
        {currentStep === 5 && labelData && (
          <div className="space-y-4">
            <div className="rounded-lg p-4 bg-green-50">
              <h3 className="mb-2 text-lg font-medium text-green-800">
                {labelData.return ? 'Shipping & Return Labels Created Successfully!' : 'Shipping Labels Created Successfully!'}
              </h3>
              <p className="text-sm text-green-700">
                {labelData.return
                  ? 'Both outbound and return labels have been created. Include the return label in the package for customer convenience.'
                  : 'Your shipment has been created with ShipStation.'}
              </p>
            </div>

            {/* Outbound Label Section */}
            <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📦</span>
                <h4 className="text-lg font-bold text-blue-900">Outbound Shipping Label</h4>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-blue-700">Carrier:</span>
                  <span className="text-blue-900">{selectedRate?.carrier}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-blue-700">Service:</span>
                  <span className="text-blue-900">{selectedRate?.service}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-blue-700">Tracking Number:</span>
                  <span className="font-mono text-sm text-blue-900">{labelData.outbound.trackingNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-blue-700">Total Packages:</span>
                  <span className="text-blue-900">{cartons.reduce((sum, c) => sum + c.count, 0)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                  <span className="font-medium text-blue-700">Shipping Cost:</span>
                  <span className="text-blue-900 font-bold">${labelData.outbound.totalCost.toFixed(2)} {labelData.outbound.currency}</span>
                </div>
              </div>

              {labelData.outbound.labelUrl && (
                <a
                  href={labelData.outbound.labelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full mt-3 rounded-md px-4 py-2 text-center text-white font-medium bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  📦 Download Outbound Shipping Label
                </a>
              )}
            </div>

            {/* Return Label Section */}
            {labelData.return && (
              <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🔄</span>
                  <h4 className="text-lg font-bold text-amber-900">Return Label</h4>
                  {labelData.return.rmaNumber && (
                    <span className="text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded font-mono">
                      RMA: {labelData.return.rmaNumber}
                    </span>
                  )}
                </div>

                <div className="mb-3 p-2 bg-amber-100 border border-amber-300 rounded text-xs text-amber-800">
                  <strong>💡 Tip:</strong> Include this return label in the package so the customer can easily return items if needed.
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-amber-700">Return Tracking:</span>
                    <span className="font-mono text-sm text-amber-900">{labelData.return.trackingNumber}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-amber-700">Charge Method:</span>
                    <span className="text-amber-900">Carrier Default (typically on usage)</span>
                  </div>
                </div>

                {labelData.return.labelUrl && (
                  <a
                    href={labelData.return.labelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full mt-3 rounded-md px-4 py-2 text-center text-white font-medium bg-amber-600 hover:bg-amber-700 transition-colors"
                  >
                    🔄 Download Return Label
                  </a>
                )}
              </div>
            )}

            {/* Package Details */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-700 mb-3">Package Details</div>
              <div className="space-y-2">
                {cartons.map((carton, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {carton.count}x Box {index + 1} ({carton.length}" × {carton.width}" × {carton.height}")
                    </span>
                    <span className="text-gray-900">{carton.weight} lb each</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

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
            onClick={currentStep === 5 ? handleComplete : handleNext}
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
            ) : currentStep === 5 ? 'Complete' : currentStep === 4 ? 'Create Labels' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Step 2 Addresses Component
function Step2AddressesShipStation({
  fromAddress,
  toAddress,
  setFromAddress,
  setToAddress,
  shipmentId,
  validationResult,
  setValidationResult,
  hasValidated,
  setHasValidated,
}: {
  fromAddress: AddressData
  toAddress: AddressData
  setFromAddress: (data: AddressData) => void
  setToAddress: (data: AddressData) => void
  shipmentId?: string | number
  validationResult: any
  setValidationResult: (result: any) => void
  hasValidated: boolean
  setHasValidated: (validated: boolean) => void
}) {
  const [isFromAddressExpanded, setIsFromAddressExpanded] = useState(false)
  const [validating, setValidating] = useState(false)
  const [originalAddress, setOriginalAddress] = useState<{ city: string; state: string; zip: string } | null>(null)

  const validateAddress = async () => {
    // Don't validate if required fields are missing
    if (!toAddress.street1 || !toAddress.city || !toAddress.state || !toAddress.zip) {
      return
    }

    setValidating(true)
    setValidationResult(null)

    try {
      const response = await fetch('/api/shipstation/addresses/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: {
            name: toAddress.name,
            company_name: toAddress.company,
            address_line1: toAddress.street1,
            address_line2: toAddress.street2,
            city_locality: toAddress.city,
            state_province: toAddress.state,
            postal_code: toAddress.zip,
            country_code: toAddress.country,
            phone: toAddress.phone,
          },
        }),
      })

      const data = await response.json()

      console.log('Address validation response:', {
        success: data.success,
        status: data.data?.status,
        hasMatchedAddress: !!data.data?.matched_address,
        matchedAddress: data.data?.matched_address,
        originalAddress: {
          city: toAddress.city,
          state: toAddress.state,
          zip: toAddress.zip,
        },
      })

      if (data.success) {
        setValidationResult(data.data)
        setHasValidated(true)

        // Auto-apply corrections if we have a matched address with differences
        if (data.data.matched_address) {
          const matched = data.data.matched_address
          const hasDifferences =
            matched.city_locality?.toLowerCase() !== toAddress.city.toLowerCase() ||
            matched.state_province !== toAddress.state ||
            matched.postal_code !== toAddress.zip

          console.log('Checking for address differences:', {
            hasDifferences,
            cityMatch: matched.city_locality?.toLowerCase() === toAddress.city.toLowerCase(),
            stateMatch: matched.state_province === toAddress.state,
            zipMatch: matched.postal_code === toAddress.zip,
            matched,
            current: {
              city: toAddress.city,
              state: toAddress.state,
              zip: toAddress.zip,
            },
          })

          if (hasDifferences) {
            // Save original address before applying corrections
            setOriginalAddress({
              city: toAddress.city,
              state: toAddress.state,
              zip: toAddress.zip,
            })

            // Auto-apply the corrections
            const updatedAddress = {
              ...toAddress,
              city: matched.city_locality || toAddress.city,
              state: matched.state_province || toAddress.state,
              zip: matched.postal_code || toAddress.zip,
            }
            setToAddress(updatedAddress)

            // Also update in PACE (only if shipmentId is defined)
            if (shipmentId) {
              console.log('Updating shipment address in PACE:', {
                shipmentId,
                updatedAddress,
              })

              fetch(`/api/pace/shipments/${shipmentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  address: {
                    city: updatedAddress.city,
                    state: updatedAddress.state,
                    zip: updatedAddress.zip,
                    street1: updatedAddress.street1,
                    street2: updatedAddress.street2,
                  },
                }),
              })
                .then(async (response) => {
                  const data = await response.json()
                  if (!response.ok) {
                    console.error('Failed to update address in PACE:', data)
                  } else {
                    console.log('Successfully updated address in PACE:', data)
                  }
                })
                .catch(error => {
                  console.error('Error updating address in PACE:', error)
                })
            } else {
              console.warn('No shipmentId provided, skipping PACE address update')
            }
          }
        }
      } else {
        setValidationResult({ status: 'error', messages: [{ message: data.error, type: 'error' }] })
        setHasValidated(true)
      }
    } catch (error: any) {
      setValidationResult({ status: 'error', messages: [{ message: error.message, type: 'error' }] })
      setHasValidated(true)
    } finally {
      setValidating(false)
    }
  }

  // Auto-validate when required fields are filled
  useEffect(() => {
    // Only auto-validate if we haven't validated yet and all required fields are filled
    if (!hasValidated && toAddress.street1 && toAddress.city && toAddress.state && toAddress.zip) {
      const timer = setTimeout(() => {
        validateAddress()
      }, 500) // Debounce for 500ms

      return () => clearTimeout(timer)
    }
  }, [toAddress.street1, toAddress.city, toAddress.state, toAddress.zip, hasValidated])

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Verify Shipping Addresses</h3>
            <p className="text-xs text-gray-700 mt-0.5">Confirm origin and destination addresses.</p>
          </div>
        </div>
      </div>

      {/* From Address - Collapsible */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setIsFromAddressExpanded(!isFromAddressExpanded)}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            From Address
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 font-medium">
              {fromAddress.company || fromAddress.name || 'Default'}
            </span>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${isFromAddressExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isFromAddressExpanded && (
          <div className="px-4 pb-3 border-t border-gray-200 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={fromAddress.name}
                  onChange={(e) => setFromAddress({ ...fromAddress, name: e.target.value })}
                  className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={fromAddress.company}
                  onChange={(e) => setFromAddress({ ...fromAddress, company: e.target.value })}
                  className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Street 1</label>
                <input
                  type="text"
                  value={fromAddress.street1}
                  onChange={(e) => setFromAddress({ ...fromAddress, street1: e.target.value })}
                  className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Street 2</label>
                <input
                  type="text"
                  value={fromAddress.street2}
                  onChange={(e) => setFromAddress({ ...fromAddress, street2: e.target.value })}
                  className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={fromAddress.city}
                  onChange={(e) => setFromAddress({ ...fromAddress, city: e.target.value })}
                  className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={fromAddress.state}
                    onChange={(e) => setFromAddress({ ...fromAddress, state: e.target.value })}
                    className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ZIP</label>
                  <input
                    type="text"
                    value={fromAddress.zip}
                    onChange={(e) => setFromAddress({ ...fromAddress, zip: e.target.value })}
                    className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={fromAddress.phone}
                  onChange={(e) => setFromAddress({ ...fromAddress, phone: e.target.value })}
                  className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* To Address */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 p-4 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            To Address (Destination)
          </h4>
          {validating && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-600">
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Validating...
            </span>
          )}
        </div>

        {/* Validation Result */}
        {validationResult && (() => {
          // Check if there are any warning or error messages
          const hasWarnings = validationResult.messages && validationResult.messages.length > 0
          const hasErrors = validationResult.messages && validationResult.messages.some((m: any) => m.type === 'error')

          // Determine effective status (warnings override verified status)
          const effectiveStatus = hasErrors ? 'error' :
                                 hasWarnings ? 'warning' :
                                 validationResult.status

          return (
            <div className={`mb-3 p-2 rounded text-xs ${
              effectiveStatus === 'verified' ? 'bg-green-50 border border-green-200' :
              effectiveStatus === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start gap-2">
                {effectiveStatus === 'verified' && (
                  <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {effectiveStatus === 'warning' && (
                  <svg className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                {(effectiveStatus === 'error' || effectiveStatus === 'unverified') && (
                  <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <div className="flex-1">
                  <p className={`font-semibold ${
                    effectiveStatus === 'verified' ? 'text-green-800' :
                    effectiveStatus === 'warning' ? 'text-yellow-800' :
                    'text-red-800'
                  }`}>
                    {effectiveStatus === 'verified' ? 'Address Verified - No Issues Found ✓' :
                     effectiveStatus === 'warning' ? 'Address Verified with Warnings' :
                     effectiveStatus === 'unverified' ? 'Address Could Not Be Verified' :
                     'Validation Error'}
                  </p>
                {validationResult.messages && validationResult.messages.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {validationResult.messages.map((msg: any, idx: number) => (
                      <li key={idx} className={`text-xs ${
                        msg.type === 'error' ? 'text-red-700' :
                        msg.type === 'warning' ? 'text-yellow-700' :
                        'text-gray-700'
                      }`}>
                        • {msg.message}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Show applied corrections with undo option */}
                {originalAddress && validationResult.matched_address && (() => {
                  const matched = validationResult.matched_address
                  const appliedChanges = []

                  if (matched.city_locality && matched.city_locality.toLowerCase() !== originalAddress.city.toLowerCase()) {
                    appliedChanges.push({ field: 'City', from: originalAddress.city, to: matched.city_locality })
                  }
                  if (matched.state_province && matched.state_province !== originalAddress.state) {
                    appliedChanges.push({ field: 'State', from: originalAddress.state, to: matched.state_province })
                  }
                  if (matched.postal_code && matched.postal_code !== originalAddress.zip) {
                    appliedChanges.push({ field: 'ZIP', from: originalAddress.zip, to: matched.postal_code })
                  }

                  if (appliedChanges.length === 0) return null

                  return (
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <p className="text-xs font-semibold text-blue-800 mb-1">✓ Corrections Auto-Applied:</p>
                      <div className="text-xs text-blue-700 space-y-0.5 mb-2">
                        {appliedChanges.map((change, idx) => (
                          <div key={idx}>
                            • {change.field}: <span className="line-through opacity-60">{change.from}</span> → <span className="font-medium">{change.to}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          // Restore original address
                          const restoredAddress = {
                            ...toAddress,
                            city: originalAddress.city,
                            state: originalAddress.state,
                            zip: originalAddress.zip,
                          }
                          setToAddress(restoredAddress)

                          // Update PACE with original address (only if shipmentId is defined)
                          if (shipmentId) {
                            try {
                              console.log('Restoring original address in PACE:', {
                                shipmentId,
                                restoredAddress,
                              })

                              const response = await fetch(`/api/pace/shipments/${shipmentId}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  address: {
                                    city: restoredAddress.city,
                                    state: restoredAddress.state,
                                    zip: restoredAddress.zip,
                                    street1: restoredAddress.street1,
                                    street2: restoredAddress.street2,
                                  },
                                }),
                              })

                              const data = await response.json()
                              if (!response.ok) {
                                console.error('Failed to restore address in PACE:', data)
                              } else {
                                console.log('Successfully restored address in PACE:', data)
                              }
                            } catch (error) {
                              console.error('Error restoring address in PACE:', error)
                            }
                          } else {
                            console.warn('No shipmentId provided, skipping PACE address restore')
                          }

                          // Clear original address state
                          setOriginalAddress(null)
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-300 rounded hover:bg-orange-100 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Undo Corrections
                      </button>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
          )
        })()}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={toAddress.name}
              onChange={(e) => setToAddress({ ...toAddress, name: e.target.value })}
              className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
            <input
              type="text"
              value={toAddress.company}
              onChange={(e) => setToAddress({ ...toAddress, company: e.target.value })}
              className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Street 1 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={toAddress.street1}
              onChange={(e) => {
                setToAddress({ ...toAddress, street1: e.target.value })
                setHasValidated(false)
                setValidationResult(null)
              }}
              className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Street 2</label>
            <input
              type="text"
              value={toAddress.street2}
              onChange={(e) => setToAddress({ ...toAddress, street2: e.target.value })}
              className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={toAddress.city}
              onChange={(e) => {
                setToAddress({ ...toAddress, city: e.target.value })
                setHasValidated(false)
                setValidationResult(null)
              }}
              className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={toAddress.state}
                onChange={(e) => {
                  setToAddress({ ...toAddress, state: e.target.value })
                  setHasValidated(false)
                  setValidationResult(null)
                }}
                className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                ZIP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={toAddress.zip}
                onChange={(e) => {
                  setToAddress({ ...toAddress, zip: e.target.value })
                  setHasValidated(false)
                  setValidationResult(null)
                }}
                className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="text"
              value={toAddress.phone}
              onChange={(e) => setToAddress({ ...toAddress, phone: e.target.value })}
              className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

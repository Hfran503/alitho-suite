'use client'

import { useState, useEffect } from 'react'

type Step = 1 | 2 | 3 | 4 | 5

interface CartonConfig {
  length: string
  width: string
  height: string
  weight: string
  count: number
  contents: Array<{
    description: string
    quantity: number
  }>
  useCarrierPackage: boolean
  carrierPackageCode?: string
  carrierPackageName?: string
}

interface CarrierPackage {
  package_id: string | null
  package_code: string
  name: string
  description: string
}

interface Carrier {
  carrier_id: string
  carrier_code: string
  friendly_name: string
  services: Array<{
    service_code: string
    name: string
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
  rateAttributes?: string[]
  warningMessages?: string[]
}

export function ManualLabelForm() {
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
      contents: [{ description: '', quantity: 1 }],
      useCarrierPackage: false,
    },
  ])

  // Carriers and packages state
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [carrierPackages, setCarrierPackages] = useState<Record<string, CarrierPackage[]>>({})
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>('')

  // Step 2 data - Address validation
  const [validationResult, setValidationResult] = useState<any>(null)
  const [hasValidated, setHasValidated] = useState(false)
  const [isFromAddressExpanded, setIsFromAddressExpanded] = useState(false)
  const [addressCorrections, setAddressCorrections] = useState<{
    city?: { from: string; to: string }
    state?: { from: string; to: string }
    zip?: { from: string; to: string }
  } | null>(null)

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
    name: '',
    company: '',
    street1: '',
    street2: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
    phone: '',
    email: '',
  })

  // Step 3 data
  const [rates, setRates] = useState<Rate[]>([])
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null)

  // Step 4 data - Ship Date and Return Label Options
  const [shipDate, setShipDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [isReturnLabel, setIsReturnLabel] = useState(false)
  const [rmaNumber, setRmaNumber] = useState('')
  const [shipmentReference, setShipmentReference] = useState('')
  const [labelMessages, setLabelMessages] = useState({
    reference1: '',
    reference2: '',
    reference3: '',
  })

  // Advanced options state
  const [advancedOptions, setAdvancedOptions] = useState({
    billToAccount: '',
    billToParty: 'sender' as 'sender' | 'recipient' | 'third_party',
    billToCountryCode: 'US',
    billToPostalCode: '',
    containsAlcohol: false,
    saturdayDelivery: false,
    notificationsEmail: '',
    confirmation: 'none' as 'none' | 'delivery' | 'signature' | 'adult_signature' | 'direct_signature',
  })

  // Step 5 data
  const [labelData, setLabelData] = useState<{
    outbound: {
      trackingNumber: string
      labelUrl: string
      shipmentId: string
      labelId: string
      totalCost: number
      currency: string
      costBreakdown?: {
        shipmentCost: number
        insuranceCost: number
        confirmationCost: number
        otherCost: number
      }
      packages?: any[]
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

    loadDefaultFromAddress()
  }, [])

  // Load carriers on mount
  useEffect(() => {
    const loadCarriers = async () => {
      try {
        const response = await fetch('/api/shipstation/carriers')
        if (response.ok) {
          const data = await response.json()
          setCarriers(data.data.carriers || [])

          // Auto-select first carrier if available
          if (data.data.carriers && data.data.carriers.length > 0) {
            const firstCarrier = data.data.carriers[0]
            setSelectedCarrierId(firstCarrier.carrier_id)
          }
        }
      } catch (error) {
        console.error('Failed to load carriers:', error)
      }
    }

    loadCarriers()
  }, [])

  // Load carrier packages when carrier is selected
  useEffect(() => {
    if (!selectedCarrierId) return

    const loadCarrierPackages = async () => {
      try {
        // Check if we already have packages for this carrier
        if (carrierPackages[selectedCarrierId]) return

        const response = await fetch(`/api/shipstation/carriers/${selectedCarrierId}/packages`)
        if (response.ok) {
          const data = await response.json()
          setCarrierPackages(prev => ({
            ...prev,
            [selectedCarrierId]: data.data.packages || []
          }))
        }
      } catch (error) {
        console.error('Failed to load carrier packages:', error)
      }
    }

    loadCarrierPackages()
  }, [selectedCarrierId, carrierPackages])

  // Auto-validate address when toAddress changes
  useEffect(() => {
    const validateAddress = async () => {
      if (!toAddress.street1 || !toAddress.city || !toAddress.state || !toAddress.zip) {
        setValidationResult(null)
        setHasValidated(false)
        // Don't clear corrections - let them persist
        return
      }

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

        if (data.success) {
          setValidationResult(data.data)
          setHasValidated(true)

          // Auto-correct address if differences found
          if (data.data.matched_address) {
            const matched = data.data.matched_address
            const matchedZip5 = matched.postal_code ? matched.postal_code.split('-')[0] : matched.postal_code

            const corrections: any = {}

            // Track city changes
            if (matched.city_locality && matched.city_locality.toLowerCase() !== toAddress.city.toLowerCase()) {
              corrections.city = { from: toAddress.city, to: matched.city_locality }
            }

            // Track state changes
            if (matched.state_province && matched.state_province !== toAddress.state) {
              corrections.state = { from: toAddress.state, to: matched.state_province }
            }

            // Track ZIP changes
            if (matchedZip5 && matchedZip5 !== toAddress.zip) {
              corrections.zip = { from: toAddress.zip, to: matchedZip5 }
            }

            const hasDifferences = Object.keys(corrections).length > 0

            if (hasDifferences) {
              // Only set new corrections if we don't already have them
              // This prevents the message from disappearing when user types
              setAddressCorrections(prev => prev || corrections)
              const correctedZip = matched.postal_code ? matched.postal_code.split('-')[0] : toAddress.zip
              setToAddress({
                ...toAddress,
                city: matched.city_locality || toAddress.city,
                state: matched.state_province || toAddress.state,
                zip: correctedZip,
              })
            }
            // Don't clear corrections even if no new differences found
          }
        } else {
          setValidationResult({ status: 'error', messages: [{ message: data.error, type: 'error' }] })
          setHasValidated(true)
        }
      } catch (error: any) {
        setValidationResult({ status: 'error', messages: [{ message: error.message, type: 'error' }] })
        setHasValidated(true)
      }
    }

    // Debounce validation
    const timer = setTimeout(validateAddress, 1000)
    return () => clearTimeout(timer)
  }, [toAddress.street1, toAddress.city, toAddress.state, toAddress.zip])

  const handleNext = async () => {
    setError('')

    if (currentStep === 1) {
      // Validate all cartons
      for (let i = 0; i < cartons.length; i++) {
        const carton = cartons[i]

        // Validate based on whether using carrier package or custom dimensions
        if (carton.useCarrierPackage) {
          if (!carton.carrierPackageCode) {
            setError(`Carton ${i + 1}: Please select a carrier package`)
            return
          }
          if (!carton.weight) {
            setError(`Carton ${i + 1}: Please enter weight`)
            return
          }
        } else {
          if (!carton.length || !carton.width || !carton.height || !carton.weight) {
            setError(`Carton ${i + 1}: Please fill in all dimensions and weight`)
            return
          }
        }

        if (carton.count < 1) {
          setError(`Carton ${i + 1}: Count must be at least 1`)
          return
        }

        const hasInvalidContents = carton.contents.some(
          (c) => !c.description || !c.quantity || c.quantity <= 0
        )
        if (hasInvalidContents) {
          setError(`Carton ${i + 1}: Please enter descriptions and valid quantities for all contents`)
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

      if (!hasValidated || !validationResult) {
        setError('Please wait for address validation to complete before continuing')
        return
      }

      if (validationResult.status === 'error' || validationResult.status === 'unverified') {
        setError('Address validation failed. Please correct the address.')
        return
      }

      setIsLoading(true)
      try {
        // Build packages array
        const packages = []
        for (const carton of cartons) {
          for (let i = 0; i < carton.count; i++) {
            const pkg: any = {
              weight: parseFloat(carton.weight),
              weightUnit: 'pound',
            }

            if (carton.useCarrierPackage && carton.carrierPackageCode) {
              // Use carrier package code
              pkg.package_code = carton.carrierPackageCode
            } else {
              // Use custom dimensions
              pkg.length = parseFloat(carton.length)
              pkg.width = parseFloat(carton.width)
              pkg.height = parseFloat(carton.height)
              pkg.dimensionUnit = 'inch'
            }

            packages.push(pkg)
          }
        }

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
      if (!selectedRate) {
        setError('Please select a shipping rate')
        return
      }
      setCurrentStep(4)
    } else if (currentStep === 4) {
      if (!shipDate) {
        setError('Please select a ship date')
        return
      }

      if (!selectedRate) {
        setError('Please select a shipping rate')
        return
      }

      setIsLoading(true)
      try {
        // Build packages array
        const packages = []
        for (const carton of cartons) {
          for (let i = 0; i < carton.count; i++) {
            const pkg: any = {
              weight: parseFloat(carton.weight),
              weightUnit: 'pound',
            }

            if (carton.useCarrierPackage && carton.carrierPackageCode) {
              // Use carrier package code
              pkg.package_code = carton.carrierPackageCode
            } else {
              // Use custom dimensions
              pkg.length = parseFloat(carton.length)
              pkg.width = parseFloat(carton.width)
              pkg.height = parseFloat(carton.height)
              pkg.dimensionUnit = 'inch'
            }

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

        // Build advanced options
        const advancedOptionsPayload: any = {}
        if (advancedOptions.billToAccount) {
          advancedOptionsPayload.bill_to_account = advancedOptions.billToAccount
        }
        if (advancedOptions.billToParty && advancedOptions.billToParty !== 'sender') {
          advancedOptionsPayload.bill_to_party = advancedOptions.billToParty
        }
        if (advancedOptions.billToCountryCode && advancedOptions.billToParty === 'third_party') {
          advancedOptionsPayload.bill_to_country_code = advancedOptions.billToCountryCode
        }
        if (advancedOptions.billToPostalCode && advancedOptions.billToParty === 'third_party') {
          advancedOptionsPayload.bill_to_postal_code = advancedOptions.billToPostalCode
        }
        if (advancedOptions.containsAlcohol) {
          advancedOptionsPayload.contains_alcohol = true
        }
        if (advancedOptions.saturdayDelivery) {
          advancedOptionsPayload.saturday_delivery = true
        }
        if (advancedOptions.notificationsEmail) {
          advancedOptionsPayload.NotificationsEmail = advancedOptions.notificationsEmail
        }

        // Create outbound label
        const createResponse = await fetch('/api/shipstation/labels/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shipmentId: shipmentReference || 'manual',
            carrierId: selectedRate.carrierId,
            serviceCode: selectedRate.serviceCode,
            shipFrom: fromAddress,
            shipTo: toAddress,
            packages,
            shipDate: shipDate ? new Date(shipDate).toISOString() : undefined,
            isReturnLabel: false,
            advancedOptions: Object.keys(advancedOptionsPayload).length > 0 ? advancedOptionsPayload : undefined,
            confirmation: advancedOptions.confirmation !== 'none' ? advancedOptions.confirmation : undefined,
          }),
        })

        if (!createResponse.ok) {
          const errorData = await createResponse.json()
          throw new Error(errorData.error || 'Failed to create shipping labels')
        }

        const createData = await createResponse.json()

        const newLabelData: any = {
          outbound: {
            trackingNumber: createData.data.trackingNumber,
            labelUrl: createData.data.labelUrl,
            shipmentId: createData.data.shipmentId,
            labelId: createData.data.labelId,
            totalCost: createData.data.totalCost,
            currency: createData.data.currency,
            costBreakdown: createData.data.costBreakdown,
            packages: createData.data.packages || [],
          }
        }

        // Parse shipmentReference as integer if it's a valid number, otherwise null
        const parsedShipmentId = shipmentReference && !isNaN(parseInt(shipmentReference))
          ? parseInt(shipmentReference)
          : null

        // Save outbound label to database
        try {
          await fetch('/api/labels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paceShipmentId: parsedShipmentId,
              provider: 'shipstation',
              providerShipmentId: createData.data.shipmentId,
              providerLabelId: createData.data.labelId,
              trackingNumber: createData.data.trackingNumber,
              labelUrl: createData.data.labelUrl,
              carrier: selectedRate.carrier,
              service: selectedRate.service,
              shipFrom: fromAddress,
              shipTo: toAddress,
              cost: createData.data.totalCost,
              currency: createData.data.currency,
              isReturnLabel: false,
            }),
          })
        } catch (err) {
          console.error('Error saving outbound label:', err)
        }

        // Create return label if requested
        if (isReturnLabel) {
          try {
            const returnResponse = await fetch('/api/shipstation/labels/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                shipmentId: shipmentReference || 'manual',
                carrierId: selectedRate.carrierId,
                serviceCode: selectedRate.serviceCode,
                shipFrom: toAddress,
                shipTo: fromAddress,
                packages,
                shipDate: shipDate ? new Date(shipDate).toISOString() : undefined,
                isReturnLabel: true,
                rmaNumber: rmaNumber || undefined,
                chargeEvent: 'carrier_default',
                outboundLabelId: createData.data.labelId,
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

              // Save return label to database
              try {
                await fetch('/api/labels', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    paceShipmentId: parsedShipmentId,
                    provider: 'shipstation',
                    providerShipmentId: returnData.data.shipmentId,
                    providerLabelId: returnData.data.labelId,
                    trackingNumber: returnData.data.trackingNumber,
                    labelUrl: returnData.data.labelUrl,
                    carrier: selectedRate.carrier,
                    service: selectedRate.service,
                    shipFrom: toAddress,
                    shipTo: fromAddress,
                    cost: returnData.data.totalCost,
                    currency: returnData.data.currency,
                    isReturnLabel: true,
                    outboundLabelId: createData.data.labelId,
                    rmaNumber: rmaNumber,
                  }),
                })
              } catch (err) {
                console.error('Error saving return label:', err)
              }
            } else {
              const errorData = await returnResponse.json()
              setError(`Outbound label created, but return label failed: ${errorData.error}`)
            }
          } catch (err: any) {
            setError(`Outbound label created, but return label failed: ${err.message}`)
          }
        }

        setLabelData(newLabelData)
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

  const handleComplete = () => {
    // Reset form
    setCurrentStep(1)
    setCartons([{
      length: '',
      width: '',
      height: '',
      weight: '',
      count: 1,
      contents: [{ description: '', quantity: 1 }],
      useCarrierPackage: false,
    }])
    setToAddress({
      name: '',
      company: '',
      street1: '',
      street2: '',
      city: '',
      state: '',
      zip: '',
      country: 'US',
      phone: '',
      email: '',
    })
    setRates([])
    setSelectedRate(null)
    setLabelData(null)
    setError('')
    setValidationResult(null)
    setHasValidated(false)
    setAddressCorrections(null)
  }

  // Helper functions for cartons
  const addCarton = () => {
    setCartons([
      ...cartons,
      {
        length: '',
        width: '',
        height: '',
        weight: '',
        count: 1,
        contents: [{ description: '', quantity: 1 }],
        useCarrierPackage: false,
      },
    ])
  }

  const removeCarton = (index: number) => {
    const newCartons = cartons.filter((_, i) => i !== index)
    setCartons(newCartons.length > 0 ? newCartons : [cartons[0]])
  }

  const updateCarton = (index: number, field: keyof CartonConfig | Record<string, any>, value?: any) => {
    const newCartons = [...cartons]
    if (typeof field === 'string') {
      // Single field update
      newCartons[index] = { ...newCartons[index], [field]: value }
    } else {
      // Multiple fields update
      newCartons[index] = { ...newCartons[index], ...field }
    }
    setCartons(newCartons)
  }

  const addContent = (cartonIndex: number) => {
    const newCartons = [...cartons]
    newCartons[cartonIndex].contents.push({ description: '', quantity: 1 })
    setCartons(newCartons)
  }

  const removeContent = (cartonIndex: number, contentIndex: number) => {
    const newCartons = [...cartons]
    const contents = newCartons[cartonIndex].contents.filter((_, i) => i !== contentIndex)
    newCartons[cartonIndex].contents = contents.length > 0 ? contents : [{ description: '', quantity: 1 }]
    setCartons(newCartons)
  }

  const updateContent = (
    cartonIndex: number,
    contentIndex: number,
    field: 'description' | 'quantity',
    value: any
  ) => {
    const newCartons = [...cartons]
    newCartons[cartonIndex].contents[contentIndex] = {
      ...newCartons[cartonIndex].contents[contentIndex],
      [field]: value,
    }
    setCartons(newCartons)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Progress Indicator */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
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
        <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg shadow-sm">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-800 font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="p-6">
        {currentStep === 1 && (
          <Step1CartonConfiguration
            cartons={cartons}
            addCarton={addCarton}
            removeCarton={removeCarton}
            updateCarton={updateCarton}
            addContent={addContent}
            removeContent={removeContent}
            updateContent={updateContent}
            carriers={carriers}
            selectedCarrierId={selectedCarrierId}
            setSelectedCarrierId={setSelectedCarrierId}
            carrierPackages={carrierPackages[selectedCarrierId] || []}
          />
        )}

        {currentStep === 2 && (
          <Step2AddressValidation
            fromAddress={fromAddress}
            setFromAddress={setFromAddress}
            toAddress={toAddress}
            setToAddress={setToAddress}
            validationResult={validationResult}
            hasValidated={hasValidated}
            isFromAddressExpanded={isFromAddressExpanded}
            setIsFromAddressExpanded={setIsFromAddressExpanded}
            addressCorrections={addressCorrections}
          />
        )}

        {currentStep === 3 && (
          <Step3RateSelection
            rates={rates}
            selectedRate={selectedRate}
            setSelectedRate={setSelectedRate}
            isLoading={isLoading}
          />
        )}

        {currentStep === 4 && (
          <Step4Options
            shipDate={shipDate}
            setShipDate={setShipDate}
            isReturnLabel={isReturnLabel}
            setIsReturnLabel={setIsReturnLabel}
            rmaNumber={rmaNumber}
            setRmaNumber={setRmaNumber}
            shipmentReference={shipmentReference}
            setShipmentReference={setShipmentReference}
            labelMessages={labelMessages}
            setLabelMessages={setLabelMessages}
            advancedOptions={advancedOptions}
            setAdvancedOptions={setAdvancedOptions}
            cartons={cartons}
          />
        )}

        {currentStep === 5 && labelData && (
          <Step5Success
            labelData={labelData}
            selectedRate={selectedRate}
            cartons={cartons}
            onComplete={handleComplete}
          />
        )}
      </div>

      {/* Footer Buttons */}
      {currentStep < 5 && (
        <div className="px-6 pb-6 flex justify-between border-t border-gray-200 pt-6">
          <button
            onClick={handleBack}
            disabled={currentStep === 1 || isLoading}
            className="px-6 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Processing...' : currentStep === 4 ? 'Create Labels' : 'Next'}
          </button>
        </div>
      )}
    </div>
  )
}

// Step 1: Carton Configuration Component
function Step1CartonConfiguration({
  cartons,
  addCarton,
  removeCarton,
  updateCarton,
  addContent,
  removeContent,
  updateContent,
  carriers,
  selectedCarrierId,
  setSelectedCarrierId,
  carrierPackages,
}: any) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Configure Cartons</h3>
            <p className="text-xs text-gray-700 mt-0.5">Add cartons with custom dimensions or select carrier packages.</p>
          </div>
        </div>
      </div>

      {/* Carrier Selection */}
      {carriers && carriers.length > 0 && (
        <div className="bg-white border-2 border-gray-200 rounded-lg p-3">
          <label className="block text-xs font-bold text-gray-900 mb-2">
            Carrier for Package Types
          </label>
          <select
            value={selectedCarrierId}
            onChange={(e) => setSelectedCarrierId(e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {carriers.map((carrier: Carrier) => (
              <option key={carrier.carrier_id} value={carrier.carrier_id}>
                {carrier.friendly_name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Select a carrier to use their predefined package types
          </p>
        </div>
      )}

      <div className="space-y-3">
        {cartons.map((carton: CartonConfig, cartonIndex: number) => (
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
                  Add Item
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
              {carton.contents.map((content: any, contentIndex: number) => (
                <div
                  key={contentIndex}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50"
                >
                  {/* Description Input */}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={content.description}
                      onChange={(e) =>
                        updateContent(cartonIndex, contentIndex, 'description', e.target.value)
                      }
                      placeholder="Item description..."
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                    />
                  </div>

                  {/* Quantity Input */}
                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      value={content.quantity}
                      onChange={(e) =>
                        updateContent(
                          cartonIndex,
                          contentIndex,
                          'quantity',
                          parseInt(e.target.value) || 1
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
              {/* Package Type Toggle */}
              <div className="mb-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`useCarrierPackage-${cartonIndex}`}
                  checked={carton.useCarrierPackage}
                  onChange={(e) => updateCarton(cartonIndex, 'useCarrierPackage', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor={`useCarrierPackage-${cartonIndex}`} className="text-xs font-medium text-gray-700">
                  Use Carrier Package Type
                </label>
              </div>

              {carton.useCarrierPackage ? (
                /* Carrier Package Selection */
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Package Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={carton.carrierPackageCode || ''}
                      onChange={(e) => {
                        const selectedPackage = carrierPackages.find((pkg: CarrierPackage) => pkg.package_code === e.target.value)
                        updateCarton(cartonIndex, {
                          carrierPackageCode: e.target.value,
                          carrierPackageName: selectedPackage?.name || ''
                        })
                      }}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!carrierPackages || carrierPackages.length === 0}
                    >
                      <option value="">
                        {!carrierPackages || carrierPackages.length === 0
                          ? 'Loading packages...'
                          : 'Select a package type...'}
                      </option>
                      {carrierPackages && carrierPackages.map((pkg: CarrierPackage) => (
                        <option key={pkg.package_code} value={pkg.package_code}>
                          {pkg.name}
                        </option>
                      ))}
                    </select>
                    {carton.carrierPackageCode && (
                      <div className="mt-1">
                        <p className="text-xs font-medium text-blue-600">
                          Selected: {carton.carrierPackageName || carton.carrierPackageCode}
                        </p>
                        <p className="text-xs text-gray-500">
                          {carrierPackages?.find((pkg: CarrierPackage) => pkg.package_code === carton.carrierPackageCode)?.description}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
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
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Custom Dimensions */
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
                    />
                  </div>
                </div>
              )}
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
  )
}

// Step 2: Address Validation Component (Simplified inline version)
function Step2AddressValidation({
  fromAddress,
  setFromAddress,
  toAddress,
  setToAddress,
  validationResult,
  hasValidated,
  isFromAddressExpanded,
  setIsFromAddressExpanded,
  addressCorrections,
}: any) {
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
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={fromAddress.email}
                  onChange={(e) => setFromAddress({ ...fromAddress, email: e.target.value })}
                  className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* To Address */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 p-4 rounded-lg shadow-sm">
        <h4 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          To Address <span className="text-red-500">*</span>
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={toAddress.name}
              onChange={(e) => setToAddress({ ...toAddress, name: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
            <input
              type="text"
              value={toAddress.company}
              onChange={(e) => setToAddress({ ...toAddress, company: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Street 1 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={toAddress.street1}
              onChange={(e) => setToAddress({ ...toAddress, street1: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Street 2</label>
            <input
              type="text"
              value={toAddress.street2}
              onChange={(e) => setToAddress({ ...toAddress, street2: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={toAddress.city}
              onChange={(e) => setToAddress({ ...toAddress, city: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                onChange={(e) => setToAddress({ ...toAddress, state: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                maxLength={2}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                ZIP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={toAddress.zip}
                onChange={(e) => setToAddress({ ...toAddress, zip: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={toAddress.phone}
              onChange={(e) => setToAddress({ ...toAddress, phone: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={toAddress.email}
              onChange={(e) => setToAddress({ ...toAddress, email: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Validation Status */}
        {hasValidated && validationResult && (
          <div className={`mt-3 p-3 rounded-lg text-xs ${
            validationResult.status === 'verified'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
          }`}>
            {validationResult.status === 'verified' ? (
              <div>
                <span className="flex items-center gap-1 font-semibold mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Address validated successfully
                </span>
                {addressCorrections && Object.keys(addressCorrections).length > 0 && (
                  <div className="mt-2 pl-5 space-y-1 bg-white bg-opacity-50 rounded p-2">
                    <p className="font-semibold text-green-900">Auto-corrected fields:</p>
                    {addressCorrections.city && (
                      <div className="flex items-center gap-2">
                        <span className="text-green-700">City:</span>
                        <span className="line-through text-gray-600">{addressCorrections.city.from}</span>
                        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <span className="font-semibold text-green-900">{addressCorrections.city.to}</span>
                      </div>
                    )}
                    {addressCorrections.state && (
                      <div className="flex items-center gap-2">
                        <span className="text-green-700">State:</span>
                        <span className="line-through text-gray-600">{addressCorrections.state.from}</span>
                        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <span className="font-semibold text-green-900">{addressCorrections.state.to}</span>
                      </div>
                    )}
                    {addressCorrections.zip && (
                      <div className="flex items-center gap-2">
                        <span className="text-green-700">ZIP:</span>
                        <span className="line-through text-gray-600">{addressCorrections.zip.from}</span>
                        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <span className="font-semibold text-green-900">{addressCorrections.zip.to}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <span>Address validation pending...</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Step 3: Rate Selection Component
function Step3RateSelection({
  rates,
  selectedRate,
  setSelectedRate,
  isLoading,
}: any) {
  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading rates...</div>
  }

  if (rates.length === 0) {
    return <div className="text-center py-8 text-gray-500">No rates available</div>
  }

  // Group rates by carrier
  const ratesByCarrier = rates.reduce((acc: any, rate: Rate) => {
    if (!acc[rate.carrier]) {
      acc[rate.carrier] = []
    }
    acc[rate.carrier].push(rate)
    return acc
  }, {})

  const carriers = Object.keys(ratesByCarrier)

  return (
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

      <div className={`grid gap-4 ${carriers.length === 1 ? 'grid-cols-1' : carriers.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {carriers.map((carrier) => (
          <div key={carrier} className="space-y-2">
            <h4 className="font-bold text-gray-900 text-sm px-2 py-1 bg-gray-100 rounded sticky top-0">{carrier}</h4>
            {ratesByCarrier[carrier].map((rate: Rate) => {
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
                          const badgeStyles: any = {
                            best_value: 'bg-green-100 text-green-700',
                            cheapest: 'bg-blue-100 text-blue-700',
                            fastest: 'bg-purple-100 text-purple-700',
                          }
                          const labels: any = {
                            best_value: '⭐ Best',
                            cheapest: '💰 Cheapest',
                            fastest: '⚡ Fastest',
                          }
                          return (
                            <span
                              key={attr}
                              className={`text-xs px-1.5 py-0.5 rounded font-medium ${badgeStyles[attr] || 'bg-gray-100 text-gray-700'}`}
                            >
                              {labels[attr] || attr}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>

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
                          {otherDetails.map((detail: any, idx: number) => (
                            <div key={idx} className="flex justify-between">
                              <span className="text-amber-700 truncate">{detail.description}</span>
                              <span className="text-amber-800 ml-2">+${detail.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}

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
    </div>
  )
}

// Step 4: Options Component
function Step4Options({
  shipDate,
  setShipDate,
  isReturnLabel,
  setIsReturnLabel,
  rmaNumber,
  setRmaNumber,
  shipmentReference,
  setShipmentReference,
  labelMessages,
  setLabelMessages,
  advancedOptions: _advancedOptions,
  setAdvancedOptions: _setAdvancedOptions,
  cartons,
}: any) {
  const totalPackages = cartons.reduce((sum: number, c: CartonConfig) => sum + c.count, 0)
  const isMultiPackage = totalPackages > 1

  return (
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

      {/* Shipment Reference (Optional) */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-sm">
        <label className="block text-sm font-bold text-gray-900 mb-2">
          PACE Shipment ID <span className="text-gray-500 text-xs font-normal">(Optional)</span>
        </label>
        <input
          type="text"
          value={shipmentReference}
          onChange={(e) => setShipmentReference(e.target.value)}
          placeholder="e.g., 58926 (numeric ID only)"
          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
        />
        <p className="text-xs text-gray-600 mt-1">
          Optional PACE Shipment ID (numeric) to link this label. Leave empty for a standalone manual label.
        </p>
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
            Create Return Label
            {isMultiPackage && <span className="ml-2 text-xs font-normal">(Not available for multi-package shipments)</span>}
          </label>
        </div>

        {isMultiPackage && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            <strong>Note:</strong> Return labels cannot be created for shipments with multiple packages ({totalPackages} packages).
          </div>
        )}

        {isReturnLabel && (
          <div className="space-y-3 mt-3 pt-3 border-t border-gray-200">
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Step 5: Success Component
function Step5Success({ labelData, selectedRate, cartons, onComplete }: any) {
  const totalPackages = cartons.reduce((sum: number, c: CartonConfig) => sum + c.count, 0)

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-lg font-bold text-green-900">Labels Created Successfully!</h3>
            <p className="text-sm text-green-700 mt-1">
              Your shipping labels have been created and saved to the database.
            </p>
          </div>
        </div>
      </div>

      {/* Outbound Label */}
      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Outbound Label
        </h4>
        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
          <div>
            <span className="text-gray-600">Tracking:</span>
            <p className="font-mono font-semibold">{labelData.outbound.trackingNumber}</p>
          </div>
          <div>
            <span className="text-gray-600">Carrier:</span>
            <p className="font-semibold">{selectedRate?.carrier} - {selectedRate?.service}</p>
          </div>
          <div>
            <span className="text-gray-600">Packages:</span>
            <p className="font-semibold">{totalPackages}</p>
          </div>
          <div>
            <span className="text-gray-600">Total Cost:</span>
            <p className="font-semibold">${labelData.outbound.totalCost.toFixed(2)} {labelData.outbound.currency}</p>
          </div>
        </div>
        <a
          href={labelData.outbound.labelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Outbound Label (PDF)
        </a>
      </div>

      {/* Return Label */}
      {labelData.return && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
          <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Return Label
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
            <div>
              <span className="text-gray-600">Tracking:</span>
              <p className="font-mono font-semibold">{labelData.return.trackingNumber}</p>
            </div>
            <div>
              <span className="text-gray-600">Total Cost:</span>
              <p className="font-semibold">${labelData.return.totalCost.toFixed(2)} {labelData.return.currency}</p>
            </div>
            {labelData.return.rmaNumber && (
              <div className="col-span-2">
                <span className="text-gray-600">RMA Number:</span>
                <p className="font-semibold">{labelData.return.rmaNumber}</p>
              </div>
            )}
          </div>
          <a
            href={labelData.return.labelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Return Label (PDF)
          </a>
        </div>
      )}

      {/* Complete Button */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={onComplete}
          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors"
        >
          Create Another Label
        </button>
      </div>
    </div>
  )
}

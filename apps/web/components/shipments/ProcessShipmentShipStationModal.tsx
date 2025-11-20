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
  useCarrierPackage: boolean
  carrierPackageCode?: string
  carrierPackageName?: string
  carrierCode?: string // Track which carrier this package belongs to
}

interface CarrierPackage {
  package_id: string | null
  package_code: string
  name: string
  description: string
  carrier_code: string
  carrier_name: string
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
  rateAttributes?: string[] // best_value, cheapest, fastest
  warningMessages?: string[]
  hasProcessingCost?: boolean
  processingCost?: number
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
      useCarrierPackage: false,
    },
  ])

  // Carriers and packages state
  const [_carriers, setCarriers] = useState<Carrier[]>([])
  const [allCarrierPackages, setAllCarrierPackages] = useState<CarrierPackage[]>([])
  const [_loadingPackages, setLoadingPackages] = useState(false)

  // Job items for content selection
  const [jobItems, setJobItems] = useState<{
    components: Array<{ id: number; description: string; itemNumber?: string; qtyOrdered?: number; po?: string }>
    products: Array<{ id: number; description: string; productID?: string }>
    parts: Array<{ id: string; description: string; partName?: string }>
    materials: Array<{ id: number; description: string; materialID?: string; jobPart?: string; qtyRequired?: number; plannedQuantity?: number }>
  } | null>(null)
  const [loadingItems, setLoadingItems] = useState(false)

  // Shipment type tracking for conditional rendering
  const [shipmentTypeDescription, setShipmentTypeDescription] = useState<string | null>(null)
  const [showOtherItemTypes, setShowOtherItemTypes] = useState(false)

  // Step 2 data - Address validation
  const [validationResult, setValidationResult] = useState<any>(null)
  const [hasValidated, setHasValidated] = useState(false)
  const [overrideValidation, setOverrideValidation] = useState(false)

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
  // Get current date in Pacific Time to avoid timezone issues
  const getPacificDate = () => {
    const now = new Date()
    const pacificDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
    return pacificDate.toISOString().split('T')[0]
  }
  const [shipDate, setShipDate] = useState<string>(getPacificDate())
  const [isReturnLabel, setIsReturnLabel] = useState(false)
  const [returnServiceCode, setReturnServiceCode] = useState<string>('')
  const [rmaNumber, setRmaNumber] = useState('')
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

  // Multi-select dropdown state
  const [isMultiSelectOpen, setIsMultiSelectOpen] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // Set default reference 1 when modal opens: Job# - CL{ShipmentID}
  useEffect(() => {
    if (isOpen && shipment?.job && shipment?.id) {
      setLabelMessages(prev => ({
        ...prev,
        reference1: `${shipment.job} - CL${shipment.id}`
      }))
    }
  }, [isOpen, shipment?.job, shipment?.id])

  // Auto-populate billing options from shipment data when modal opens
  useEffect(() => {
    if (isOpen && shipment) {
      // Check if shipping charges is set to third party or ship bill to
      // The field is 'charges' in PACE JobShipment
      const shippingCharges = shipment.charges?.toLowerCase()
      const isThirdPartyBilling = shippingCharges === 'third party/ship bill to' ||
                                  shippingCharges === 'third party' ||
                                  shippingCharges === 'ship bill to'

      console.log('Checking billing options:', {
        charges: shipment.charges,
        isThirdPartyBilling,
        accountNumber: shipment.accountNumber,
        shipBillToContact: shipment.shipBillToContact,
        shipBillToContactType: typeof shipment.shipBillToContact,
        shipBillToContactKeys: shipment.shipBillToContact ? Object.keys(shipment.shipBillToContact) : null,
      })

      if (isThirdPartyBilling) {
        const newOptions = {
          billToParty: 'third_party' as const,
          billToAccount: shipment.accountNumber || '',
          billToCountryCode: shipment.shipBillToContact?.countryCode || 'US',
          billToPostalCode: shipment.shipBillToContact?.zip || '',
        }
        console.log('🔍 [Auto-populate] Setting third party billing options:', newOptions)
        setAdvancedOptions(prev => ({
          ...prev,
          ...newOptions
        }))
      }
    }
  }, [isOpen, shipment])

  // Fetch shipment type description when modal opens
  useEffect(() => {
    if (isOpen && shipment?.shipmentType) {
      fetch(`/api/pace/lookup/ShipmentType/${shipment.shipmentType}`)
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            setShipmentTypeDescription(result.data.description)
          }
        })
        .catch(err => console.error('Error fetching ShipmentType:', err))
    }
  }, [isOpen, shipment?.shipmentType])

  // Debug log whenever advancedOptions changes
  useEffect(() => {
    console.log('🔍 [State Change] advancedOptions updated:', advancedOptions)
  }, [advancedOptions])

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

  // Countdown timer for auto-close
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number | null>(null)

  // Auto-open PDF when label is created and auto-close modal after 10 seconds
  useEffect(() => {
    if (labelData?.outbound?.labelUrl && currentStep === 5) {
      // Auto-open the outbound label PDF in a new tab
      window.open(labelData.outbound.labelUrl, '_blank', 'noopener,noreferrer')

      // Initialize countdown
      setAutoCloseCountdown(10)

      // Update countdown every second
      const countdownInterval = setInterval(() => {
        setAutoCloseCountdown((prev) => {
          if (prev === null || prev <= 1) {
            return null
          }
          return prev - 1
        })
      }, 1000)

      // Auto-close modal after 10 seconds
      const autoCloseTimer = setTimeout(() => {
        handleComplete()
      }, 10000) // 10 seconds

      // Cleanup timers if user manually closes or navigates away
      return () => {
        clearTimeout(autoCloseTimer)
        clearInterval(countdownInterval)
        setAutoCloseCountdown(null)
      }
    }
  }, [labelData, currentStep])

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

  // Load carriers and all their packages
  useEffect(() => {
    const loadCarriersAndPackages = async () => {
      if (!isOpen) return

      setLoadingPackages(true)
      try {
        // Load carriers
        const carriersResponse = await fetch('/api/shipstation/carriers')
        if (!carriersResponse.ok) {
          console.error('Failed to load carriers')
          return
        }
        const carriersData = await carriersResponse.json()
        const loadedCarriers: Carrier[] = carriersData.data.carriers || []
        setCarriers(loadedCarriers)

        // Load packages for all carriers
        const allPackages: CarrierPackage[] = []
        for (const carrier of loadedCarriers) {
          try {
            const packagesResponse = await fetch(`/api/shipstation/carriers/${carrier.carrier_id}/packages`)
            if (packagesResponse.ok) {
              const packagesData = await packagesResponse.json()
              const packages = (packagesData.data.packages || []).map((pkg: any) => ({
                ...pkg,
                carrier_code: carrier.carrier_code,
                carrier_name: carrier.friendly_name,
              }))
              allPackages.push(...packages)
            }
          } catch (err) {
            console.error(`Failed to load packages for ${carrier.friendly_name}:`, err)
          }
        }
        setAllCarrierPackages(allPackages)
        console.log('📦 Loaded carrier packages:', allPackages)
      } catch (error) {
        console.error('Failed to load carriers and packages:', error)
      } finally {
        setLoadingPackages(false)
      }
    }

    loadCarriersAndPackages()
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

      // Check if there are validation errors (allow override if user acknowledges)
      if ((validationResult.status === 'error' || validationResult.status === 'unverified') && !overrideValidation) {
        setError('Address validation failed. Please check the "Proceed Anyway" option below to override this warning, or correct the address.')
        return
      }

      setIsLoading(true)
      try {
        // Build packages array - expand each carton by its count
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

      // Validate return label service selection if return label is requested
      if (isReturnLabel && !returnServiceCode) {
        setError('Please select a service for the return label')
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

        // Build advanced options object (only include non-default values)
        console.log('🔍 [Label Creation] Building advancedOptionsPayload from:', advancedOptions)
        const advancedOptionsPayload: any = {}
        if (advancedOptions.billToAccount) {
          console.log('🔍 [Label Creation] Adding bill_to_account:', advancedOptions.billToAccount)
          advancedOptionsPayload.bill_to_account = advancedOptions.billToAccount
        }
        if (advancedOptions.billToParty && advancedOptions.billToParty !== 'sender') {
          console.log('🔍 [Label Creation] Adding bill_to_party:', advancedOptions.billToParty)
          advancedOptionsPayload.bill_to_party = advancedOptions.billToParty
        }
        if (advancedOptions.billToCountryCode && advancedOptions.billToParty === 'third_party') {
          console.log('🔍 [Label Creation] Adding bill_to_country_code:', advancedOptions.billToCountryCode)
          advancedOptionsPayload.bill_to_country_code = advancedOptions.billToCountryCode
        } else {
          console.log('🔍 [Label Creation] Skipping bill_to_country_code. billToCountryCode:', advancedOptions.billToCountryCode, 'billToParty:', advancedOptions.billToParty)
        }
        if (advancedOptions.billToPostalCode && advancedOptions.billToParty === 'third_party') {
          console.log('🔍 [Label Creation] Adding bill_to_postal_code:', advancedOptions.billToPostalCode)
          advancedOptionsPayload.bill_to_postal_code = advancedOptions.billToPostalCode
        } else {
          console.log('🔍 [Label Creation] Skipping bill_to_postal_code. billToPostalCode:', advancedOptions.billToPostalCode, 'billToParty:', advancedOptions.billToParty)
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

        console.log('🔍 [Label Creation] Final advancedOptionsPayload:', advancedOptionsPayload)

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
            advancedOptions: Object.keys(advancedOptionsPayload).length > 0 ? advancedOptionsPayload : undefined,
            confirmation: advancedOptions.confirmation !== 'none' ? advancedOptions.confirmation : undefined,
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
                serviceCode: returnServiceCode, // Use the selected return service code
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
              // Only add processing cost if sender pays (not third party)
              const processingCost = advancedOptions.billToParty === 'third_party' ? 0 : (selectedRate.processingCost || 0)
              newLabelData.return = {
                trackingNumber: returnData.data.trackingNumber,
                labelUrl: returnData.data.labelUrl,
                shipmentId: returnData.data.shipmentId,
                labelId: returnData.data.labelId,
                totalCost: returnData.data.totalCost + processingCost,
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
            // Get the return service name from the rates
            const returnRate = rates.find(r =>
              r.carrierCode === selectedRate.carrierCode &&
              r.serviceCode === returnServiceCode
            )
            const returnServiceName = returnRate?.service || selectedRate.service

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
                service: returnServiceName, // Use the return service name
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

            // Only add processing cost if sender pays (not third party)
            const processingCostPerCarton = advancedOptions.billToParty === 'third_party' ? 0 : (selectedRate.processingCost || 0)

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
                  shippingCost: (createData.data.totalCost / packagesData.length) + processingCostPerCarton, // Distribute base cost, then add processing markup per carton (if sender pays)
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
                  // Include label references
                  reference1: labelMessages.reference1 || null,
                  reference2: labelMessages.reference2 || null,
                  reference3: labelMessages.reference3 || null,
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
          console.log('📤 Calling update-tracking API to set shipped=true and update shipmentType...')
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
            const errorData = await updateTrackingResponse.json().catch(() => null)
            console.error('❌ Failed to update shipment tracking aggregation:', errorData)
          } else {
            const trackingData = await updateTrackingResponse.json()
            console.log('✅ Updated shipment with aggregated tracking and address:', trackingData)
            if (trackingData.success && trackingData.data) {
              console.log('✅ Shipment marked as shipped with tracking:', trackingData.data.primaryTrackingNumber)
            }
          }
        } catch (error) {
          console.error('❌ Error updating shipment tracking:', error)
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

  // Helper function to check if shipment is a Storefront shipment
  const isStorefrontShipment = () => {
    return shipmentTypeDescription?.split('|').some(label => label.trim().toLowerCase() === 'storefront')
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
        useCarrierPackage: false,
      },
    ])
  }

  // Helper function to remove a carton configuration
  const removeCarton = (index: number) => {
    const newCartons = cartons.filter((_, i) => i !== index)
    setCartons(newCartons.length > 0 ? newCartons : [cartons[0]]) // Keep at least one
  }

  // Helper function to update a carton field
  const updateCarton = (index: number, field: keyof CartonConfig | Record<string, any>, value?: any) => {
    const newCartons = [...cartons]
    if (typeof field === 'string') {
      // Single field update
      newCartons[index] = { ...newCartons[index], [field]: value }
    } else {
      // Multiple fields update (when field is an object)
      newCartons[index] = { ...newCartons[index], ...field }
    }
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

  // Prepare items for dropdown with metadata - grouped by type
  const itemGroups: {
    job: Array<{ value: string; label: string; plannedQty?: number; orderedQty?: number }>
    components: Array<{ value: string; label: string; plannedQty?: number; orderedQty?: number }>
    products: Array<{ value: string; label: string; plannedQty?: number; orderedQty?: number }>
    parts: Array<{ value: string; label: string; plannedQty?: number; orderedQty?: number }>
    materials: Array<{ value: string; label: string; plannedQty?: number; orderedQty?: number }>
  } = {
    job: [],
    components: [],
    products: [],
    parts: [],
    materials: [],
  }

  if (jobItems) {
    // Add job itself as an option
    if (shipment?.job) {
      itemGroups.job.push({
        value: `job:${shipment.job}`,
        label: `Job ${shipment.job}`,
      })
    }
    // Add components
    jobItems.components.forEach((comp) => {
      // Build label: ItemNumber - Description | PO: XXX | Qty: YYY
      let label = comp.itemNumber || comp.description
      if (comp.itemNumber && comp.description) {
        label += ` - ${comp.description}`
      }
      if (comp.po) {
        label += ` | PO: ${comp.po}`
      }
      if (comp.qtyOrdered) {
        label += ` | Qty: ${comp.qtyOrdered}`
      }

      itemGroups.components.push({
        value: `component:${comp.id}`,
        label,
        orderedQty: comp.qtyOrdered,
      })
    })
    // Add products
    jobItems.products.forEach((prod) => {
      itemGroups.products.push({
        value: `product:${prod.id}`,
        label: `${prod.productID || prod.description}`,
      })
    })
    // Add parts
    jobItems.parts.forEach((part) => {
      itemGroups.parts.push({
        value: part.id, // Already in format "part:jobId:partNum"
        label: `${part.partName || part.description}`,
      })
    })
    // Add materials
    jobItems.materials?.forEach((material) => {
      const qtyDisplay = material.plannedQuantity
        ? `Planned: ${material.plannedQuantity}${material.qtyRequired ? ` / Required: ${material.qtyRequired}` : ''}`
        : material.qtyRequired
        ? `Required: ${material.qtyRequired}`
        : ''

      itemGroups.materials.push({
        value: `material:${material.id}`,
        label: `${material.materialID || material.description}${material.jobPart ? ` (Part ${material.jobPart})` : ''}${qtyDisplay ? ` - ${qtyDisplay}` : ''}`,
        plannedQty: material.plannedQuantity,
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
                      <p className="text-xs text-gray-700 mt-0.5">
                        Add cartons with dimensions, weight, and contents.
                        <span className="font-semibold text-blue-800"> Tip: </span>
                        Set item quantities per carton, then specify how many identical cartons to ship.
                      </p>
                    </div>
                  </div>
                </div>
                {loadingItems && <p className="text-xs text-gray-500">Loading job items...</p>}

                <div className="space-y-3">
                  {cartons.map((carton, cartonIndex) => (
                    <div key={cartonIndex} className="border-2 border-gray-200 rounded-lg bg-white shadow-sm">
                      {/* Carton Header - Side by Side Layout */}
                      <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Left Side - Carton Info */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-sm font-bold text-gray-900">Carton {cartonIndex + 1}</h4>
                                <button
                                  type="button"
                                  onClick={() => addContent(cartonIndex)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 hover:border-green-300 transition-colors"
                                  title="Add another item to this carton"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add Item
                                </button>

                                {/* Multi-select dropdown */}
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setIsMultiSelectOpen(!isMultiSelectOpen)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 hover:border-blue-300 transition-colors"
                                  >
                                    + Add Multiple
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>

                                  {isMultiSelectOpen && (
                                    <>
                                      {/* Backdrop */}
                                      <div
                                        className="fixed inset-0 bg-black bg-opacity-25 z-[90]"
                                        onClick={() => {
                                          setIsMultiSelectOpen(false)
                                          setSelectedItems(new Set())
                                        }}
                                      />
                                      {/* Dropdown - Fixed position centered */}
                                      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] bg-white border border-gray-300 rounded-lg shadow-xl z-[100] max-h-[85vh] overflow-hidden">
                                      {/* Header with Add Selected button */}
                                      <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-gray-700">
                                          {selectedItems.size} selected
                                        </span>
                                        <div className="flex gap-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (selectedItems.size > 0) {
                                                const newCartons = [...cartons]
                                                const allItemsFlat = [
                                                  ...itemGroups.job,
                                                  ...itemGroups.components,
                                                  ...itemGroups.products,
                                                  ...itemGroups.parts,
                                                  ...itemGroups.materials,
                                                ]

                                                newCartons[cartonIndex].contents = Array.from(selectedItems).map(itemValue => {
                                                  const item = allItemsFlat.find(i => i.value === itemValue)
                                                  return {
                                                    itemId: itemValue,
                                                    quantity: item?.plannedQty || item?.orderedQty || 0,
                                                  }
                                                })
                                                setCartons(newCartons)
                                                setSelectedItems(new Set())
                                                setIsMultiSelectOpen(false)
                                              }
                                            }}
                                            disabled={selectedItems.size === 0}
                                            className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                          >
                                            Add Selected
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedItems(new Set())
                                              setIsMultiSelectOpen(false)
                                            }}
                                            className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>

                                      {/* Items grouped by type */}
                                      <div className="py-1 overflow-y-auto max-h-[calc(85vh-4rem)]">
                                        {isStorefrontShipment() && (
                                          <div className="px-3 py-2 bg-blue-50 border-b border-blue-200">
                                            <button
                                              type="button"
                                              onClick={() => setShowOtherItemTypes(!showOtherItemTypes)}
                                              className="text-xs text-blue-700 hover:text-blue-900 font-medium flex items-center gap-1"
                                            >
                                              {showOtherItemTypes ? (
                                                <>
                                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                  </svg>
                                                  Hide Job/Products/Parts
                                                </>
                                              ) : (
                                                <>
                                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                  </svg>
                                                  Show Job/Products/Parts
                                                </>
                                              )}
                                            </button>
                                          </div>
                                        )}
                                        {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.job.length > 0 && (
                                          <div>
                                            <div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50 flex items-center justify-between">
                                              <span>JOB</span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newSelected = new Set(selectedItems)
                                                  itemGroups.job.forEach(item => newSelected.add(item.value))
                                                  setSelectedItems(newSelected)
                                                }}
                                                className="text-blue-600 hover:text-blue-800 text-xs"
                                              >
                                                Select All
                                              </button>
                                            </div>
                                            {itemGroups.job.map((item) => (
                                              <label key={item.value} className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={selectedItems.has(item.value)}
                                                  onChange={(e) => {
                                                    const newSelected = new Set(selectedItems)
                                                    if (e.target.checked) {
                                                      newSelected.add(item.value)
                                                    } else {
                                                      newSelected.delete(item.value)
                                                    }
                                                    setSelectedItems(newSelected)
                                                  }}
                                                  className="mr-2"
                                                />
                                                <span className="text-xs">{item.label}</span>
                                              </label>
                                            ))}
                                          </div>
                                        )}

                                        {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.components.length > 0 && (
                                          <div>
                                            <div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50 flex items-center justify-between">
                                              <span>COMPONENTS</span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newSelected = new Set(selectedItems)
                                                  itemGroups.components.forEach(item => newSelected.add(item.value))
                                                  setSelectedItems(newSelected)
                                                }}
                                                className="text-blue-600 hover:text-blue-800 text-xs"
                                              >
                                                Select All
                                              </button>
                                            </div>
                                            {itemGroups.components.map((item) => (
                                              <label key={item.value} className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={selectedItems.has(item.value)}
                                                  onChange={(e) => {
                                                    const newSelected = new Set(selectedItems)
                                                    if (e.target.checked) {
                                                      newSelected.add(item.value)
                                                    } else {
                                                      newSelected.delete(item.value)
                                                    }
                                                    setSelectedItems(newSelected)
                                                  }}
                                                  className="mr-2"
                                                />
                                                <span className="text-xs">{item.label}</span>
                                              </label>
                                            ))}
                                          </div>
                                        )}

                                        {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.products.length > 0 && (
                                          <div>
                                            <div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50 flex items-center justify-between">
                                              <span>PRODUCTS</span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newSelected = new Set(selectedItems)
                                                  itemGroups.products.forEach(item => newSelected.add(item.value))
                                                  setSelectedItems(newSelected)
                                                }}
                                                className="text-blue-600 hover:text-blue-800 text-xs"
                                              >
                                                Select All
                                              </button>
                                            </div>
                                            {itemGroups.products.map((item) => (
                                              <label key={item.value} className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={selectedItems.has(item.value)}
                                                  onChange={(e) => {
                                                    const newSelected = new Set(selectedItems)
                                                    if (e.target.checked) {
                                                      newSelected.add(item.value)
                                                    } else {
                                                      newSelected.delete(item.value)
                                                    }
                                                    setSelectedItems(newSelected)
                                                  }}
                                                  className="mr-2"
                                                />
                                                <span className="text-xs">{item.label}</span>
                                              </label>
                                            ))}
                                          </div>
                                        )}

                                        {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.parts.length > 0 && (
                                          <div>
                                            <div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50 flex items-center justify-between">
                                              <span>PARTS</span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newSelected = new Set(selectedItems)
                                                  itemGroups.parts.forEach(item => newSelected.add(item.value))
                                                  setSelectedItems(newSelected)
                                                }}
                                                className="text-blue-600 hover:text-blue-800 text-xs"
                                              >
                                                Select All
                                              </button>
                                            </div>
                                            {itemGroups.parts.map((item) => (
                                              <label key={item.value} className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={selectedItems.has(item.value)}
                                                  onChange={(e) => {
                                                    const newSelected = new Set(selectedItems)
                                                    if (e.target.checked) {
                                                      newSelected.add(item.value)
                                                    } else {
                                                      newSelected.delete(item.value)
                                                    }
                                                    setSelectedItems(newSelected)
                                                  }}
                                                  className="mr-2"
                                                />
                                                <span className="text-xs">{item.label}</span>
                                              </label>
                                            ))}
                                          </div>
                                        )}

                                        {itemGroups.materials.length > 0 && (
                                          <div>
                                            <div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50 flex items-center justify-between">
                                              <span>MATERIALS</span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newSelected = new Set(selectedItems)
                                                  itemGroups.materials.forEach(item => newSelected.add(item.value))
                                                  setSelectedItems(newSelected)
                                                }}
                                                className="text-blue-600 hover:text-blue-800 text-xs"
                                              >
                                                Select All
                                              </button>
                                            </div>
                                            {itemGroups.materials.map((item) => (
                                              <label key={item.value} className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={selectedItems.has(item.value)}
                                                  onChange={(e) => {
                                                    const newSelected = new Set(selectedItems)
                                                    if (e.target.checked) {
                                                      newSelected.add(item.value)
                                                    } else {
                                                      newSelected.delete(item.value)
                                                    }
                                                    setSelectedItems(newSelected)
                                                  }}
                                                  className="mr-2"
                                                />
                                                <span className="text-xs">{item.label}</span>
                                              </label>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    </>
                                  )}
                                </div>

                                {/* Toggle button for Storefront shipments */}
                                {isStorefrontShipment() && (
                                  <button
                                    type="button"
                                    onClick={() => setShowOtherItemTypes(!showOtherItemTypes)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 transition-colors"
                                    title={showOtherItemTypes ? "Hide Job/Products/Parts options" : "Show Job/Products/Parts options"}
                                  >
                                    {showOtherItemTypes ? (
                                      <>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                        Hide Other
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        Show Other
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                              {cartons.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeCarton(cartonIndex)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 hover:border-red-300 transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Remove
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                                # of Similar Cartons:
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={carton.count}
                                onChange={(e) =>
                                  updateCarton(cartonIndex, 'count', parseInt(e.target.value) || 1)
                                }
                                className="w-16 px-2 py-1 border-2 border-gray-300 rounded text-sm font-bold text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="1"
                                title="How many identical cartons with these same dimensions and contents?"
                                required
                              />
                            </div>
                          </div>

                          {/* Right Side - Package Dimensions */}
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <input
                                type="checkbox"
                                id={`useCarrierPackage-${cartonIndex}`}
                                checked={carton.useCarrierPackage}
                                onChange={(e) => updateCarton(cartonIndex, 'useCarrierPackage', e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <label htmlFor={`useCarrierPackage-${cartonIndex}`} className="text-xs font-medium text-gray-700">
                                Use Carrier Package Type <span className="text-gray-500">(FedEx Box, USPS Flat Rate, etc.)</span>
                              </label>
                            </div>

                            {carton.useCarrierPackage ? (
                              /* Carrier Package - Single Line */
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <select
                                    value={carton.carrierPackageCode || ''}
                                    onChange={(e) => {
                                      const selectedPackage = allCarrierPackages.find(pkg => pkg.package_code === e.target.value)
                                      updateCarton(cartonIndex, {
                                        carrierPackageCode: e.target.value,
                                        carrierPackageName: selectedPackage?.name || '',
                                        carrierCode: selectedPackage?.carrier_code || ''
                                      } as any)
                                    }}
                                    className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    disabled={allCarrierPackages.length === 0}
                                  >
                                    <option value="">
                                      {allCarrierPackages.length === 0 ? 'No packages' : 'Select...'}
                                    </option>
                                    {Object.entries(
                                      allCarrierPackages.reduce((acc, pkg) => {
                                        if (!acc[pkg.carrier_name]) acc[pkg.carrier_name] = []
                                        acc[pkg.carrier_name].push(pkg)
                                        return acc
                                      }, {} as Record<string, CarrierPackage[]>)
                                    ).map(([carrierName, packages]) => (
                                      <optgroup key={carrierName} label={carrierName}>
                                        {packages.map((pkg) => (
                                          <option key={pkg.package_code} value={pkg.package_code}>
                                            {pkg.name}
                                          </option>
                                        ))}
                                      </optgroup>
                                    ))}
                                  </select>
                                </div>
                                <div className="w-24">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={carton.weight}
                                    onChange={(e) => updateCarton(cartonIndex, 'weight', e.target.value)}
                                    className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Wt (lb)"
                                  />
                                </div>
                              </div>
                            ) : (
                              /* Custom Dimensions - Single Line */
                              <div className="grid grid-cols-4 gap-2">
                                <div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={carton.length}
                                    onChange={(e) => updateCarton(cartonIndex, 'length', e.target.value)}
                                    className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="L (in)"
                                    required
                                  />
                                </div>
                                <div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={carton.width}
                                    onChange={(e) => updateCarton(cartonIndex, 'width', e.target.value)}
                                    className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="W (in)"
                                    required
                                  />
                                </div>
                                <div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={carton.height}
                                    onChange={(e) => updateCarton(cartonIndex, 'height', e.target.value)}
                                    className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="H (in)"
                                    required
                                  />
                                </div>
                                <div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={carton.weight}
                                    onChange={(e) => updateCarton(cartonIndex, 'weight', e.target.value)}
                                    className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Wt (lb)"
                                    required
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                {/* Contents Table */}
                <div className="divide-y divide-gray-100">
                  {carton.contents.map((content, contentIndex) => (
                    <div
                      key={contentIndex}
                      className="flex items-center gap-1.5 px-3 py-1 hover:bg-gray-50"
                    >
                      {/* Item Selector */}
                      <div className="flex-1">
                        {loadingItems ? (
                          <div className="px-2 py-1 text-xs text-gray-500">Loading items...</div>
                        ) : (
                          <select
                            value={content.itemId || ''}
                            onChange={(e) => {
                              const selectedValue = e.target.value
                              updateContent(cartonIndex, contentIndex, 'itemId', selectedValue)

                              // Auto-populate quantity based on selected item
                              // Search across all groups (excluding certain groups for Storefront shipments unless expanded)
                              const allItemsFlat = [
                                ...((isStorefrontShipment() && !showOtherItemTypes) ? [] : itemGroups.job),
                                ...((isStorefrontShipment() && !showOtherItemTypes) ? [] : itemGroups.components),
                                ...((isStorefrontShipment() && !showOtherItemTypes) ? [] : itemGroups.products),
                                ...((isStorefrontShipment() && !showOtherItemTypes) ? [] : itemGroups.parts),
                                ...itemGroups.materials,
                              ]
                              const selectedItem = allItemsFlat.find(item => item.value === selectedValue)
                              if (selectedItem) {
                                const autoQty = selectedItem.plannedQty || selectedItem.orderedQty || 0
                                if (autoQty > 0) {
                                  updateContent(cartonIndex, contentIndex, 'quantity', autoQty)
                                }
                              }
                            }}
                            required
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select item to ship...</option>

                            {isStorefrontShipment() && !showOtherItemTypes && (
                              <option value="" disabled className="text-blue-600">
                                ⓘ Click "Show Job/Products/Parts" above for more options
                              </option>
                            )}

                            {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.job.length > 0 && (
                              <optgroup label="━━━ JOB ━━━">
                                {itemGroups.job.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.components.length > 0 && (
                              <optgroup label="━━━ COMPONENTS ━━━">
                                {itemGroups.components.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.products.length > 0 && (
                              <optgroup label="━━━ PRODUCTS ━━━">
                                {itemGroups.products.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.parts.length > 0 && (
                              <optgroup label="━━━ PARTS ━━━">
                                {itemGroups.parts.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {itemGroups.materials.length > 0 && (
                              <optgroup label="━━━ MATERIALS ━━━">
                                {itemGroups.materials.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        )}
                      </div>

                      {/* Quantity Input */}
                      <div className="flex items-center gap-1">
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
                          title="Quantity of this item in ONE carton"
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span className="text-xs text-gray-500 whitespace-nowrap">per carton</span>
                      </div>

                      {/* Delete Button */}
                      {carton.contents.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeContent(cartonIndex, contentIndex)}
                          className="inline-flex items-center justify-center w-6 h-6 text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 hover:border-red-300 transition-colors"
                          title="Remove item"
                        >
                          <svg
                            className="w-3.5 h-3.5"
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
                overrideValidation={overrideValidation}
                setOverrideValidation={setOverrideValidation}
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
                      <p className="text-xs text-gray-700 mt-0.5">Compare rates across carriers. Badges show recommended options. Click "Details" to see cost breakdown.</p>
                    </div>
                  </div>
                </div>
                {rates.length === 0 ? (
                  <p className="text-gray-500 text-sm">No rates available</p>
                ) : (
                  (() => {
                    // Check if any carton uses a carrier package
                    const cartonsWithCarrierPackages = cartons.filter(c => c.useCarrierPackage && c.carrierCode)
                    const selectedCarrierCodes = [...new Set(cartonsWithCarrierPackages.map(c => c.carrierCode))]

                    // Filter rates if carrier packages are selected
                    let filteredRates = rates
                    if (selectedCarrierCodes.length > 0) {
                      console.log('📦 Filtering rates for carrier codes:', selectedCarrierCodes)
                      filteredRates = rates.filter(rate => selectedCarrierCodes.includes(rate.carrierCode))
                      console.log('📦 Filtered rates:', filteredRates.length, 'of', rates.length)
                    }

                    // Group rates by carrier
                    const ratesByCarrier = filteredRates.reduce((acc, rate) => {
                      if (!acc[rate.carrier]) {
                        acc[rate.carrier] = []
                      }
                      acc[rate.carrier].push(rate)
                      return acc
                    }, {} as Record<string, typeof rates>)

                    const carriers = Object.keys(ratesByCarrier)

                    // Show message if rates were filtered
                    const showFilterMessage = selectedCarrierCodes.length > 0 && filteredRates.length < rates.length

                    return (
                      <>
                        {showFilterMessage && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                            <div className="flex items-start gap-2">
                              <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div className="text-xs">
                                <p className="font-semibold text-blue-900">
                                  Rates filtered by selected carrier package
                                </p>
                                <p className="text-blue-700 mt-0.5">
                                  Showing {filteredRates.length} of {rates.length} rates for {selectedCarrierCodes.map(code => {
                                    const carrier = allCarrierPackages.find(p => p.carrier_code === code)
                                    return carrier?.carrier_name
                                  }).filter(Boolean).join(', ')}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className={`grid gap-4 ${carriers.length === 1 ? 'grid-cols-1' : carriers.length === 2 ? 'grid-cols-2' : carriers.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
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
                                  {(hasDetails || rate.hasProcessingCost) && (
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
                                          {rate.hasProcessingCost && rate.processingCost && (
                                            <div className="flex justify-between">
                                              <span className="text-blue-700 truncate">Processing Cost</span>
                                              <span className="text-blue-800 ml-2">+${rate.processingCost.toFixed(2)}</span>
                                            </div>
                                          )}
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
                      </>
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
                            onChange={(e) => {
                              setIsReturnLabel(e.target.checked)
                              // Auto-populate return service with outbound service when checkbox is enabled
                              if (e.target.checked && selectedRate && !returnServiceCode) {
                                setReturnServiceCode(selectedRate.serviceCode)
                              }
                            }}
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
                          Return Label Service <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={returnServiceCode}
                          onChange={(e) => setReturnServiceCode(e.target.value)}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select a service for the return label</option>
                          {(() => {
                            console.log('🔍 [Return Service Dropdown] selectedRate:', selectedRate)
                            console.log('🔍 [Return Service Dropdown] rates array length:', rates.length)
                            console.log('🔍 [Return Service Dropdown] rates array:', rates)

                            if (!selectedRate) {
                              console.log('🔍 [Return Service Dropdown] No selectedRate, returning null')
                              return null
                            }

                            console.log('🔍 [Return Service Dropdown] Filtering rates by carrierCode:', selectedRate.carrierCode)

                            // Get all available services for the selected carrier from the rates
                            const carrierServices = rates
                              .filter(rate => {
                                const matches = rate.carrierCode === selectedRate.carrierCode
                                console.log('🔍 [Return Service Dropdown] Rate carrier:', rate.carrierCode, 'matches:', matches, 'service:', rate.service)
                                return matches
                              })
                              .map(rate => ({
                                serviceCode: rate.serviceCode,
                                serviceName: rate.service,
                              }))
                              // Remove duplicates based on serviceCode
                              .filter((service, index, self) =>
                                index === self.findIndex(s => s.serviceCode === service.serviceCode)
                              )
                              // Sort alphabetically by service name
                              .sort((a, b) => a.serviceName.localeCompare(b.serviceName))

                            console.log('🔍 [Return Service Dropdown] carrierServices:', carrierServices)

                            if (carrierServices.length === 0) {
                              console.log('🔍 [Return Service Dropdown] No carrier services found!')
                              return <option disabled>No services available</option>
                            }

                            return carrierServices.map(service => (
                              <option key={service.serviceCode} value={service.serviceCode}>
                                {service.serviceName}
                                {service.serviceCode === selectedRate.serviceCode && ' (Same as outbound)'}
                              </option>
                            ))
                          })()}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Choose the shipping service for the return label. This can be different from the outbound service.
                        </p>
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

                {/* Third Party Billing - Show prominently when selected */}
                {advancedOptions.billToParty === 'third_party' && (
                  <div className="bg-white border-2 border-blue-300 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <h4 className="text-sm font-bold text-gray-900">Third Party Billing Information</h4>
                    </div>

                    {(() => {
                      const shippingCharges = shipment?.charges?.toLowerCase()
                      const isThirdPartyBilling = shippingCharges === 'third party/ship bill to' ||
                                                  shippingCharges === 'third party' ||
                                                  shippingCharges === 'ship bill to'

                      return isThirdPartyBilling && (
                        <div className="bg-green-50 border border-green-200 rounded p-2 text-xs text-green-800 mb-3">
                          <strong>✓ Auto-populated:</strong> Billing set to Third Party from shipment settings (Shipping Charges: {shipment?.charges})
                        </div>
                      )
                    })()}

                    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800 mb-4">
                      <strong>Note:</strong> Third party billing selected. The shipping costs will be billed to the account specified below.
                      {' '}Change billing option in <strong>Advanced Options</strong> if needed.
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Bill To Account <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={advancedOptions.billToAccount}
                          onChange={(e) => {
                            console.log('🔍 [Bill To Account] Changed to:', e.target.value)
                            setAdvancedOptions({ ...advancedOptions, billToAccount: e.target.value })
                          }}
                          placeholder={shipment?.accountNumber || "Account number"}
                          className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-0.5">
                          {shipment?.accountNumber ? `From shipment: ${shipment.accountNumber}` : 'Third party account number (from shipment.accountNumber)'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Country Code <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={advancedOptions.billToCountryCode}
                            onChange={(e) => {
                              console.log('🔍 [Country Code] Changed to:', e.target.value.toUpperCase())
                              setAdvancedOptions({ ...advancedOptions, billToCountryCode: e.target.value.toUpperCase() })
                            }}
                            placeholder={shipment?.shipBillToContact?.countryCode || "US"}
                            maxLength={2}
                            className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="text-xs text-gray-500 mt-0.5">
                            {shipment?.shipBillToContact?.countryCode ? `From contact: ${shipment.shipBillToContact.countryCode}` : 'ISO 3166-1 alpha-2 (from shipBillToContact.countryCode)'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Postal Code <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={advancedOptions.billToPostalCode}
                            onChange={(e) => {
                              console.log('🔍 [Postal Code] Changed to:', e.target.value)
                              setAdvancedOptions({ ...advancedOptions, billToPostalCode: e.target.value })
                            }}
                            placeholder={shipment?.shipBillToContact?.zip || "12345"}
                            className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="text-xs text-gray-500 mt-0.5">
                            {shipment?.shipBillToContact?.zip ? `From contact: ${shipment.shipBillToContact.zip}` : 'Validated for FedEx (from shipBillToContact)'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Advanced Options (Optional) */}
                <details className="bg-white border-2 border-gray-200 rounded-lg shadow-sm">
                  <summary className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors font-bold text-sm text-gray-900 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                      Advanced Options
                      <span className="text-xs font-normal text-gray-500">(Optional)</span>
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>

                  <div className="px-4 pb-4 pt-2 space-y-4 border-t border-gray-200">
                    {/* Info banner about carrier-specific options */}
                    <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
                      <strong>Note:</strong> Not all carriers support all advanced options. Options may vary based on the selected service: {selectedRate?.carrier} - {selectedRate?.service}
                    </div>

                    {/* Billing Options */}
                    <div className="space-y-3">
                      <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Billing Options</h5>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Bill To Party</label>
                        <select
                          value={advancedOptions.billToParty}
                          onChange={(e) => {
                            console.log('🔍 [Bill To Party] Changed to:', e.target.value)
                            console.log('🔍 [Bill To Party] Current advancedOptions:', advancedOptions)
                            setAdvancedOptions({
                              ...advancedOptions,
                              billToParty: e.target.value as 'sender' | 'recipient' | 'third_party'
                            })
                          }}
                          className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="sender">Sender (Default)</option>
                          <option value="recipient">Recipient (FedEx Ground Collect)</option>
                          <option value="third_party">Third Party</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-0.5">Who pays for shipping costs</p>
                      </div>

                      {/* Show note when third party is selected, directing to the prominent section above */}
                      {advancedOptions.billToParty === 'third_party' && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
                          <strong>Third Party Billing:</strong> The billing information fields are displayed prominently above (before Advanced Options) for easy access.
                          Scroll up to see and edit the Bill To Account, Country Code, and Postal Code fields.
                        </div>
                      )}
                    </div>

                    {/* Delivery Options */}
                    <div className="space-y-3 pt-3 border-t border-gray-200">
                      <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Delivery Options</h5>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Signature Confirmation</label>
                        <select
                          value={advancedOptions.confirmation}
                          onChange={(e) => setAdvancedOptions({
                            ...advancedOptions,
                            confirmation: e.target.value as 'none' | 'delivery' | 'signature' | 'adult_signature' | 'direct_signature'
                          })}
                          className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="none">No Signature Required</option>
                          <option value="delivery">Delivery Confirmation (Signature Required)</option>
                          <option value="signature">Signature Required</option>
                          <option value="adult_signature">Adult Signature Required (21+)</option>
                          <option value="direct_signature">Direct Signature (Recipient Only)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Signature requirements (additional charges may apply)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={advancedOptions.saturdayDelivery}
                            onChange={(e) => setAdvancedOptions({ ...advancedOptions, saturdayDelivery: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-xs font-medium text-gray-700">Saturday Delivery</span>
                        </label>
                        <p className="text-xs text-gray-500 ml-6">Request Saturday delivery (additional charges may apply)</p>
                      </div>
                    </div>

                    {/* Package Options */}
                    <div className="space-y-3 pt-3 border-t border-gray-200">
                      <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Package Options</h5>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={advancedOptions.containsAlcohol}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setAdvancedOptions({
                                ...advancedOptions,
                                containsAlcohol: checked,
                                // Auto-select adult signature if alcohol is checked
                                confirmation: checked ? 'adult_signature' : advancedOptions.confirmation
                              })
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-xs font-medium text-gray-700">Contains Alcohol</span>
                        </label>
                        <p className="text-xs text-gray-500 ml-6">Package contains alcoholic beverages (automatically requires adult signature)</p>
                      </div>
                    </div>

                    {/* Notification Options */}
                    <div className="space-y-3 pt-3 border-t border-gray-200">
                      <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Notifications</h5>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Tracking Notifications Email</label>
                        <input
                          type="email"
                          value={advancedOptions.notificationsEmail}
                          onChange={(e) => setAdvancedOptions({ ...advancedOptions, notificationsEmail: e.target.value })}
                          placeholder="customer@example.com"
                          className="w-full px-2 py-1.5 border-2 border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-0.5">
                          Carrier will send tracking notifications (supported by Royal Mail, Parcelforce Worldwide)
                        </p>
                      </div>
                    </div>
                  </div>
                </details>
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
              {autoCloseCountdown !== null && (
                <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-100 px-3 py-2 rounded border border-green-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>This window will automatically close in <strong>{autoCloseCountdown}</strong> seconds...</span>
                </div>
              )}
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
          {/* Hide back button on step 5 (final step) */}
          {currentStep !== 5 && (
            <button
              type="button"
              onClick={currentStep === 1 ? handleClose : handleBack}
              disabled={isLoading}
              className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium transition-colors shadow-sm"
            >
              {currentStep === 1 ? 'Cancel' : 'Back'}
            </button>
          )}

          <button
            type="button"
            onClick={currentStep === 5 ? handleComplete : handleNext}
            disabled={isLoading}
            className={`px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm ${currentStep === 5 ? 'ml-auto' : ''}`}
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
  overrideValidation,
  setOverrideValidation,
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
  overrideValidation: boolean
  setOverrideValidation: (override: boolean) => void
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
        setOverrideValidation(false) // Reset override when new validation completes

        // Auto-apply corrections if we have a matched address with differences
        if (data.data.matched_address) {
          const matched = data.data.matched_address
          // Compare only first 5 digits of ZIP code (ignore +4 extension)
          const matchedZip5 = matched.postal_code ? matched.postal_code.split('-')[0] : matched.postal_code
          const hasDifferences =
            matched.city_locality?.toLowerCase() !== toAddress.city.toLowerCase() ||
            matched.state_province !== toAddress.state ||
            matchedZip5 !== toAddress.zip

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
            // Only use first 5 digits of ZIP code (strip +4 extension)
            const correctedZip = matched.postal_code ? matched.postal_code.split('-')[0] : toAddress.zip
            const updatedAddress = {
              ...toAddress,
              city: matched.city_locality || toAddress.city,
              state: matched.state_province || toAddress.state,
              zip: correctedZip,
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
        setOverrideValidation(false) // Reset override on validation error
        setHasValidated(true)
      }
    } catch (error: any) {
      setValidationResult({ status: 'error', messages: [{ message: error.message, type: 'error' }] })
      setOverrideValidation(false) // Reset override on validation error
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

          // Determine effective status - only show "warning" if underlying status is actually "verified"
          // This prevents showing "verified with warnings" when address is unverified
          const effectiveStatus = hasErrors ? 'error' :
                                 validationResult.status === 'unverified' ? 'unverified' :
                                 validationResult.status === 'verified' && hasWarnings ? 'warning' :
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
                    // Only show first 5 digits of ZIP code
                    const displayZip = matched.postal_code.split('-')[0]
                    appliedChanges.push({ field: 'ZIP', from: originalAddress.zip, to: displayZip })
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

        {/* Override option for failed validation */}
        {validationResult && (validationResult.status === 'error' || validationResult.status === 'unverified') && (
          <div className="mb-3 p-3 bg-orange-50 border-2 border-orange-300 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={overrideValidation}
                onChange={(e) => setOverrideValidation(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-orange-600 border-orange-300 rounded focus:ring-orange-500"
              />
              <div className="flex-1">
                <span className="text-sm font-bold text-orange-900 group-hover:text-orange-700">
                  ⚠️ Proceed Anyway (Override Validation)
                </span>
                <p className="text-xs text-orange-700 mt-1">
                  I acknowledge that the address validation failed, but I want to proceed with creating the label anyway.
                  The shipping carrier may reject or delay shipments with invalid addresses.
                </p>
              </div>
            </label>
          </div>
        )}

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

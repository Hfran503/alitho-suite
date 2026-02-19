'use client'

import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'

type RateMode = 'quick' | 'full' | 'batch'

interface Carton {
  length: string
  width: string
  height: string
  weight: string
  qty: string
}

interface RateDetail {
  type: string
  description: string
  amount: number
  currency: string
}

interface RateEstimate {
  carrier: string
  service: string
  amount: number
  currency: string
  deliveryDays: number | null
  estimatedDeliveryDate: string | null
  hasMarkup?: boolean
  markupAmount?: number
  processingCost?: number
  // Breakdown fields (Full Rates mode only)
  shippingAmount?: number
  insuranceAmount?: number
  confirmationAmount?: number
  otherAmount?: number
  rateDetails?: RateDetail[]
}

interface FullAddress {
  name: string
  company: string
  street1: string
  street2: string
  city: string
  state: string
  zip: string
  country: string
  phone: string
}

// Batch quote types
interface BatchDestination {
  id: string
  name: string
  company: string
  street1: string
  street2: string
  city: string
  state: string
  zip: string
  country: string
  phone: string
  residential: string
  weight: string
  length: string
  width: string
  height: string
}

interface BatchResult {
  destinationId: string
  destination: BatchDestination
  status: 'pending' | 'loading' | 'success' | 'error'
  rates?: RateEstimate[]
  error?: string
  cheapestRate?: RateEstimate
}

// Carrier service mapping from settings
interface CarrierServiceMapping {
  id: string
  shipstationCarrierId: string
  shipstationCarrierCode: string
  shipstationServiceCode: string
  carrierName: string
  serviceName: string
  paceShipViaId: number
  paceShipViaName: string
}

export default function RateEstimatePage() {
  const [rateMode, setRateMode] = useState<RateMode>('quick')

  const [fromAddress, setFromAddress] = useState({
    countryCode: 'US',
    postalCode: '',
    city: '',
    state: '',
  })

  const [loadingDefaults, setLoadingDefaults] = useState(true)

  const [toAddress, setToAddress] = useState({
    countryCode: 'US',
    postalCode: '',
    city: '',
    state: '',
  })

  // Full address state for "Full Rates" mode
  const [fullFromAddress, setFullFromAddress] = useState<FullAddress>({
    name: '',
    company: '',
    street1: '',
    street2: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
    phone: '',
  })

  const [fullToAddress, setFullToAddress] = useState<FullAddress>({
    name: '',
    company: '',
    street1: '',
    street2: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
    phone: '',
  })

  const [cartons, setCartons] = useState<Carton[]>([
    { length: '', width: '', height: '', weight: '', qty: '1' },
  ])

  const [shipDate, setShipDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [confirmation, setConfirmation] = useState<string>('none')
  const [residential, setResidential] = useState<string>('unknown')

  const [rates, setRates] = useState<RateEstimate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedCarriers, setExpandedCarriers] = useState<Set<string>>(new Set())
  const [hideMarkup, setHideMarkup] = useState(false)

  // Batch quotes state
  const [batchDestinations, setBatchDestinations] = useState<BatchDestination[]>([])
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0 })
  const [expandedBatchRows, setExpandedBatchRows] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carrier service mappings for batch mode
  const [carrierServiceMappings, setCarrierServiceMappings] = useState<CarrierServiceMapping[]>([])
  const [selectedService, setSelectedService] = useState<string>('') // Format: "carrierId|serviceCode"
  const [loadingMappings, setLoadingMappings] = useState(false)

  // Load default from address from ShipStation settings on mount
  useEffect(() => {
    const fetchDefaultAddress = async () => {
      try {
        const response = await fetch('/api/integrations/shipstation')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data?.config?.defaultFromAddress) {
            const addr = data.data.config.defaultFromAddress
            // Set quick estimate address
            setFromAddress({
              countryCode: addr.country || 'US',
              postalCode: addr.zip || '',
              city: addr.city || '',
              state: addr.state || '',
            })
            // Also set full address for Full Rates mode
            setFullFromAddress({
              name: addr.name || '',
              company: addr.company || '',
              street1: addr.street1 || '',
              street2: addr.street2 || '',
              city: addr.city || '',
              state: addr.state || '',
              zip: addr.zip || '',
              country: addr.country || 'US',
              phone: addr.phone || '',
            })
          }
        }
      } catch (err) {
        console.error('Failed to load default from address:', err)
      } finally {
        setLoadingDefaults(false)
      }
    }

    fetchDefaultAddress()
  }, [])

  // Fetch carrier service mappings for batch mode
  useEffect(() => {
    const fetchCarrierMappings = async () => {
      if (rateMode !== 'batch') return

      setLoadingMappings(true)
      try {
        const response = await fetch('/api/settings/carrier-services')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            setCarrierServiceMappings(data.data)
          }
        }
      } catch (err) {
        console.error('Failed to load carrier service mappings:', err)
      } finally {
        setLoadingMappings(false)
      }
    }

    fetchCarrierMappings()
  }, [rateMode])

  const addCarton = () => {
    setCartons([...cartons, { length: '', width: '', height: '', weight: '', qty: '1' }])
  }

  const removeCarton = (index: number) => {
    if (cartons.length > 1) {
      setCartons(cartons.filter((_, i) => i !== index))
    }
  }

  const updateCarton = (index: number, field: keyof Carton, value: string) => {
    const newCartons = [...cartons]
    newCartons[index][field] = value
    setCartons(newCartons)
  }

  // Expand cartons by qty for API requests
  const expandCartons = (cartonList: Carton[]): Carton[] => {
    const expanded: Carton[] = []
    for (const carton of cartonList) {
      const qty = Math.max(1, parseInt(carton.qty) || 1)
      for (let i = 0; i < qty; i++) {
        expanded.push(carton)
      }
    }
    return expanded
  }

  const toggleCarrier = (carrier: string) => {
    const newExpanded = new Set(expandedCarriers)
    if (newExpanded.has(carrier)) {
      newExpanded.delete(carrier)
    } else {
      newExpanded.add(carrier)
    }
    setExpandedCarriers(newExpanded)
  }

  const toggleAllCarriers = () => {
    if (expandedCarriers.size === groupedRates.size) {
      setExpandedCarriers(new Set())
    } else {
      setExpandedCarriers(new Set(groupedRates.keys()))
    }
  }

  // Batch quote functions
  const createEmptyDestination = (): BatchDestination => ({
    id: crypto.randomUUID(),
    name: '',
    company: '',
    street1: '',
    street2: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
    phone: '',
    residential: 'unknown',
    weight: '',
    length: '',
    width: '',
    height: '',
  })

  const addBatchDestination = () => {
    setBatchDestinations([...batchDestinations, createEmptyDestination()])
  }

  const removeBatchDestination = (id: string) => {
    setBatchDestinations(batchDestinations.filter((d) => d.id !== id))
    setBatchResults(batchResults.filter((r) => r.destinationId !== id))
  }

  const updateBatchDestination = (id: string, field: keyof BatchDestination, value: string) => {
    setBatchDestinations(
      batchDestinations.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    )
  }

  const clearBatchResults = () => {
    setBatchResults([])
    setBatchProgress({ completed: 0, total: 0 })
  }

  // Handle CSV/XLSX file import
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet)

        if (jsonData.length === 0) {
          setError('No data found in file')
          return
        }

        // Helper to find a column value with flexible naming
        const getColumnValue = (row: Record<string, any>, possibleNames: string[]): string => {
          for (const name of possibleNames) {
            // Try exact match first
            if (row[name] !== undefined && row[name] !== null) {
              return String(row[name]).trim()
            }
            // Try case-insensitive match
            const lowerName = name.toLowerCase()
            for (const key of Object.keys(row)) {
              if (key.toLowerCase() === lowerName && row[key] !== undefined && row[key] !== null) {
                return String(row[key]).trim()
              }
            }
          }
          return ''
        }

        // Parse residential value
        const parseResidential = (value: string): string => {
          const lower = value.toLowerCase()
          if (lower === 'yes' || lower === 'true' || lower === 'residential' || lower === '1') {
            return 'yes'
          }
          if (lower === 'no' || lower === 'false' || lower === 'commercial' || lower === '0') {
            return 'no'
          }
          return 'unknown'
        }

        // Map rows to destinations
        const newDestinations: BatchDestination[] = jsonData.map((row) => ({
          id: crypto.randomUUID(),
          name: getColumnValue(row, ['name', 'recipient', 'recipient_name', 'contact', 'attention']),
          company: getColumnValue(row, ['company', 'company_name', 'business', 'organization']),
          street1: getColumnValue(row, ['street1', 'street', 'address', 'address1', 'address_line_1', 'street_address']),
          street2: getColumnValue(row, ['street2', 'address2', 'address_line_2', 'apt', 'suite', 'unit']),
          city: getColumnValue(row, ['city', 'city_locality', 'town']),
          state: getColumnValue(row, ['state', 'state_province', 'province', 'region']).toUpperCase(),
          zip: getColumnValue(row, ['zip', 'zipcode', 'zip_code', 'postal', 'postal_code', 'postalcode']),
          country: getColumnValue(row, ['country', 'country_code', 'countrycode']) || 'US',
          phone: getColumnValue(row, ['phone', 'phone_number', 'telephone', 'tel']),
          residential: parseResidential(getColumnValue(row, ['residential', 'address_type', 'type', 'is_residential'])),
          weight: getColumnValue(row, ['weight', 'weight_lb', 'weight_lbs', 'lbs', 'pounds']),
          length: getColumnValue(row, ['length', 'length_in', 'l']),
          width: getColumnValue(row, ['width', 'width_in', 'w']),
          height: getColumnValue(row, ['height', 'height_in', 'h']),
        }))

        // Filter out rows that don't have minimum required fields
        const validDestinations = newDestinations.filter(
          (d) => d.street1 && d.city && d.state && d.zip
        )

        if (validDestinations.length === 0) {
          setError('No valid addresses found. Required columns: street1/address, city, state, zip')
          return
        }

        // Add to existing destinations
        setBatchDestinations((prev) => [...prev, ...validDestinations])
        setError(null)

        // Show success feedback
        const skipped = newDestinations.length - validDestinations.length
        if (skipped > 0) {
          setError(`Imported ${validDestinations.length} destinations. ${skipped} rows skipped (missing required fields).`)
        }
      } catch (err: any) {
        setError(`Failed to parse file: ${err.message || 'Unknown error'}`)
      }
    }

    reader.onerror = () => {
      setError('Failed to read file')
    }

    reader.readAsArrayBuffer(file)

    // Reset file input so the same file can be imported again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Group rates by carrier
  const groupedRates = rates.reduce((acc, rate) => {
    const carrier = rate.carrier
    if (!acc.has(carrier)) {
      acc.set(carrier, [])
    }
    acc.get(carrier)!.push(rate)
    return acc
  }, new Map<string, RateEstimate[]>())

  // Sort carriers by cheapest rate
  const sortedCarriers = Array.from(groupedRates.entries()).sort((a, b) => {
    const aMin = Math.min(...a[1].map(r => r.amount))
    const bMin = Math.min(...b[1].map(r => r.amount))
    return aMin - bMin
  })

  const handleEstimateRates = async () => {
    setError(null)
    setLoading(true)

    try {
      // Validate required fields
      if (!fromAddress.postalCode || !fromAddress.city || !fromAddress.state) {
        throw new Error('Please fill in all "From" address fields')
      }
      if (!toAddress.postalCode || !toAddress.city || !toAddress.state) {
        throw new Error('Please fill in all "To" address fields')
      }

      // Validate cartons
      for (let i = 0; i < cartons.length; i++) {
        const carton = cartons[i]
        if (!carton.weight || parseFloat(carton.weight) <= 0) {
          throw new Error(`Carton ${i + 1}: Weight is required and must be greater than 0`)
        }
        // Dimensions are optional
      }

      const expandedCartonList = expandCartons(cartons)

      const response = await fetch('/api/shipstation/rate-estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddress,
          toAddress,
          cartons: expandedCartonList,
          shipDate,
          confirmation,
          residential,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get rate estimates')
      }

      const data = await response.json()
      setRates(data.data.rates)
    } catch (err: any) {
      setError(err.message || 'Failed to estimate rates')
    } finally {
      setLoading(false)
    }
  }

  // Handler for Full Rates mode - uses the full /v1/rates endpoint
  const handleFullRates = async () => {
    setError(null)
    setLoading(true)

    try {
      // Validate required fields for full address
      if (!fullFromAddress.street1 || !fullFromAddress.city || !fullFromAddress.state || !fullFromAddress.zip) {
        throw new Error('Please fill in all required "From" address fields (Street, City, State, ZIP)')
      }
      if (!fullToAddress.street1 || !fullToAddress.city || !fullToAddress.state || !fullToAddress.zip) {
        throw new Error('Please fill in all required "To" address fields (Street, City, State, ZIP)')
      }

      // Validate cartons
      for (let i = 0; i < cartons.length; i++) {
        const carton = cartons[i]
        if (!carton.weight || parseFloat(carton.weight) <= 0) {
          throw new Error(`Carton ${i + 1}: Weight is required and must be greater than 0`)
        }
      }

      const expandedCartonList = expandCartons(cartons)

      // Build packages array
      const packages = expandedCartonList.map((carton) => ({
        weight: parseFloat(carton.weight),
        weightUnit: 'pound',
        length: carton.length ? parseFloat(carton.length) : undefined,
        width: carton.width ? parseFloat(carton.width) : undefined,
        height: carton.height ? parseFloat(carton.height) : undefined,
        dimensionUnit: 'inch',
      }))

      const response = await fetch('/api/shipstation/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipFrom: fullFromAddress,
          shipTo: fullToAddress,
          packages,
          residential: 'unknown',
          confirmation,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get rates')
      }

      const data = await response.json()
      // Transform the response to match RateEstimate interface
      const transformedRates: RateEstimate[] = data.data.rates.map((rate: any) => ({
        carrier: rate.carrier || rate.carrierNickname || rate.carrierCode,
        service: rate.service || rate.serviceType,
        amount: rate.amount,
        currency: rate.currency,
        deliveryDays: rate.deliveryDays,
        estimatedDeliveryDate: rate.estimatedDeliveryDate,
        hasMarkup: rate.hasMarkup,
        markupAmount: rate.markupAmount,
        processingCost: rate.processingCost,
        // Breakdown fields
        shippingAmount: rate.shippingAmount,
        insuranceAmount: rate.insuranceAmount,
        confirmationAmount: rate.confirmationAmount,
        otherAmount: rate.otherAmount,
        rateDetails: rate.rateDetails,
      }))
      setRates(transformedRates)
    } catch (err: any) {
      setError(err.message || 'Failed to get rates')
    } finally {
      setLoading(false)
    }
  }

  // Handler for Batch Quotes - parallel requests for multiple destinations
  const handleBatchQuotes = async () => {
    if (batchDestinations.length === 0) {
      setError('Please add at least one destination')
      return
    }

    // Require service selection for batch mode
    if (!selectedService) {
      setError('Please select a carrier/service')
      return
    }

    // Validate from address
    if (!fullFromAddress.street1 || !fullFromAddress.city || !fullFromAddress.state || !fullFromAddress.zip) {
      setError('Please fill in all required "From" address fields')
      return
    }

    // Validate destinations
    for (let i = 0; i < batchDestinations.length; i++) {
      const dest = batchDestinations[i]
      if (!dest.street1 || !dest.city || !dest.state || !dest.zip) {
        setError(`Destination ${i + 1}: Please fill in Street, City, State, and ZIP`)
        return
      }
      if (!dest.weight || parseFloat(dest.weight) <= 0) {
        setError(`Destination ${i + 1}: Weight is required and must be greater than 0`)
        return
      }
    }

    // Parse selected service
    const [carrierId, serviceCode] = selectedService.split('|')

    setError(null)
    setBatchLoading(true)
    setBatchProgress({ completed: 0, total: batchDestinations.length })

    // Initialize results as pending
    const initialResults: BatchResult[] = batchDestinations.map((dest) => ({
      destinationId: dest.id,
      destination: dest,
      status: 'loading',
    }))
    setBatchResults(initialResults)

    // Rate limiting configuration
    // ShipStation allows 200 requests/minute = ~3.3 requests/second
    // We'll process in small batches with delays to stay well under the limit
    const BATCH_SIZE = 5 // Process 5 destinations at a time
    const DELAY_BETWEEN_BATCHES_MS = 2000 // 2 seconds between batches
    const MAX_RETRIES = 3

    // Helper function to process a single destination with retry logic
    const processDestination = async (dest: BatchDestination, retryCount = 0): Promise<BatchResult> => {
      try {
        const packages = [
          {
            weight: parseFloat(dest.weight),
            weightUnit: 'pound',
            length: dest.length ? parseFloat(dest.length) : undefined,
            width: dest.width ? parseFloat(dest.width) : undefined,
            height: dest.height ? parseFloat(dest.height) : undefined,
            dimensionUnit: 'inch',
          },
        ]

        const response = await fetch('/api/shipstation/rates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shipFrom: fullFromAddress,
            shipTo: {
              name: dest.name,
              company: dest.company,
              street1: dest.street1,
              street2: dest.street2,
              city: dest.city,
              state: dest.state,
              zip: dest.zip,
              country: dest.country,
              phone: dest.phone,
            },
            packages,
            residential: dest.residential,
            carrierIds: [carrierId],
            serviceCode: serviceCode,
          }),
        })

        // Handle rate limiting with retry
        if (response.status === 429 || (response.status === 500 && retryCount < MAX_RETRIES)) {
          const retryAfter = response.headers.get('Retry-After')
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, retryCount + 1) * 1000
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return processDestination(dest, retryCount + 1)
        }

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to get rates')
        }

        const data = await response.json()
        const rates: RateEstimate[] = data.data.rates.map((rate: any) => ({
          carrier: rate.carrier || rate.carrierNickname || rate.carrierCode,
          service: rate.service || rate.serviceType,
          amount: rate.amount,
          currency: rate.currency,
          deliveryDays: rate.deliveryDays,
          estimatedDeliveryDate: rate.estimatedDeliveryDate,
          hasMarkup: rate.hasMarkup,
          markupAmount: rate.markupAmount,
          processingCost: rate.processingCost,
          // Breakdown fields
          shippingAmount: rate.shippingAmount,
          insuranceAmount: rate.insuranceAmount,
          confirmationAmount: rate.confirmationAmount,
          otherAmount: rate.otherAmount,
          rateDetails: rate.rateDetails,
        }))

        // Find cheapest rate
        const cheapestRate = rates.length > 0 ? rates.reduce((min, r) => (r.amount < min.amount ? r : min)) : undefined

        return {
          destinationId: dest.id,
          destination: dest,
          status: 'success' as const,
          rates,
          cheapestRate,
        }
      } catch (err: any) {
        // Retry on network errors
        if (retryCount < MAX_RETRIES && !err.message?.includes('API error')) {
          const delay = Math.pow(2, retryCount + 1) * 1000
          console.log(`Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return processDestination(dest, retryCount + 1)
        }
        return {
          destinationId: dest.id,
          destination: dest,
          status: 'error' as const,
          error: err.message || 'Failed to get rates',
        }
      }
    }

    // Process destinations in batches to respect rate limits
    let completed = 0
    for (let i = 0; i < batchDestinations.length; i += BATCH_SIZE) {
      const batch = batchDestinations.slice(i, i + BATCH_SIZE)

      // Process batch in parallel (but limited to BATCH_SIZE concurrent requests)
      const batchPromises = batch.map(dest => processDestination(dest))
      const batchResults = await Promise.all(batchPromises)

      // Update UI with batch results
      for (const result of batchResults) {
        completed++
        setBatchProgress({ completed, total: batchDestinations.length })
        setBatchResults((prev) =>
          prev.map((r) => (r.destinationId === result.destinationId ? result : r))
        )
      }

      // Add delay before next batch (unless this is the last batch)
      if (i + BATCH_SIZE < batchDestinations.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS))
      }
    }

    setBatchLoading(false)
  }

  // Export batch results to CSV
  const exportBatchToCSV = () => {
    if (batchResults.length === 0) return

    // Get selected service info
    const selectedServiceMapping = selectedService
      ? carrierServiceMappings.find(
          (m) => `${m.shipstationCarrierId}|${m.shipstationServiceCode}` === selectedService
        )
      : null

    // Collect all unique fee types from rate details across all results
    const allFeeTypes = new Set<string>()
    batchResults.forEach((result) => {
      if (result.status === 'success' && result.cheapestRate?.rateDetails) {
        result.cheapestRate.rateDetails.forEach((detail) => {
          if (detail.description) {
            allFeeTypes.add(detail.description)
          }
        })
      }
    })
    const feeTypeColumns = Array.from(allFeeTypes).sort()

    // Build dynamic headers
    const baseHeaders = [
      'Name',
      'Company',
      'Street 1',
      'Street 2',
      'City',
      'State',
      'ZIP',
      'Country',
      'Residential',
      'Weight (lb)',
      'Length (in)',
      'Width (in)',
      'Height (in)',
      'Status',
      'Carrier',
      'Service',
    ]

    // Add fee type columns dynamically, then markup/processing/total
    const headers = [
      ...baseHeaders,
      ...feeTypeColumns,
      'Markup',
      'Processing Fee',
      'Total Rate',
      'Delivery Days',
    ]

    const rows = batchResults.map((result) => {
      const dest = result.destination
      if (result.status === 'success' && result.cheapestRate) {
        const rate = result.cheapestRate

        // Build a map of fee type -> amount from rate details
        const feeAmounts = new Map<string, number>()
        if (rate.rateDetails) {
          rate.rateDetails.forEach((detail) => {
            if (detail.description && detail.amount > 0) {
              feeAmounts.set(detail.description, detail.amount)
            }
          })
        }

        // Base columns
        const baseColumns = [
          dest.name || '',
          dest.company || '',
          dest.street1 || '',
          dest.street2 || '',
          dest.city,
          dest.state,
          dest.zip,
          dest.country || 'US',
          dest.residential === 'yes' ? 'Yes' : dest.residential === 'no' ? 'No' : 'Unknown',
          dest.weight,
          dest.length || '',
          dest.width || '',
          dest.height || '',
          'Success',
          selectedServiceMapping?.carrierName || rate.carrier,
          selectedServiceMapping?.serviceName || rate.service,
        ]

        // Fee type columns (in order)
        const feeColumns = feeTypeColumns.map((feeType) => {
          const amount = feeAmounts.get(feeType)
          return amount !== undefined ? `$${amount.toFixed(2)}` : ''
        })

        // Final columns
        const displayAmount = hideMarkup ? rate.amount - (rate.markupAmount || 0) - (rate.processingCost || 0) : rate.amount
        const finalColumns = [
          !hideMarkup && rate.markupAmount !== undefined && rate.markupAmount > 0 ? `$${rate.markupAmount.toFixed(2)}` : '',
          !hideMarkup && rate.processingCost !== undefined && rate.processingCost > 0 ? `$${rate.processingCost.toFixed(2)}` : '',
          `$${displayAmount.toFixed(2)}`,
          rate.deliveryDays?.toString() || 'N/A',
        ]

        return [...baseColumns, ...feeColumns, ...finalColumns]
      } else {
        // Error/pending row - fill with empty strings for all fee columns
        const emptyFeeColumns = feeTypeColumns.map(() => '')
        return [
          dest.name || '',
          dest.company || '',
          dest.street1 || '',
          dest.street2 || '',
          dest.city,
          dest.state,
          dest.zip,
          dest.country || 'US',
          dest.residential === 'yes' ? 'Yes' : dest.residential === 'no' ? 'No' : 'Unknown',
          dest.weight,
          dest.length || '',
          dest.width || '',
          dest.height || '',
          result.status === 'error' ? `Error: ${result.error}` : 'Pending',
          '', // Carrier
          '', // Service
          ...emptyFeeColumns,
          '', // Markup
          '', // Processing Fee
          '', // Total Rate
          '', // Delivery Days
        ]
      }
    })

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-quotes-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Download CSV template for batch import
  const downloadTemplate = () => {
    const headers = [
      'name',
      'company',
      'street1',
      'street2',
      'city',
      'state',
      'zip',
      'country',
      'phone',
      'residential',
      'weight',
      'length',
      'width',
      'height',
    ]

    const sampleRow = [
      'John Doe',
      'ACME Corp',
      '123 Main St',
      'Suite 100',
      'Los Angeles',
      'CA',
      '90210',
      'US',
      '555-123-4567',
      'yes',
      '2.5',
      '12',
      '8',
      '6',
    ]

    const csvContent = [headers, sampleRow].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'batch-quotes-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Unified handler that calls the appropriate method based on mode
  const handleGetRates = () => {
    if (rateMode === 'quick') {
      handleEstimateRates()
    } else {
      handleFullRates()
    }
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Estimate Shipping Rates</h1>
        <p className="text-xs text-gray-600 mt-0.5">
          Get rate estimates from multiple carriers without creating labels
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="mb-4 bg-white rounded-lg shadow p-1 inline-flex">
        <button
          onClick={() => setRateMode('quick')}
          className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
            rateMode === 'quick'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Quick Estimate
        </button>
        <button
          onClick={() => setRateMode('full')}
          className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
            rateMode === 'full'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Full Rates
        </button>
        <button
          onClick={() => setRateMode('batch')}
          className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
            rateMode === 'batch'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Batch Quotes
        </button>
      </div>

      {/* Mode Description */}
      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        {rateMode === 'quick' ? (
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <p className="text-xs font-medium text-gray-900">Quick Estimate Mode</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Fast estimates using postal codes only. May not include all surcharges (e.g., residential delivery fees).
              </p>
            </div>
          </div>
        ) : rateMode === 'full' ? (
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs font-medium text-gray-900">Full Rates Mode</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Accurate rates with full address validation. Includes all carrier surcharges like UPS residential delivery fees.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <div>
              <p className="text-xs font-medium text-gray-900">Batch Quotes Mode</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Get rates for multiple destinations at once. Uses full address validation with parallel requests.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Batch Mode - Full Width Layout */}
      {rateMode === 'batch' && (
        <div className="space-y-4">
          {/* Top Row - Settings */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* From Address - Compact */}
            <div className="lg:col-span-5 bg-white rounded-lg shadow p-4">
              <div className="mb-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-900">From Address</h2>
                  {loadingDefaults && (
                    <span className="text-xs text-gray-500 italic">Loading...</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Street <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={fullFromAddress.street1}
                    onChange={(e) => setFullFromAddress({ ...fullFromAddress, street1: e.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="123 Main St"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={fullFromAddress.city}
                    onChange={(e) => setFullFromAddress({ ...fullFromAddress, city: e.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="City"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={fullFromAddress.state}
                      onChange={(e) => setFullFromAddress({ ...fullFromAddress, state: e.target.value.toUpperCase() })}
                      maxLength={2}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="TX"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ZIP</label>
                    <input
                      type="text"
                      value={fullFromAddress.zip}
                      onChange={(e) => setFullFromAddress({ ...fullFromAddress, zip: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="78756"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Carrier/Service Selector - Compact */}
            <div className="lg:col-span-4 bg-white rounded-lg shadow p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2">
                Carrier / Service <span className="text-red-500">*</span>
              </h2>
              {loadingMappings ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </div>
              ) : carrierServiceMappings.length === 0 ? (
                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                  No carrier services configured. Go to Settings.
                </div>
              ) : (
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">-- Select a service --</option>
                  {Array.from(new Set(carrierServiceMappings.map((m) => m.carrierName))).map((carrierName) => (
                    <optgroup key={carrierName} label={carrierName}>
                      {carrierServiceMappings
                        .filter((m) => m.carrierName === carrierName)
                        .map((mapping) => (
                          <option
                            key={mapping.id}
                            value={`${mapping.shipstationCarrierId}|${mapping.shipstationServiceCode}`}
                          >
                            {mapping.serviceName}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>

            {/* Summary Stats - Compact */}
            <div className="lg:col-span-3 bg-white rounded-lg shadow p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2">Summary</h2>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded p-2 text-center">
                  <p className="text-xl font-bold text-gray-900">{batchDestinations.length}</p>
                  <p className="text-[10px] text-gray-500">Destinations</p>
                </div>
                <div className="bg-gray-50 rounded p-2 text-center">
                  {batchResults.length > 0 && batchResults.some(r => r.status === 'success') ? (
                    <>
                      <p className="text-xl font-bold text-green-600">
                        ${batchResults
                          .filter(r => r.status === 'success' && r.cheapestRate)
                          .reduce((sum, r) => {
                            const rate = r.cheapestRate!
                            const amt = hideMarkup ? rate.amount - (rate.markupAmount || 0) - (rate.processingCost || 0) : rate.amount
                            return sum + amt
                          }, 0)
                          .toFixed(2)}
                      </p>
                      <p className="text-[10px] text-gray-500">Total Cost</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-bold text-gray-400">-</p>
                      <p className="text-[10px] text-gray-500">Total Cost</p>
                    </>
                  )}
                </div>
              </div>
              {batchResults.length > 0 && (
                <div className="mt-2 flex items-center gap-2 text-[10px]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    {batchResults.filter(r => r.status === 'success').length}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    {batchResults.filter(r => r.status === 'error').length}
                  </span>
                  {batchResults.some(r => r.status === 'loading') && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                      {batchResults.filter(r => r.status === 'loading').length}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Destinations Table - Full Width */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Destinations
                  {batchResults.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      {batchResults.filter(r => r.status === 'success').length} of {batchResults.length} quoted
                    </span>
                  )}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileImport}
                  className="hidden"
                />
                {batchResults.length > 0 && (
                  <button
                    onClick={exportBatchToCSV}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-medium"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export
                  </button>
                )}
                {batchDestinations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setBatchDestinations([])
                      setBatchResults([])
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded transition-colors text-xs font-medium"
                  >
                    Clear All
                  </button>
                )}
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors text-xs font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Template
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import
                </button>
                <button
                  type="button"
                  onClick={addBatchDestination}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </button>
              </div>
            </div>

            {batchDestinations.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-gray-500">No destinations added yet</p>
                <p className="text-xs text-gray-400 mt-1">Click "Add" or "Import" a CSV/Excel file</p>
                <button
                  onClick={downloadTemplate}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download CSV Template
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 rounded-t text-xs font-medium text-gray-600 min-w-[900px]">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-2">Name/Company</div>
                  <div className="col-span-2">Street</div>
                  <div className="col-span-2">City, State ZIP</div>
                  <div className="col-span-1 text-center">Type</div>
                  <div className="col-span-1 text-center">Weight</div>
                  <div className="col-span-2 text-center">Rate</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>

                {/* Table Body */}
                <div className="max-h-[500px] overflow-y-auto min-w-[900px]">
                  {batchDestinations.map((dest, index) => {
                    const result = batchResults.find(r => r.destinationId === dest.id)
                    const isExpanded = expandedBatchRows?.has(dest.id)

                    return (
                      <div key={dest.id} className="border-b border-gray-100 last:border-b-0">
                        {/* Compact Row */}
                        <div
                          className={`grid grid-cols-12 gap-2 px-3 py-2 items-center text-xs hover:bg-gray-50 cursor-pointer ${
                            result?.status === 'error' ? 'bg-red-50' : ''
                          }`}
                          onClick={() => {
                            const newExpanded = new Set(expandedBatchRows || [])
                            if (newExpanded.has(dest.id)) {
                              newExpanded.delete(dest.id)
                            } else {
                              newExpanded.add(dest.id)
                            }
                            setExpandedBatchRows(newExpanded)
                          }}
                        >
                          <div className="col-span-1 text-center text-gray-400 font-medium">{index + 1}</div>
                          <div className="col-span-2 truncate font-medium text-gray-900">
                            {dest.name || dest.company || '-'}
                          </div>
                          <div className="col-span-2 truncate text-gray-600">{dest.street1 || '-'}</div>
                          <div className="col-span-2 truncate text-gray-600">
                            {dest.city}, {dest.state} {dest.zip}
                          </div>
                          <div className="col-span-1 text-center">
                            {dest.residential === 'yes' ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">R</span>
                            ) : dest.residential === 'no' ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">C</span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">?</span>
                            )}
                          </div>
                          <div className="col-span-1 text-center text-gray-600">{dest.weight} lb</div>
                          <div className="col-span-2 text-center">
                            {result?.status === 'loading' ? (
                              <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                                <svg className="w-3 h-3 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              </div>
                            ) : result?.status === 'success' && result.cheapestRate ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500 text-white rounded font-bold shadow-sm">
                                ${(hideMarkup ? result.cheapestRate.amount - (result.cheapestRate.markupAmount || 0) - (result.cheapestRate.processingCost || 0) : result.cheapestRate.amount).toFixed(2)}
                                {result.cheapestRate.deliveryDays && (
                                  <span className="text-[10px] font-normal opacity-90">
                                    ({result.cheapestRate.deliveryDays}d)
                                  </span>
                                )}
                              </div>
                            ) : result?.status === 'error' ? (
                              <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-[10px]" title={result.error}>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Error
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                          <div className="col-span-1 flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const newExpanded = new Set(expandedBatchRows || [])
                                if (newExpanded.has(dest.id)) {
                                  newExpanded.delete(dest.id)
                                } else {
                                  newExpanded.add(dest.id)
                                }
                                setExpandedBatchRows(newExpanded)
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removeBatchDestination(dest.id)
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Remove"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Expanded Edit View */}
                        {isExpanded && (
                          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                            <div className="grid grid-cols-8 gap-2">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                                <input
                                  type="text"
                                  value={dest.name}
                                  onChange={(e) => updateBatchDestination(dest.id, 'name', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  placeholder="Recipient"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                                <input
                                  type="text"
                                  value={dest.company}
                                  onChange={(e) => updateBatchDestination(dest.id, 'company', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  placeholder="Company"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Street <span className="text-red-500">*</span></label>
                                <input
                                  type="text"
                                  value={dest.street1}
                                  onChange={(e) => updateBatchDestination(dest.id, 'street1', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  placeholder="456 Oak Ave"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                                <input
                                  type="text"
                                  value={dest.city}
                                  onChange={(e) => updateBatchDestination(dest.id, 'city', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  placeholder="City"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                                <input
                                  type="text"
                                  value={dest.state}
                                  onChange={(e) => updateBatchDestination(dest.id, 'state', e.target.value.toUpperCase())}
                                  onClick={(e) => e.stopPropagation()}
                                  maxLength={2}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  placeholder="CA"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">ZIP <span className="text-red-500">*</span></label>
                                <input
                                  type="text"
                                  value={dest.zip}
                                  onChange={(e) => updateBatchDestination(dest.id, 'zip', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  placeholder="90210"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                                <select
                                  value={dest.residential}
                                  onChange={(e) => updateBatchDestination(dest.id, 'residential', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                >
                                  <option value="unknown">Unknown</option>
                                  <option value="yes">Residential</option>
                                  <option value="no">Commercial</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Weight (lb) <span className="text-red-500">*</span></label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={dest.weight}
                                  onChange={(e) => updateBatchDestination(dest.id, 'weight', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  placeholder="1.0"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">L (in)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={dest.length}
                                  onChange={(e) => updateBatchDestination(dest.id, 'length', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  placeholder="12"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">W (in)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={dest.width}
                                  onChange={(e) => updateBatchDestination(dest.id, 'width', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  placeholder="8"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">H (in)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={dest.height}
                                  onChange={(e) => updateBatchDestination(dest.id, 'height', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  placeholder="6"
                                />
                              </div>
                            </div>

                            {/* Rate Breakdown */}
                            {result?.status === 'success' && result.cheapestRate && (
                              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-xs">
                                <div className="text-gray-600 flex items-center gap-4">
                                  {result.cheapestRate.rateDetails && result.cheapestRate.rateDetails.length > 0 ? (
                                    result.cheapestRate.rateDetails.map((detail, i) => (
                                      <span key={i}>
                                        {detail.description}: <span className="font-medium">${detail.amount.toFixed(2)}</span>
                                      </span>
                                    ))
                                  ) : (
                                    <>
                                      {result.cheapestRate.shippingAmount !== undefined && (
                                        <span>Shipping: <span className="font-medium">${result.cheapestRate.shippingAmount.toFixed(2)}</span></span>
                                      )}
                                    </>
                                  )}
                                  {!hideMarkup && result.cheapestRate.markupAmount !== undefined && result.cheapestRate.markupAmount > 0 && (
                                    <span className="text-blue-600">Markup: <span className="font-medium">${result.cheapestRate.markupAmount.toFixed(2)}</span></span>
                                  )}
                                  {!hideMarkup && result.cheapestRate.processingCost !== undefined && result.cheapestRate.processingCost > 0 && (
                                    <span className="text-green-600">Processing: <span className="font-medium">${result.cheapestRate.processingCost.toFixed(2)}</span></span>
                                  )}
                                </div>
                                <div className="font-bold text-green-700">
                                  Total: ${(hideMarkup ? result.cheapestRate.amount - (result.cheapestRate.markupAmount || 0) - (result.cheapestRate.processingCost || 0) : result.cheapestRate.amount).toFixed(2)}
                                </div>
                              </div>
                            )}

                            {result?.status === 'error' && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-xs text-red-600">{result.error}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Batch Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleBatchQuotes}
              disabled={batchLoading || batchDestinations.length === 0 || !selectedService}
              className="flex-1 py-2.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors text-sm"
            >
              {batchLoading ? `Getting Rates... (${batchProgress.completed}/${batchProgress.total})` : 'Get Batch Quotes'}
            </button>
            {batchResults.length > 0 && (
              <button
                onClick={clearBatchResults}
                className="px-4 py-2.5 bg-gray-500 text-white rounded hover:bg-gray-600 font-medium transition-colors text-sm"
              >
                Clear Results
              </button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-red-800 font-medium">{error}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick/Full Mode - Original 2-Column Layout */}
      {rateMode !== 'batch' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column - Input Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* From Address - Quick Estimate Mode */}
          {rateMode === 'quick' && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">From Address</h2>
                {loadingDefaults && (
                  <span className="text-xs text-gray-500 italic">Loading defaults...</span>
                )}
              </div>
              {!loadingDefaults && fromAddress.postalCode && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Default address loaded from ShipStation settings
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Country Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fromAddress.countryCode}
                  onChange={(e) => setFromAddress({ ...fromAddress, countryCode: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="US"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Postal Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fromAddress.postalCode}
                  onChange={(e) => setFromAddress({ ...fromAddress, postalCode: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="78756"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fromAddress.city}
                  onChange={(e) => setFromAddress({ ...fromAddress, city: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Austin"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fromAddress.state}
                  onChange={(e) => setFromAddress({ ...fromAddress, state: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="TX"
                />
              </div>
            </div>
          </div>
          )}

          {/* To Address - Quick Estimate Mode */}
          {rateMode === 'quick' && (
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3">To Address</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Country Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={toAddress.countryCode}
                  onChange={(e) => setToAddress({ ...toAddress, countryCode: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="US"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Postal Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={toAddress.postalCode}
                  onChange={(e) => setToAddress({ ...toAddress, postalCode: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="90210"
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
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Los Angeles"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={toAddress.state}
                  onChange={(e) => setToAddress({ ...toAddress, state: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="CA"
                />
              </div>
            </div>
          </div>
          )}

          {/* From Address - Full Rates Mode */}
          {rateMode === 'full' && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">From Address</h2>
                {loadingDefaults && (
                  <span className="text-xs text-gray-500 italic">Loading defaults...</span>
                )}
              </div>
              {!loadingDefaults && fullFromAddress.zip && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Default address loaded from ShipStation settings
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={fullFromAddress.name}
                  onChange={(e) => setFullFromAddress({ ...fullFromAddress, name: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={fullFromAddress.company}
                  onChange={(e) => setFullFromAddress({ ...fullFromAddress, company: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="ACME Inc."
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Street Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullFromAddress.street1}
                  onChange={(e) => setFullFromAddress({ ...fullFromAddress, street1: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123 Main St"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Street Address 2</label>
                <input
                  type="text"
                  value={fullFromAddress.street2}
                  onChange={(e) => setFullFromAddress({ ...fullFromAddress, street2: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Suite 100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullFromAddress.city}
                  onChange={(e) => setFullFromAddress({ ...fullFromAddress, city: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Austin"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullFromAddress.state}
                  onChange={(e) => setFullFromAddress({ ...fullFromAddress, state: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="TX"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  ZIP Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullFromAddress.zip}
                  onChange={(e) => setFullFromAddress({ ...fullFromAddress, zip: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="78756"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={fullFromAddress.country}
                  onChange={(e) => setFullFromAddress({ ...fullFromAddress, country: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="US"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={fullFromAddress.phone}
                  onChange={(e) => setFullFromAddress({ ...fullFromAddress, phone: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="555-123-4567"
                />
              </div>
            </div>
          </div>
          )}

          {/* To Address - Full Rates Mode */}
          {rateMode === 'full' && (
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3">To Address</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={fullToAddress.name}
                  onChange={(e) => setFullToAddress({ ...fullToAddress, name: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={fullToAddress.company}
                  onChange={(e) => setFullToAddress({ ...fullToAddress, company: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Tech Corp"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Street Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullToAddress.street1}
                  onChange={(e) => setFullToAddress({ ...fullToAddress, street1: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="456 Oak Ave"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Street Address 2</label>
                <input
                  type="text"
                  value={fullToAddress.street2}
                  onChange={(e) => setFullToAddress({ ...fullToAddress, street2: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Apt 2B"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullToAddress.city}
                  onChange={(e) => setFullToAddress({ ...fullToAddress, city: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Los Angeles"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullToAddress.state}
                  onChange={(e) => setFullToAddress({ ...fullToAddress, state: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="CA"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  ZIP Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullToAddress.zip}
                  onChange={(e) => setFullToAddress({ ...fullToAddress, zip: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="90210"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={fullToAddress.country}
                  onChange={(e) => setFullToAddress({ ...fullToAddress, country: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="US"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={fullToAddress.phone}
                  onChange={(e) => setFullToAddress({ ...fullToAddress, phone: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="555-987-6543"
                />
              </div>
            </div>
          </div>
          )}

          {/* Cartons - Quick/Full modes only */}
          {(rateMode === 'quick' || rateMode === 'full') && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">Cartons</h2>
              <button
                type="button"
                onClick={addCarton}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Carton
              </button>
            </div>

            <div className="space-y-3">
              {cartons.map((carton, index) => (
                <div key={index} className="border border-gray-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-gray-900">Carton {index + 1}</h3>
                    {cartons.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCarton(index)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Qty
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={carton.qty}
                        onChange={(e) => updateCarton(index, 'qty', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Weight (lb) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={carton.weight}
                        onChange={(e) => updateCarton(index, 'weight', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="1.0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Length (in)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={carton.length}
                        onChange={(e) => updateCarton(index, 'length', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="12"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Width (in)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={carton.width}
                        onChange={(e) => updateCarton(index, 'width', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="8"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Height (in)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={carton.height}
                        onChange={(e) => updateCarton(index, 'height', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="6"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Options - Quick/Full modes only */}
          {(rateMode === 'quick' || rateMode === 'full') && (
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Shipping Options</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ship Date</label>
                <input
                  type="date"
                  value={shipDate}
                  onChange={(e) => setShipDate(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Confirmation</label>
                <select
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="none">None</option>
                  <option value="delivery">Delivery</option>
                  <option value="signature">Signature</option>
                  <option value="adult_signature">Adult Signature</option>
                  <option value="direct_signature">Direct Signature</option>
                </select>
              </div>
              {rateMode === 'quick' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Address Type</label>
                <select
                  value={residential}
                  onChange={(e) => setResidential(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="unknown">Unknown</option>
                  <option value="yes">Residential</option>
                  <option value="no">Commercial</option>
                </select>
              </div>
              )}
            </div>
          </div>
          )}

          {/* Submit Button - Quick/Full modes only */}
          {(rateMode === 'quick' || rateMode === 'full') && (
          <button
            onClick={handleGetRates}
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors text-sm"
          >
            {loading ? 'Getting Rates...' : rateMode === 'quick' ? 'Get Quick Estimates' : 'Get Full Rates'}
          </button>
          )}


          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-red-800 font-medium">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Results */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4 sticky top-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">Rate Estimates</h2>
              {rates.length > 0 && rates.some(r => r.hasMarkup) && (
                <div className="flex items-center bg-gray-100 rounded-full p-0.5">
                  <button
                    onClick={() => setHideMarkup(false)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      !hideMarkup
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Customer Price
                  </button>
                  <button
                    onClick={() => setHideMarkup(true)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      hideMarkup
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Our Cost
                  </button>
                </div>
              )}
            </div>

            {rates.length === 0 ? (
              <div className="text-center py-6">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-gray-500">No rates available yet.</p>
                <p className="text-xs text-gray-400 mt-0.5">Fill in the form and click "Get Rate Estimates"</p>
              </div>
            ) : (
              <>
                {/* Expand/Collapse All Button */}
                <button
                  onClick={toggleAllCarriers}
                  className="w-full mb-2 px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center justify-center gap-1"
                >
                  {expandedCarriers.size === groupedRates.size ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      Collapse All
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Expand All
                    </>
                  )}
                </button>

                <div className="space-y-2 max-h-[calc(100vh-14rem)] overflow-y-auto">
                  {sortedCarriers.map(([carrier, carrierRates]) => {
                    const isExpanded = expandedCarriers.has(carrier)
                    const cheapestRate = Math.min(...carrierRates.map(r => hideMarkup ? r.amount - (r.markupAmount || 0) - (r.processingCost || 0) : r.amount))
                    const rateCount = carrierRates.length

                    return (
                      <div key={carrier} className="border border-gray-200 rounded overflow-hidden">
                        {/* Carrier Header */}
                        <button
                          onClick={() => toggleCarrier(carrier)}
                          className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <svg
                              className={`w-3.5 h-3.5 text-gray-600 flex-shrink-0 transition-transform ${
                                isExpanded ? 'rotate-90' : ''
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <div className="text-left flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-900 truncate">{carrier}</p>
                              <p className="text-xs text-gray-500">
                                {rateCount} {rateCount === 1 ? 'service' : 'services'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <p className="text-xs text-gray-500">from</p>
                            <p className="text-sm font-bold text-blue-600">${cheapestRate.toFixed(2)}</p>
                          </div>
                        </button>

                        {/* Carrier Services */}
                        {isExpanded && (
                          <div className="bg-white divide-y divide-gray-100">
                            {carrierRates
                              .sort((a, b) => a.amount - b.amount)
                              .map((rate, index) => {
                                const hasBreakdown = rate.shippingAmount !== undefined || (rate.rateDetails && rate.rateDetails.length > 0)
                                return (
                                <div key={index} className="px-3 py-2.5 hover:bg-blue-50 transition-colors">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-gray-900 truncate">{rate.service}</p>
                                      {rate.deliveryDays && (
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          {rate.deliveryDays} {rate.deliveryDays === 1 ? 'day' : 'days'}
                                        </p>
                                      )}
                                      {!hideMarkup && rate.hasMarkup && rate.markupAmount !== undefined && rate.markupAmount > 0 && (
                                        <p className="text-xs text-blue-600 mt-0.5 font-medium">
                                          Markup: ${rate.markupAmount.toFixed(2)}
                                        </p>
                                      )}
                                      {!hideMarkup && rate.processingCost !== undefined && rate.processingCost > 0 && (
                                        <p className="text-xs text-green-600 mt-0.5 font-medium">
                                          Processing: ${rate.processingCost.toFixed(2)}
                                        </p>
                                      )}
                                    </div>
                                    <p className="text-base font-bold text-gray-900 ml-2 flex-shrink-0">
                                      ${(hideMarkup ? rate.amount - (rate.markupAmount || 0) - (rate.processingCost || 0) : rate.amount).toFixed(2)}
                                    </p>
                                  </div>

                                  {/* Cost Breakdown (Full Rates mode only) */}
                                  {hasBreakdown && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                      <p className="text-xs font-medium text-gray-600 mb-1">Cost Breakdown:</p>
                                      <div className="space-y-0.5 text-xs text-gray-500">
                                        {/* Show rateDetails if available (detailed breakdown from carrier) */}
                                        {rate.rateDetails && rate.rateDetails.length > 0 ? (
                                          rate.rateDetails.map((detail, detailIndex) => (
                                            <div key={detailIndex} className="flex justify-between">
                                              <span className="truncate pr-2" title={detail.description}>
                                                {detail.description || detail.type}
                                              </span>
                                              <span className="flex-shrink-0">${detail.amount.toFixed(2)}</span>
                                            </div>
                                          ))
                                        ) : (
                                          /* Fallback to basic breakdown if no rateDetails */
                                          <>
                                            {rate.shippingAmount !== undefined && rate.shippingAmount > 0 && (
                                              <div className="flex justify-between">
                                                <span>Shipping</span>
                                                <span>${rate.shippingAmount.toFixed(2)}</span>
                                              </div>
                                            )}
                                            {rate.insuranceAmount !== undefined && rate.insuranceAmount > 0 && (
                                              <div className="flex justify-between">
                                                <span>Insurance</span>
                                                <span>${rate.insuranceAmount.toFixed(2)}</span>
                                              </div>
                                            )}
                                            {rate.confirmationAmount !== undefined && rate.confirmationAmount > 0 && (
                                              <div className="flex justify-between">
                                                <span>Confirmation</span>
                                                <span>${rate.confirmationAmount.toFixed(2)}</span>
                                              </div>
                                            )}
                                            {rate.otherAmount !== undefined && rate.otherAmount > 0 && (
                                              <div className="flex justify-between">
                                                <span>Other Fees</span>
                                                <span>${rate.otherAmount.toFixed(2)}</span>
                                              </div>
                                            )}
                                          </>
                                        )}
                                        {/* Show markup (percentage) if applicable */}
                                        {!hideMarkup && rate.markupAmount !== undefined && rate.markupAmount > 0 && (
                                          <div className="flex justify-between text-blue-600 font-medium border-t border-gray-100 pt-1 mt-1">
                                            <span>Markup</span>
                                            <span>${rate.markupAmount.toFixed(2)}</span>
                                          </div>
                                        )}
                                        {/* Show processing fee (fixed dollar) if applicable */}
                                        {!hideMarkup && rate.processingCost !== undefined && rate.processingCost > 0 && (
                                          <div className="flex justify-between text-green-600 font-medium pt-0.5">
                                            <span>Processing Fee</span>
                                            <span>${rate.processingCost.toFixed(2)}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )})}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

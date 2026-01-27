'use client'

import { useState, useEffect } from 'react'

type RateMode = 'quick' | 'full'

interface Carton {
  length: string
  width: string
  height: string
  weight: string
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
  markupPercent?: number
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
    { length: '', width: '', height: '', weight: '' },
  ])

  const [shipDate, setShipDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [confirmation, setConfirmation] = useState<string>('none')
  const [residential, setResidential] = useState<string>('unknown')

  const [rates, setRates] = useState<RateEstimate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedCarriers, setExpandedCarriers] = useState<Set<string>>(new Set())

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

  const addCarton = () => {
    setCartons([...cartons, { length: '', width: '', height: '', weight: '' }])
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

      const response = await fetch('/api/shipstation/rate-estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddress,
          toAddress,
          cartons,
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

      // Build packages array
      const packages = cartons.map((carton) => ({
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
          residential,
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
        hasMarkup: rate.hasProcessingCost,
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
        ) : (
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
        )}
      </div>

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

          {/* Cartons */}
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

                  <div className="grid grid-cols-4 gap-2">
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

          {/* Options */}
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
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleGetRates}
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors text-sm"
          >
            {loading ? 'Getting Rates...' : rateMode === 'quick' ? 'Get Quick Estimates' : 'Get Full Rates'}
          </button>

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
            <h2 className="text-sm font-bold text-gray-900 mb-3">Rate Estimates</h2>

            {/* Markup Notice */}
            {rates.length > 0 && rates.some(r => r.hasMarkup) && (
              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                <div className="flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>Markup included in displayed rates</span>
                </div>
              </div>
            )}

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
                    const cheapestRate = Math.min(...carrierRates.map(r => r.amount))
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
                                      {rate.hasMarkup && (
                                        <p className="text-xs text-blue-600 mt-0.5 font-medium">
                                          Markup included
                                        </p>
                                      )}
                                    </div>
                                    <p className="text-base font-bold text-gray-900 ml-2 flex-shrink-0">
                                      ${rate.amount.toFixed(2)}
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
                                        {/* Show processing cost (markup) if applicable */}
                                        {rate.processingCost !== undefined && rate.processingCost > 0 && (
                                          <div className="flex justify-between text-blue-600 font-medium border-t border-gray-100 pt-1 mt-1">
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
    </div>
  )
}

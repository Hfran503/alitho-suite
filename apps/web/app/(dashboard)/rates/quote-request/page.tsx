'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface CarrierServiceMapping {
  id: string
  shipstationCarrierId: string
  shipstationCarrierCode: string
  shipstationServiceCode: string
  carrierName: string
  serviceName: string
}

interface Package {
  qty: string
  weight: string
  length: string
  width: string
  height: string
}


export default function QuoteRequestPage() {
  const router = useRouter()

  // Carrier/service
  const [mappings, setMappings] = useState<CarrierServiceMapping[]>([])
  const [loadingMappings, setLoadingMappings] = useState(true)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [referenceNumber, setReferenceNumber] = useState('')

  // From address (loaded from ShipStation settings)
  const [fromAddress, setFromAddress] = useState({
    postalCode: '',
    city: '',
    state: '',
    countryCode: 'US',
  })
  const [loadingDefaults, setLoadingDefaults] = useState(true)

  // Destination (furthest zone)
  const [destination, setDestination] = useState({
    postalCode: '',
    city: '',
    state: '',
    countryCode: 'US',
  })

  // Options
  const [residential, setResidential] = useState(true)
  const [addressCount, setAddressCount] = useState('1')
  const [shipDate, setShipDate] = useState(new Date().toISOString().split('T')[0])
  const [confirmation, setConfirmation] = useState('none')

  // Packages
  const [packages, setPackages] = useState<Package[]>([
    { qty: '1', weight: '', length: '', width: '', height: '' },
  ])

  // State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load carrier service mappings
  useEffect(() => {
    const fetchMappings = async () => {
      try {
        const res = await fetch('/api/settings/carrier-services')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            setMappings(data.data)
          }
        }
      } catch (err) {
        console.error('Failed to load carrier services:', err)
      } finally {
        setLoadingMappings(false)
      }
    }
    fetchMappings()
  }, [])

  // Load default from address
  useEffect(() => {
    const fetchDefaults = async () => {
      try {
        const res = await fetch('/api/integrations/shipstation')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data?.config?.defaultFromAddress) {
            const addr = data.data.config.defaultFromAddress
            setFromAddress({
              postalCode: addr.zip || '',
              city: addr.city || '',
              state: addr.state || '',
              countryCode: addr.country || 'US',
            })
          }
        }
      } catch (err) {
        console.error('Failed to load default address:', err)
      } finally {
        setLoadingDefaults(false)
      }
    }
    fetchDefaults()
  }, [])


  const addPackage = () => {
    setPackages([...packages, { qty: '1', weight: '', length: '', width: '', height: '' }])
  }

  const removePackage = (index: number) => {
    if (packages.length > 1) {
      setPackages(packages.filter((_, i) => i !== index))
    }
  }

  const updatePackage = (index: number, field: keyof Package, value: string) => {
    const updated = [...packages]
    updated[index][field] = value
    setPackages(updated)
  }

  const toggleService = (key: string) => {
    setSelectedServices((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    )
  }

  const toggleCarrier = (carrierName: string) => {
    const carrierKeys = mappings
      .filter((m) => m.carrierName === carrierName)
      .map((m) => `${m.shipstationCarrierId}|${m.shipstationServiceCode}`)

    const allSelected = carrierKeys.every((k) => selectedServices.includes(k))

    if (allSelected) {
      setSelectedServices((prev) => prev.filter((s) => !carrierKeys.includes(s)))
    } else {
      setSelectedServices((prev) => [...new Set([...prev, ...carrierKeys])])
    }
  }

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)

    try {
      if (selectedServices.length === 0) {
        throw new Error('Please select at least one carrier/service')
      }
      if (!fromAddress.postalCode || !fromAddress.city || !fromAddress.state) {
        throw new Error('Please fill in the From address (ZIP, City, State)')
      }
      if (!destination.postalCode || !destination.city || !destination.state) {
        throw new Error('Please fill in the Furthest Zone destination (ZIP, City, State)')
      }

      for (let i = 0; i < packages.length; i++) {
        if (!packages[i].weight || parseFloat(packages[i].weight) <= 0) {
          throw new Error(`Package ${i + 1}: Weight is required`)
        }
      }

      const numAddresses = parseInt(addressCount) || 1
      if (numAddresses < 1) {
        throw new Error('Number of addresses must be at least 1')
      }

      // Build services array from selected keys
      const services = selectedServices.map((key) => {
        const [carrierId, serviceCode] = key.split('|')
        const mapping = mappings.find(
          (m) => m.shipstationCarrierId === carrierId && m.shipstationServiceCode === serviceCode
        )
        return {
          carrierId,
          serviceCode,
          carrierName: mapping?.carrierName || carrierId,
          serviceName: mapping?.serviceName || serviceCode,
        }
      })

      const res = await fetch('/api/rates/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceNumber,
          services,
          fromAddress,
          toAddress: destination,
          residential,
          addressCount: numAddresses,
          packages,
          shipDate,
          confirmation,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to create quote request')
      }

      const data = await res.json()
      const record = data.data

      // Navigate to the detail page automatically
      router.push(`/rates/quote-requests/${record.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to submit quote request')
    } finally {
      setLoading(false)
    }
  }

  // Group mappings by carrier for checkbox UI
  const carrierGroups = Array.from(new Set(mappings.map((m) => m.carrierName)))

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Shipping Quote Request</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Get a worst-case shipping estimate using the furthest zone on a distribution list.
          </p>
        </div>
        <Link
          href="/rates/quote-requests"
          className="text-sm text-amber-600 hover:text-amber-800 font-medium"
        >
          View All Requests →
        </Link>
      </div>

      <div className="space-y-4">
        {/* Ref # and Carrier/Service */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="mb-3">
            <label className="block text-sm font-bold text-gray-900 mb-1">Ref # / Job #</label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="e.g., JOB-1234, Proposal # 10520 or PO-5678"
            />
          </div>
          <h2 className="text-sm font-bold text-gray-900 mb-2">
            Carrier / Service <span className="text-red-500">*</span>
            {selectedServices.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({selectedServices.length} selected)
              </span>
            )}
          </h2>
          {loadingMappings ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading carriers...
            </div>
          ) : mappings.length === 0 ? (
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
              No carrier services configured. Go to Settings to add carrier service mappings.
            </div>
          ) : (
            <div className="space-y-2">
              {carrierGroups.map((carrierName) => {
                const carrierMappings = mappings.filter((m) => m.carrierName === carrierName)
                const carrierKeys = carrierMappings.map(
                  (m) => `${m.shipstationCarrierId}|${m.shipstationServiceCode}`
                )
                const allSelected = carrierKeys.every((k) => selectedServices.includes(k))
                const someSelected = carrierKeys.some((k) => selectedServices.includes(k))

                return (
                  <div key={carrierName} className="border border-gray-200 rounded p-2.5">
                    <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected && !allSelected
                        }}
                        onChange={() => toggleCarrier(carrierName)}
                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm font-semibold text-gray-900">{carrierName}</span>
                    </label>
                    <div className="ml-6 grid grid-cols-2 gap-x-4 gap-y-1">
                      {carrierMappings.map((m) => {
                        const key = `${m.shipstationCarrierId}|${m.shipstationServiceCode}`
                        return (
                          <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedServices.includes(key)}
                              onChange={() => toggleService(key)}
                              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span className="text-sm text-gray-700">{m.serviceName}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Addresses Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* From Address */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-900">From Address</h2>
              {!loadingDefaults && fromAddress.postalCode && (
                <span className="text-xs text-gray-400">From settings</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ZIP <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={fromAddress.postalCode}
                  onChange={(e) => setFromAddress({ ...fromAddress, postalCode: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="94520"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={fromAddress.city}
                  onChange={(e) => setFromAddress({ ...fromAddress, city: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Concord"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={fromAddress.state}
                  onChange={(e) => setFromAddress({ ...fromAddress, state: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="CA"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={fromAddress.countryCode}
                  onChange={(e) => setFromAddress({ ...fromAddress, countryCode: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Furthest Zone Destination */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-sm font-bold text-gray-900 mb-2">
              Furthest Zone <span className="text-red-500">*</span>
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ZIP <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={destination.postalCode}
                  onChange={(e) => setDestination({ ...destination, postalCode: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="90210"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={destination.city}
                  onChange={(e) => setDestination({ ...destination, city: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Beverly Hills"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={destination.state}
                  onChange={(e) => setDestination({ ...destination, state: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="CA"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={destination.countryCode}
                  onChange={(e) => setDestination({ ...destination, countryCode: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Options Row */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Shipping Details</h2>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Address Type</label>
              <select
                value={residential ? 'yes' : 'no'}
                onChange={(e) => setResidential(e.target.value === 'yes')}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="yes">Residential</option>
                <option value="no">Commercial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                # of Addresses <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={addressCount}
                onChange={(e) => setAddressCount(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ship Date</label>
              <input
                type="date"
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Confirmation</label>
              <select
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="none">None</option>
                <option value="delivery">Delivery</option>
                <option value="signature">Signature</option>
                <option value="adult_signature">Adult Signature</option>
                <option value="direct_signature">Direct Signature</option>
              </select>
            </div>
          </div>
        </div>

        {/* Packages */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Packages per Address</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Each of the {addressCount ? parseInt(addressCount).toLocaleString() : '—'} address{addressCount !== '1' ? 'es' : ''} will receive these packages.
              </p>
            </div>
            <button
              type="button"
              onClick={addPackage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-xs font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Package
            </button>
          </div>
          <div className="space-y-3">
            {packages.map((pkg, index) => (
              <div key={index} className="border border-gray-200 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-gray-900">Package {index + 1}</h3>
                  {packages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePackage(index)}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Qty</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={pkg.qty}
                      onChange={(e) => updatePackage(index, 'qty', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
                      value={pkg.weight}
                      onChange={(e) => updatePackage(index, 'weight', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="1.0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">L (in)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={pkg.length}
                      onChange={(e) => updatePackage(index, 'length', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="12"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">W (in)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={pkg.width}
                      onChange={(e) => updatePackage(index, 'width', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="8"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">H (in)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={pkg.height}
                      onChange={(e) => updatePackage(index, 'height', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="6"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || selectedServices.length === 0}
          className="w-full py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors text-sm"
        >
          {loading
            ? 'Getting Quotes...'
            : `Submit Quote Request${selectedServices.length > 1 ? ` (${selectedServices.length} services)` : ''}`}
        </button>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-800 font-medium">{error}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

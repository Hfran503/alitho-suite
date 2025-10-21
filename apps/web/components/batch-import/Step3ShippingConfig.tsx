'use client'

import { useState, useEffect } from 'react'

interface Step3ShippingConfigProps {
  onComplete: (config: ShippingConfig) => void
  onBack: () => void
}

interface ShippingConfig {
  carrierId: string
  carrierCode: string
  serviceCode: string
  carrier: string
  service: string
  billToParty: 'sender' | 'third_party'
  billToAccount?: string
  billToCountryCode?: string
  billToPostalCode?: string
  fromAddress: any
  containsAlcohol: boolean
  saturdayDelivery: boolean
  confirmation: string
  notificationsEmail?: string
  paceShipmentTypeId: number
}

export function Step3ShippingConfig({ onComplete, onBack }: Step3ShippingConfigProps) {
  const [fromAddress, setFromAddress] = useState<any>({
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

  const [billToParty, setBillToParty] = useState<'sender' | 'third_party'>('sender')
  const [billToAccount, setBillToAccount] = useState('')
  const [billToCountryCode, setBillToCountryCode] = useState('US')
  const [billToPostalCode, setBillToPostalCode] = useState('')

  const [containsAlcohol, setContainsAlcohol] = useState(false)
  const [saturdayDelivery, setSaturdayDelivery] = useState(false)
  const [confirmation, setConfirmation] = useState('none')
  const [notificationsEmail, setNotificationsEmail] = useState('')
  const [paceShipmentTypeId, setPaceShipmentTypeId] = useState(202)

  const [rates, setRates] = useState<any[]>([])
  const [selectedRate, setSelectedRate] = useState<any>(null)
  const [loadingRates, setLoadingRates] = useState(false)
  const [error, setError] = useState('')
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)

  // Load default from address from ShipStation integration
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

  const handleGetRates = async () => {
    setError('')
    setLoadingRates(true)

    try {
      // Sample package for getting rates
      const samplePackage = {
        weight: 5,
        length: 12,
        width: 8,
        height: 6,
        weightUnit: 'pound',
        dimensionUnit: 'inch',
      }

      // Sample destination (you might want to use the first row from uploaded data)
      const sampleDestination = {
        street1: '1600 Amphitheatre Parkway',
        city: 'Mountain View',
        state: 'CA',
        zip: '94043',
        country: 'US',
      }

      const response = await fetch('/api/shipstation/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipFrom: fromAddress,
          shipTo: sampleDestination,
          packages: [samplePackage],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get shipping rates')
      }

      const data = await response.json()
      console.log('📦 Rates received:', data.data.rates)
      setRates(data.data.rates || [])
    } catch (err: any) {
      setError(err.message || 'Failed to get shipping rates')
    } finally {
      setLoadingRates(false)
    }
  }

  const handleContinue = () => {
    if (!selectedRate) {
      setError('Please select a shipping service')
      return
    }

    console.log('🚀 Selected rate:', selectedRate)
    console.log('🚀 Shipping config being sent:', {
      carrierId: selectedRate.carrierId,
      carrierCode: selectedRate.carrierCode,
      serviceCode: selectedRate.serviceCode,
      carrier: selectedRate.carrier,
      service: selectedRate.service,
    })

    const config: ShippingConfig = {
      carrierId: selectedRate.carrierId,
      carrierCode: selectedRate.carrierCode,
      serviceCode: selectedRate.serviceCode,
      carrier: selectedRate.carrier,
      service: selectedRate.service,
      billToParty,
      billToAccount: billToParty === 'third_party' ? billToAccount : undefined,
      billToCountryCode: billToParty === 'third_party' ? billToCountryCode : undefined,
      billToPostalCode: billToParty === 'third_party' ? billToPostalCode : undefined,
      fromAddress,
      containsAlcohol,
      saturdayDelivery,
      confirmation,
      notificationsEmail: notificationsEmail || undefined,
      paceShipmentTypeId,
    }

    onComplete(config)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Configure Shipping</h2>
        <p className="text-gray-600">
          Select carrier service and configure billing options for all shipments in this batch
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Ship From Address - Compact */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <h3 className="font-semibold text-gray-900 mb-2 text-sm">Ship From Address</h3>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div>
            <label className="block text-gray-600 mb-1">Company</label>
            <input
              type="text"
              value={fromAddress.company}
              onChange={(e) => setFromAddress({ ...fromAddress, company: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">Phone</label>
            <input
              type="text"
              value={fromAddress.phone}
              onChange={(e) => setFromAddress({ ...fromAddress, phone: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-gray-600 mb-1">Street Address</label>
            <input
              type="text"
              value={fromAddress.street1}
              onChange={(e) => setFromAddress({ ...fromAddress, street1: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">City</label>
            <input
              type="text"
              value={fromAddress.city}
              onChange={(e) => setFromAddress({ ...fromAddress, city: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">State</label>
            <input
              type="text"
              value={fromAddress.state}
              onChange={(e) => setFromAddress({ ...fromAddress, state: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">ZIP</label>
            <input
              type="text"
              value={fromAddress.zip}
              onChange={(e) => setFromAddress({ ...fromAddress, zip: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Advanced Options - Collapsible */}
      <div className="border border-gray-200 rounded-lg">
        <button
          type="button"
          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
        >
          <h3 className="font-semibold text-gray-900 text-sm">Advanced Options (Optional)</h3>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${showAdvancedOptions ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAdvancedOptions && (
          <div className="border-t border-gray-200 p-3 bg-gray-50 space-y-3">
            {/* Billing Options */}
            <div className="space-y-2">
              <label className="block text-gray-700 font-medium text-xs">Who pays for shipping?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="billToParty"
                    value="sender"
                    checked={billToParty === 'sender'}
                    onChange={() => setBillToParty('sender')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-xs text-gray-900">Sender (You)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="billToParty"
                    value="third_party"
                    checked={billToParty === 'third_party'}
                    onChange={() => setBillToParty('third_party')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-xs text-gray-900">Third Party</span>
                </label>
              </div>

              {billToParty === 'third_party' && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="col-span-3">
                    <label className="block text-gray-600 mb-1 text-xs">Account Number</label>
                    <input
                      type="text"
                      value={billToAccount}
                      onChange={(e) => setBillToAccount(e.target.value)}
                      placeholder="Third party account number"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 text-xs">Country Code</label>
                    <input
                      type="text"
                      value={billToCountryCode}
                      onChange={(e) => setBillToCountryCode(e.target.value)}
                      placeholder="US"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-gray-600 mb-1 text-xs">Postal Code</label>
                    <input
                      type="text"
                      value={billToPostalCode}
                      onChange={(e) => setBillToPostalCode(e.target.value)}
                      placeholder="Postal code"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Package Options */}
            <div className="space-y-2 pt-2 border-t border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={containsAlcohol}
                  onChange={(e) => setContainsAlcohol(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-xs text-gray-900">Contains Alcohol</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saturdayDelivery}
                  onChange={(e) => setSaturdayDelivery(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-xs text-gray-900">Saturday Delivery</span>
              </label>

              <div>
                <label className="block text-gray-600 mb-1 text-xs">Delivery Confirmation</label>
                <select
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="none">None</option>
                  <option value="delivery">Delivery Confirmation</option>
                  <option value="signature">Signature Required</option>
                  <option value="adult_signature">Adult Signature</option>
                  <option value="direct_signature">Direct Signature</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-600 mb-1 text-xs">Notification Email (Optional)</label>
                <input
                  type="email"
                  value={notificationsEmail}
                  onChange={(e) => setNotificationsEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="pt-2 border-t border-gray-200">
                <label className="block text-gray-600 mb-1 text-xs">
                  PACE Shipment Type ID
                </label>
                <input
                  type="number"
                  value={paceShipmentTypeId}
                  onChange={(e) => setPaceShipmentTypeId(parseInt(e.target.value) || 202)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Default: 202 for creating shipments in PACE.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Get Rates Button */}
      {rates.length === 0 && (
        <button
          onClick={handleGetRates}
          disabled={loadingRates}
          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
        >
          {loadingRates ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Getting Rates...
            </span>
          ) : (
            'Get Available Services'
          )}
        </button>
      )}

      {/* Service Selection - Grouped by Carrier */}
      {rates.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Select Service (applies to all shipments)</h3>
          <div className="grid grid-cols-3 gap-4">
            {/* Group rates by carrier */}
            {Array.from(new Set(rates.map((r) => r.carrier))).map((carrierName) => {
              const carrierRates = rates.filter((r) => r.carrier === carrierName)
              return (
                <div key={carrierName} className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-semibold text-gray-900 mb-2 text-sm">{carrierName}</h4>
                  <div className="space-y-2">
                    {carrierRates.map((rate) => (
                      <div
                        key={rate.rateId}
                        onClick={() => setSelectedRate(rate)}
                        className={`p-2 border rounded cursor-pointer transition-all text-sm ${
                          selectedRate?.rateId === rate.rateId
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                              selectedRate?.rateId === rate.rateId
                                ? 'border-blue-600 bg-blue-600'
                                : 'border-gray-300'
                            }`}
                          >
                            {selectedRate?.rateId === rate.rateId && (
                              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 text-xs leading-tight">
                              {rate.service}
                            </div>
                            {rate.deliveryDays && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {rate.deliveryDays} {rate.deliveryDays === 1 ? 'day' : 'days'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
        >
          Back
        </button>

        <button
          onClick={handleContinue}
          disabled={!selectedRate}
          className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

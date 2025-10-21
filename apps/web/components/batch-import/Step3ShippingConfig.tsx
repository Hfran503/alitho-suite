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

  const [rates, setRates] = useState<any[]>([])
  const [selectedRate, setSelectedRate] = useState<any>(null)
  const [loadingRates, setLoadingRates] = useState(false)
  const [error, setError] = useState('')

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

      {/* Ship From Address */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Ship From Address</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <label className="block text-gray-700 font-medium mb-1">Company</label>
            <input
              type="text"
              value={fromAddress.company}
              onChange={(e) => setFromAddress({ ...fromAddress, company: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">Phone</label>
            <input
              type="text"
              value={fromAddress.phone}
              onChange={(e) => setFromAddress({ ...fromAddress, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-gray-700 font-medium mb-1">Street Address</label>
            <input
              type="text"
              value={fromAddress.street1}
              onChange={(e) => setFromAddress({ ...fromAddress, street1: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">City</label>
            <input
              type="text"
              value={fromAddress.city}
              onChange={(e) => setFromAddress({ ...fromAddress, city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-gray-700 font-medium mb-1">State</label>
              <input
                type="text"
                value={fromAddress.state}
                onChange={(e) => setFromAddress({ ...fromAddress, state: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">ZIP</label>
              <input
                type="text"
                value={fromAddress.zip}
                onChange={(e) => setFromAddress({ ...fromAddress, zip: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Billing Options */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Billing Options</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-gray-700 font-medium mb-2">Who pays for shipping?</label>
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
                <span className="text-sm font-medium text-gray-900">Sender (You)</span>
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
                <span className="text-sm font-medium text-gray-900">Third Party</span>
              </label>
            </div>
          </div>

          {billToParty === 'third_party' && (
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-200">
              <div className="col-span-3">
                <label className="block text-gray-700 font-medium mb-1">Account Number</label>
                <input
                  type="text"
                  value={billToAccount}
                  onChange={(e) => setBillToAccount(e.target.value)}
                  placeholder="Third party account number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Country Code</label>
                <input
                  type="text"
                  value={billToCountryCode}
                  onChange={(e) => setBillToCountryCode(e.target.value)}
                  placeholder="US"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-gray-700 font-medium mb-1">Postal Code</label>
                <input
                  type="text"
                  value={billToPostalCode}
                  onChange={(e) => setBillToPostalCode(e.target.value)}
                  placeholder="Postal code"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Options */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Advanced Options</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={containsAlcohol}
              onChange={(e) => setContainsAlcohol(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-900">Contains Alcohol</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saturdayDelivery}
              onChange={(e) => setSaturdayDelivery(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-900">Saturday Delivery</span>
          </label>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Delivery Confirmation</label>
            <select
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="none">None</option>
              <option value="delivery">Delivery Confirmation</option>
              <option value="signature">Signature Required</option>
              <option value="adult_signature">Adult Signature</option>
              <option value="direct_signature">Direct Signature</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Notification Email (Optional)</label>
            <input
              type="email"
              value={notificationsEmail}
              onChange={(e) => setNotificationsEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
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

      {/* Service Selection */}
      {rates.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Select Service (applies to all shipments)</h3>
          {rates.map((rate) => (
            <div
              key={rate.rateId}
              onClick={() => setSelectedRate(rate)}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                selectedRate?.rateId === rate.rateId
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedRate?.rateId === rate.rateId
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedRate?.rateId === rate.rateId && (
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
                      Estimated delivery: {rate.deliveryDays}{' '}
                      {rate.deliveryDays === 1 ? 'day' : 'days'}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">${rate.amount.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{rate.currency}</div>
                </div>
              </div>
            </div>
          ))}
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

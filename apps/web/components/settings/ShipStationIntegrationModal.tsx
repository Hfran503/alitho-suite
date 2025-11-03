'use client'

import { useState, useEffect } from 'react'
import { Modal } from '../Modal'

interface ShipStationIntegrationModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export default function ShipStationIntegrationModal({
  isOpen,
  onClose,
  onSave,
}: ShipStationIntegrationModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [testApiKey, setTestApiKey] = useState('')
  const [productionApiKey, setProductionApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [mode, setMode] = useState<'test' | 'production'>('test')
  const [carriers, setCarriers] = useState<Array<{ id: string; name: string; estimateRateMarkup?: number; estimateRateMarkupDollar?: number; trackingUrlTemplate?: string }>>([
    { id: '', name: '', estimateRateMarkup: 0, estimateRateMarkupDollar: 0, trackingUrlTemplate: '' },
  ])
  const [isConfigured, setIsConfigured] = useState(false)
  const [enabled, setEnabled] = useState(false)

  // Default ship-from address
  const [defaultFromAddress, setDefaultFromAddress] = useState({
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

  useEffect(() => {
    if (isOpen) {
      checkConfiguration()
    }
  }, [isOpen])

  const checkConfiguration = async () => {
    try {
      const response = await fetch('/api/integrations/shipstation')
      if (response.ok) {
        const data = await response.json()
        setIsConfigured(data.data?.configured || false)
        setEnabled(data.data?.enabled || false)

        if (data.data?.config) {
          setMode(data.data.config.mode || 'test')

          // Load carriers from config
          if (data.data.config.carriers && Array.isArray(data.data.config.carriers)) {
            setCarriers(
              data.data.config.carriers.length > 0
                ? data.data.config.carriers.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    estimateRateMarkup: c.estimateRateMarkup ?? 0,
                    estimateRateMarkupDollar: c.estimateRateMarkupDollar ?? 0,
                    trackingUrlTemplate: c.trackingUrlTemplate ?? ''
                  }))
                : [{ id: '', name: '', estimateRateMarkup: 0, estimateRateMarkupDollar: 0, trackingUrlTemplate: '' }]
            )
          } else if (data.data.config.carrierIds) {
            // Legacy support: convert old carrierIds array to new format
            setCarriers(data.data.config.carrierIds.map((id: string) => ({ id, name: '', estimateRateMarkup: 0, estimateRateMarkupDollar: 0, trackingUrlTemplate: '' })))
          }

          // Load default ship-from address
          if (data.data.config.defaultFromAddress) {
            setDefaultFromAddress(data.data.config.defaultFromAddress)
          }
        }

        // Show masked keys as placeholders if they exist
        if (data.data?.maskedTestKey) {
          setTestApiKey(data.data.maskedTestKey)
        }
        if (data.data?.maskedProductionKey) {
          setProductionApiKey(data.data.maskedProductionKey)
        }
      }
    } catch (error) {
      console.error('Failed to check configuration:', error)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsLoading(true)

    try {
      // Check if EasyPost is active - mutual exclusivity
      const easypostResponse = await fetch('/api/integrations/easypost')
      if (easypostResponse.ok) {
        const easypostData = await easypostResponse.json()
        if (easypostData.data?.enabled) {
          setError(
            'EasyPost integration is currently active. Please disable EasyPost before enabling ShipStation.'
          )
          setIsLoading(false)
          return
        }
      }

      // Only send API keys if they're not masked (i.e., they've been changed)
      const isMaskedTest = testApiKey.includes('...')
      const isMaskedProduction = productionApiKey.includes('...')

      // Filter out empty carriers
      const filteredCarriers = carriers.filter((c) => c.id.trim() !== '')

      if (filteredCarriers.length === 0) {
        setError('Please add at least one carrier')
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/integrations/shipstation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testApiKey: !isMaskedTest && testApiKey.trim() ? testApiKey.trim() : undefined,
          productionApiKey:
            !isMaskedProduction && productionApiKey.trim() ? productionApiKey.trim() : undefined,
          enabled,
          config: {
            mode,
            carriers: filteredCarriers,
            // Also send carrierIds for backwards compatibility with the rates endpoint
            carrierIds: filteredCarriers.map((c) => c.id),
            defaultFromAddress,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save configuration')
      }

      setSuccess('ShipStation configuration saved successfully!')
      setTimeout(() => {
        onSave()
        onClose()
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setError(null)
    setSuccess(null)
    setIsTesting(true)

    try {
      const apiKey = mode === 'test' ? testApiKey : productionApiKey

      // Don't allow testing with masked keys
      if (apiKey.includes('...')) {
        setError(
          `Please enter a new ${mode} API key to test. The current key is masked for security.`
        )
        setIsTesting(false)
        return
      }

      if (!apiKey.trim()) {
        setError(`Please enter a ${mode} API key`)
        setIsTesting(false)
        return
      }

      const response = await fetch('/api/integrations/shipstation/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim(), mode }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Connection test failed')
      }

      setSuccess('Connection successful!')
    } catch (err: any) {
      setError(err.message || 'Connection test failed')
    } finally {
      setIsTesting(false)
    }
  }

  const addCarrier = () => {
    setCarriers([...carriers, { id: '', name: '', estimateRateMarkup: 0, estimateRateMarkupDollar: 0, trackingUrlTemplate: '' }])
  }

  const removeCarrier = (index: number) => {
    const newCarriers = carriers.filter((_, i) => i !== index)
    setCarriers(newCarriers.length > 0 ? newCarriers : [{ id: '', name: '', estimateRateMarkup: 0, estimateRateMarkupDollar: 0, trackingUrlTemplate: '' }])
  }

  const updateCarrier = (index: number, field: 'id' | 'name' | 'estimateRateMarkup' | 'estimateRateMarkupDollar' | 'trackingUrlTemplate', value: string | number) => {
    const newCarriers = [...carriers]
    if (field === 'estimateRateMarkup' || field === 'estimateRateMarkupDollar') {
      newCarriers[index][field] = typeof value === 'number' ? value : parseFloat(value) || 0
    } else {
      newCarriers[index][field] = value as string
    }
    setCarriers(newCarriers)
  }

  const currentApiKey = mode === 'test' ? testApiKey : productionApiKey
  const setCurrentApiKey = mode === 'test' ? setTestApiKey : setProductionApiKey

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ShipStation Integration Settings" size="xl">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Success Message */}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-green-600 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="text-sm text-green-800">{success}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-red-600 flex-shrink-0"
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

        {/* Enable/Disable Toggle */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Enable Integration</h4>
              <p className="text-xs text-gray-500 mt-1">
                {enabled
                  ? 'ShipStation is active and will be used for shipping'
                  : 'Integration is disabled. Enable to start using ShipStation'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                enabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-900 mb-3">
            Environment Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label
              className={`relative flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                mode === 'test'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                value="test"
                checked={mode === 'test'}
                onChange={(e) => setMode(e.target.value as 'test' | 'production')}
                className="sr-only"
              />
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900">Test Mode</div>
                <div className="text-xs text-gray-500 mt-1">Sandbox environment</div>
              </div>
              {mode === 'test' && (
                <div className="absolute top-2 right-2">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </label>
            <label
              className={`relative flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                mode === 'production'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                value="production"
                checked={mode === 'production'}
                onChange={(e) => setMode(e.target.value as 'test' | 'production')}
                className="sr-only"
              />
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900">Production</div>
                <div className="text-xs text-gray-500 mt-1">Live environment</div>
              </div>
              {mode === 'production' && (
                <div className="absolute top-2 right-2">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* API Key Input - Only show for selected mode */}
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
            {mode === 'test' ? 'Test' : 'Production'} API Key
            <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              id="apiKey"
              value={currentApiKey}
              onChange={(e) => setCurrentApiKey(e.target.value)}
              className="w-full px-4 py-3 pr-24 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder={mode === 'test' ? 'TEST_xxxxx...' : 'PROD_xxxxx...'}
              required
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !currentApiKey.trim()}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTesting ? 'Testing...' : 'Test'}
              </button>
              <div className="w-px h-4 bg-gray-300" />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Get your API key from{' '}
            <a
              href="https://www.shipengine.com/docs/auth/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              ShipStation Dashboard
            </a>
            . Keys are securely stored in AWS Secrets Manager.
          </p>
        </div>

        {/* Carriers */}
        <div className="space-y-3 pt-6 border-t border-gray-200">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Carriers</h4>
            <p className="text-xs text-gray-500 mt-1">
              Add carriers for rate shopping. Find carrier IDs in your ShipStation account. Tracking URL template uses {'{tracking}'} as placeholder.
            </p>
          </div>
          <div className="space-y-2 overflow-x-auto">
            {/* Table Headers */}
            <div className="grid grid-cols-[1fr_1fr_100px_100px_2fr_auto] gap-2 items-center px-2 pb-2 border-b border-gray-200 min-w-[900px]">
              <div className="text-xs font-medium text-gray-700">Name</div>
              <div className="text-xs font-medium text-gray-700">Carrier ID</div>
              <div className="text-xs font-medium text-gray-700">Markup %</div>
              <div className="text-xs font-medium text-gray-700">Markup $</div>
              <div className="text-xs font-medium text-gray-700">Tracking URL Template</div>
              <div className="w-10"></div>
            </div>

            {/* Carrier Rows */}
            {carriers.map((carrier, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_100px_100px_2fr_auto] gap-2 items-center min-w-[900px]">
                <input
                  type="text"
                  value={carrier.name}
                  onChange={(e) => updateCarrier(index, 'name', e.target.value)}
                  placeholder="Carrier name (e.g., UPS)"
                  className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <input
                  type="text"
                  value={carrier.id}
                  onChange={(e) => updateCarrier(index, 'id', e.target.value)}
                  placeholder="Carrier ID (e.g., se-123456)"
                  className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  required
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={carrier.estimateRateMarkup ?? 0}
                    onChange={(e) => updateCarrier(index, 'estimateRateMarkup', e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-500">$</span>
                  <input
                    type="number"
                    value={carrier.estimateRateMarkupDollar ?? 0}
                    onChange={(e) => updateCarrier(index, 'estimateRateMarkupDollar', e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <input
                  type="text"
                  value={carrier.trackingUrlTemplate ?? ''}
                  onChange={(e) => updateCarrier(index, 'trackingUrlTemplate', e.target.value)}
                  placeholder="https://www.ups.com/track?tracknum={tracking}"
                  className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono"
                />
                {carriers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCarrier(index)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove carrier"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addCarrier}
            className="w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
          >
            + Add Another Carrier
          </button>
        </div>

        {/* Default Ship-From Address */}
        <div className="space-y-4 pt-6 border-t border-gray-200">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Default Ship-From Address</h4>
            <p className="text-xs text-gray-500 mt-1">
              Pre-fill this address when processing shipments
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={defaultFromAddress.name}
              onChange={(e) =>
                setDefaultFromAddress({ ...defaultFromAddress, name: e.target.value })
              }
              placeholder="Contact Name"
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <input
              type="text"
              value={defaultFromAddress.company}
              onChange={(e) =>
                setDefaultFromAddress({ ...defaultFromAddress, company: e.target.value })
              }
              placeholder="Company Name"
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <input
              type="text"
              value={defaultFromAddress.street1}
              onChange={(e) =>
                setDefaultFromAddress({ ...defaultFromAddress, street1: e.target.value })
              }
              placeholder="Street Address 1"
              className="col-span-2 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <input
              type="text"
              value={defaultFromAddress.street2}
              onChange={(e) =>
                setDefaultFromAddress({ ...defaultFromAddress, street2: e.target.value })
              }
              placeholder="Street Address 2 (optional)"
              className="col-span-2 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <input
              type="text"
              value={defaultFromAddress.city}
              onChange={(e) =>
                setDefaultFromAddress({ ...defaultFromAddress, city: e.target.value })
              }
              placeholder="City"
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <input
              type="text"
              value={defaultFromAddress.state}
              onChange={(e) =>
                setDefaultFromAddress({ ...defaultFromAddress, state: e.target.value })
              }
              placeholder="State"
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <input
              type="text"
              value={defaultFromAddress.zip}
              onChange={(e) =>
                setDefaultFromAddress({ ...defaultFromAddress, zip: e.target.value })
              }
              placeholder="ZIP Code"
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <input
              type="tel"
              value={defaultFromAddress.phone}
              onChange={(e) =>
                setDefaultFromAddress({ ...defaultFromAddress, phone: e.target.value })
              }
              placeholder="Phone"
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium transition-colors"
            >
              Cancel
            </button>
          <button
            type="submit"
            disabled={isLoading || !currentApiKey.trim()}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
          >
            {isLoading ? 'Saving...' : isConfigured ? 'Update Configuration' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

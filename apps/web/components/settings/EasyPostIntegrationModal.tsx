'use client'

import { useState, useEffect } from 'react'
import { Modal } from '../Modal'

interface EasyPostIntegrationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function EasyPostIntegrationModal({
  isOpen,
  onClose,
  onSuccess,
}: EasyPostIntegrationModalProps) {
  const [mode, setMode] = useState<'test' | 'production'>('test')
  const [testApiKey, setTestApiKey] = useState('')
  const [productionApiKey, setProductionApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [testResult, setTestResult] = useState<{
    valid: boolean
    accountName?: string
    accountEmail?: string
  } | null>(null)

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
    email: '',
  })

  useEffect(() => {
    if (isOpen) {
      checkConfiguration()
    }
  }, [isOpen])

  const checkConfiguration = async () => {
    try {
      const response = await fetch('/api/integrations/easypost')
      if (response.ok) {
        const data = await response.json()
        setIsConfigured(data.data?.configured || false)
        setEnabled(data.data?.enabled || false)

        // Load mode and default from address if configured
        if (data.data?.config) {
          if (data.data.config.mode) {
            setMode(data.data.config.mode)
          }
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
      console.error('Error checking configuration:', error)
    }
  }

  const handleTestConnection = async () => {
    const apiKey = mode === 'test' ? testApiKey : productionApiKey

    if (!apiKey.trim()) {
      setError(`Please enter a ${mode} API key`)
      return
    }

    // Don't allow testing with masked keys
    if (apiKey.includes('...')) {
      setError(`Please enter a new ${mode} API key to test. The current key is masked for security.`)
      return
    }

    setIsTesting(true)
    setError('')
    setSuccess('')
    setTestResult(null)

    try {
      const response = await fetch('/api/integrations/easypost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setTestResult({
          valid: true,
          accountName: data.data?.accountName,
          accountEmail: data.data?.accountEmail,
        })
        setSuccess(`Connection successful!`)
      } else {
        setError(data.error || 'Invalid API key')
        setTestResult({ valid: false })
      }
    } catch (error) {
      setError('Failed to test API key. Please try again.')
      console.error('Error testing API key:', error)
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    // Validate that we have the appropriate API key for the selected mode
    if (mode === 'test' && !testApiKey.trim()) {
      setError('Please enter a test API key')
      setIsLoading(false)
      return
    }

    if (mode === 'production' && !productionApiKey.trim()) {
      setError('Please enter a production API key')
      setIsLoading(false)
      return
    }

    try {
      // Only send API keys if they're not masked (i.e., they've been changed)
      const isMaskedTest = testApiKey.includes('...')
      const isMaskedProduction = productionApiKey.includes('...')

      const response = await fetch('/api/integrations/easypost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testApiKey: !isMaskedTest && testApiKey.trim() ? testApiKey.trim() : undefined,
          productionApiKey: !isMaskedProduction && productionApiKey.trim() ? productionApiKey.trim() : undefined,
          enabled,
          config: {
            mode,
            defaultFromAddress,
          },
        }),
      })

      if (response.ok) {
        setSuccess('EasyPost integration configured successfully!')
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1500)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save integration')
      }
    } catch (error) {
      setError('An error occurred. Please try again.')
      console.error('Error saving integration:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const currentApiKey = mode === 'test' ? testApiKey : productionApiKey
  const setCurrentApiKey = mode === 'test' ? setTestApiKey : setProductionApiKey

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="EasyPost Integration Settings" size="xl">
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

        {/* Test Result */}
        {testResult && testResult.valid && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-600 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm font-medium text-blue-800">Connection successful!</p>
              </div>
              {testResult.accountName && (
                <p className="text-sm text-blue-700 ml-7">
                  Account: {testResult.accountName}
                </p>
              )}
              {testResult.accountEmail && (
                <p className="text-sm text-blue-700 ml-7">
                  Email: {testResult.accountEmail}
                </p>
              )}
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
                  ? 'EasyPost is active and will be used for shipping'
                  : 'Integration is disabled. Enable to start using EasyPost'}
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
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
              placeholder={mode === 'test' ? 'EZTK...' : 'EZAK...'}
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
              href="https://www.easypost.com/account/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              EasyPost Dashboard
            </a>
            . Keys are securely stored in AWS Secrets Manager.
          </p>
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
              onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, name: e.target.value })}
              placeholder="Contact Name"
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <input
              type="text"
              value={defaultFromAddress.company}
              onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, company: e.target.value })}
              placeholder="Company Name"
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <input
              type="text"
              value={defaultFromAddress.street1}
              onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, street1: e.target.value })}
              placeholder="Street Address 1"
              className="col-span-2 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <input
              type="text"
              value={defaultFromAddress.street2}
              onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, street2: e.target.value })}
              placeholder="Street Address 2 (optional)"
              className="col-span-2 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <input
              type="text"
              value={defaultFromAddress.city}
              onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, city: e.target.value })}
              placeholder="City"
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <input
              type="text"
              value={defaultFromAddress.state}
              onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, state: e.target.value })}
              placeholder="State"
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <input
              type="text"
              value={defaultFromAddress.zip}
              onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, zip: e.target.value })}
              placeholder="ZIP Code"
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <input
              type="tel"
              value={defaultFromAddress.phone}
              onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, phone: e.target.value })}
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

'use client'

import { useState, useEffect } from 'react'
import { Modal } from '../Modal'

interface NetSuiteIntegrationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function NetSuiteIntegrationModal({
  isOpen,
  onClose,
  onSuccess,
}: NetSuiteIntegrationModalProps) {
  const [currentMode, setCurrentMode] = useState<'sandbox' | 'production'>('sandbox')

  // Sandbox credentials
  const [sandboxAccountId, setSandboxAccountId] = useState('')
  const [sandboxConsumerKey, setSandboxConsumerKey] = useState('')
  const [sandboxConsumerSecret, setSandboxConsumerSecret] = useState('')
  const [sandboxTokenId, setSandboxTokenId] = useState('')
  const [sandboxTokenSecret, setSandboxTokenSecret] = useState('')
  const [sandboxEnabled, setSandboxEnabled] = useState(false)

  // Production credentials
  const [productionAccountId, setProductionAccountId] = useState('')
  const [productionConsumerKey, setProductionConsumerKey] = useState('')
  const [productionConsumerSecret, setProductionConsumerSecret] = useState('')
  const [productionTokenId, setProductionTokenId] = useState('')
  const [productionTokenSecret, setProductionTokenSecret] = useState('')
  const [productionEnabled, setProductionEnabled] = useState(false)

  // Webhook token for incoming NetSuite requests
  const [webhookToken, setWebhookToken] = useState('')

  const [showSecrets, setShowSecrets] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (isOpen) {
      checkConfiguration()
    }
  }, [isOpen])

  const checkConfiguration = async () => {
    try {
      const response = await fetch('/api/integrations/netsuite')
      if (response.ok) {
        const data = await response.json()
        setIsConfigured(data.data?.configured || false)
        setCurrentMode(data.data?.currentMode || 'sandbox')
        setSandboxEnabled(data.data?.sandboxEnabled || false)
        setProductionEnabled(data.data?.productionEnabled || false)

        // Load credentials (masked values for security - show first 4 and last 4)
        if (data.data?.sandboxAccountId) {
          setSandboxAccountId(data.data.sandboxAccountId)
        }
        if (data.data?.sandboxConsumerKey) {
          setSandboxConsumerKey(data.data.sandboxConsumerKey)
        }
        if (data.data?.sandboxConsumerSecret) {
          setSandboxConsumerSecret(data.data.sandboxConsumerSecret)
        }
        if (data.data?.sandboxTokenId) {
          setSandboxTokenId(data.data.sandboxTokenId)
        }
        if (data.data?.sandboxTokenSecret) {
          setSandboxTokenSecret(data.data.sandboxTokenSecret)
        }

        if (data.data?.productionAccountId) {
          setProductionAccountId(data.data.productionAccountId)
        }
        if (data.data?.productionConsumerKey) {
          setProductionConsumerKey(data.data.productionConsumerKey)
        }
        if (data.data?.productionConsumerSecret) {
          setProductionConsumerSecret(data.data.productionConsumerSecret)
        }
        if (data.data?.productionTokenId) {
          setProductionTokenId(data.data.productionTokenId)
        }
        if (data.data?.productionTokenSecret) {
          setProductionTokenSecret(data.data.productionTokenSecret)
        }

        if (data.data?.webhookToken) {
          setWebhookToken(data.data.webhookToken)
        }
      }
    } catch (error) {
      console.error('Error checking configuration:', error)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    // Validate that required fields are filled for the mode being enabled
    // (Allow masked values - they indicate existing credentials)
    if (currentMode === 'sandbox' && sandboxEnabled) {
      if (!sandboxAccountId.trim() || !sandboxConsumerKey.trim() || !sandboxConsumerSecret.trim() || !sandboxTokenId.trim() || !sandboxTokenSecret.trim()) {
        setError('Please fill in all sandbox credentials')
        setIsLoading(false)
        return
      }
    }

    if (currentMode === 'production' && productionEnabled) {
      if (!productionAccountId.trim() || !productionConsumerKey.trim() || !productionConsumerSecret.trim() || !productionTokenId.trim() || !productionTokenSecret.trim()) {
        setError('Please fill in all production credentials')
        setIsLoading(false)
        return
      }
    }

    try {
      // Helper function to check if a value is masked (either full mask or partial mask)
      const isMaskedValue = (value: string): boolean => {
        return value === '••••••••' || /^.{0,4}••••.{0,4}$/.test(value)
      }

      const requestBody: any = {
        currentMode,
        sandboxEnabled,
        productionEnabled,
      }

      // Only include sandbox credentials if they're being updated (not empty and not masked)
      if (sandboxAccountId && !isMaskedValue(sandboxAccountId)) requestBody.sandboxAccountId = sandboxAccountId
      if (sandboxConsumerKey && !isMaskedValue(sandboxConsumerKey)) requestBody.sandboxConsumerKey = sandboxConsumerKey
      if (sandboxConsumerSecret && !isMaskedValue(sandboxConsumerSecret)) requestBody.sandboxConsumerSecret = sandboxConsumerSecret
      if (sandboxTokenId && !isMaskedValue(sandboxTokenId)) requestBody.sandboxTokenId = sandboxTokenId
      if (sandboxTokenSecret && !isMaskedValue(sandboxTokenSecret)) requestBody.sandboxTokenSecret = sandboxTokenSecret

      // Only include production credentials if they're being updated (not empty and not masked)
      if (productionAccountId && !isMaskedValue(productionAccountId)) requestBody.productionAccountId = productionAccountId
      if (productionConsumerKey && !isMaskedValue(productionConsumerKey)) requestBody.productionConsumerKey = productionConsumerKey
      if (productionConsumerSecret && !isMaskedValue(productionConsumerSecret)) requestBody.productionConsumerSecret = productionConsumerSecret
      if (productionTokenId && !isMaskedValue(productionTokenId)) requestBody.productionTokenId = productionTokenId
      if (productionTokenSecret && !isMaskedValue(productionTokenSecret)) requestBody.productionTokenSecret = productionTokenSecret

      // Include webhook token if provided (not empty and not masked)
      if (webhookToken && !isMaskedValue(webhookToken)) requestBody.webhookToken = webhookToken

      const response = await fetch('/api/integrations/netsuite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(data.message || 'NetSuite integration saved successfully!')
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1500)
      } else {
        setError(data.error || 'Failed to save NetSuite integration')
      }
    } catch (error) {
      setError('An error occurred. Please try again.')
      console.error('Error saving NetSuite integration:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove the NetSuite integration? This will delete all stored credentials.')) {
      return
    }

    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/integrations/netsuite', {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('NetSuite integration removed successfully')
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1500)
      } else {
        setError(data.error || 'Failed to remove NetSuite integration')
      }
    } catch (error) {
      setError('An error occurred. Please try again.')
      console.error('Error deleting NetSuite integration:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="NetSuite Integration" size="xl">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-blue-800">OAuth 2.0 Token-Based Authentication</h3>
              <p className="mt-1 text-sm text-blue-700">
                Configure your NetSuite integration using OAuth credentials. You can set up both Sandbox and Production environments.
              </p>
            </div>
          </div>
        </div>

        {/* Current Mode Selection */}
        <div className="bg-gray-50 rounded-lg p-4">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Active Environment
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCurrentMode('sandbox')}
              className={`relative flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-all ${
                currentMode === 'sandbox'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="font-semibold text-base">Sandbox</span>
                {sandboxEnabled && (
                  <span className="text-xs mt-1 text-green-600">● Configured</span>
                )}
              </div>
              {currentMode === 'sandbox' && (
                <div className="absolute top-2 right-2">
                  <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setCurrentMode('production')}
              className={`relative flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-all ${
                currentMode === 'production'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="font-semibold text-base">Production</span>
                {productionEnabled && (
                  <span className="text-xs mt-1 text-green-600">● Configured</span>
                )}
              </div>
              {currentMode === 'production' && (
                <div className="absolute top-2 right-2">
                  <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Sandbox Credentials */}
        <div className={`border-2 rounded-lg p-5 transition-all ${
          currentMode === 'sandbox' ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Sandbox Environment</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={sandboxEnabled}
                onChange={(e) => setSandboxEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-700">
                {sandboxEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Account ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sandboxAccountId}
                  onChange={(e) => setSandboxAccountId(e.target.value)}
                  disabled={!sandboxEnabled}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                  placeholder="e.g., 1234567_SB1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Consumer Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={sandboxConsumerKey}
                    onChange={(e) => setSandboxConsumerKey(e.target.value)}
                    disabled={!sandboxEnabled}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    placeholder="Enter consumer key"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Consumer Secret <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={sandboxConsumerSecret}
                    onChange={(e) => setSandboxConsumerSecret(e.target.value)}
                    disabled={!sandboxEnabled}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    placeholder="Enter consumer secret"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Token ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={sandboxTokenId}
                    onChange={(e) => setSandboxTokenId(e.target.value)}
                    disabled={!sandboxEnabled}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    placeholder="Enter token ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Token Secret <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={sandboxTokenSecret}
                    onChange={(e) => setSandboxTokenSecret(e.target.value)}
                    disabled={!sandboxEnabled}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    placeholder="Enter token secret"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Production Credentials */}
        <div className={`border-2 rounded-lg p-5 transition-all ${
          currentMode === 'production' ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Production Environment</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={productionEnabled}
                onChange={(e) => setProductionEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-700">
                {productionEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Account ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productionAccountId}
                  onChange={(e) => setProductionAccountId(e.target.value)}
                  disabled={!productionEnabled}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                  placeholder="e.g., 1234567"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Consumer Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={productionConsumerKey}
                    onChange={(e) => setProductionConsumerKey(e.target.value)}
                    disabled={!productionEnabled}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    placeholder="Enter consumer key"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Consumer Secret <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={productionConsumerSecret}
                    onChange={(e) => setProductionConsumerSecret(e.target.value)}
                    disabled={!productionEnabled}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    placeholder="Enter consumer secret"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Token ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={productionTokenId}
                    onChange={(e) => setProductionTokenId(e.target.value)}
                    disabled={!productionEnabled}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    placeholder="Enter token ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Token Secret <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={productionTokenSecret}
                    onChange={(e) => setProductionTokenSecret(e.target.value)}
                    disabled={!productionEnabled}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    placeholder="Enter token secret"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Webhook Token Section */}
        <div className="border-2 rounded-lg p-5 border-gray-200 bg-gray-50">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Webhook Authentication</h3>
            <p className="text-sm text-gray-600">
              Configure a Bearer token for authenticating incoming webhooks from NetSuite scheduled scripts (e.g., vendor bill exports).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Webhook Token
            </label>
            <input
              type={showSecrets ? 'text' : 'password'}
              value={webhookToken}
              onChange={(e) => setWebhookToken(e.target.value)}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              placeholder="Enter webhook authentication token"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              This token will be used to authenticate incoming webhook requests from NetSuite. Configure the same token in your NetSuite scheduled script parameters.
            </p>
          </div>
        </div>

        {/* Show/Hide Secrets Toggle */}
        <div className="bg-gray-50 rounded-lg p-3">
          <label className="flex items-center cursor-pointer justify-center">
            <input
              type="checkbox"
              checked={showSecrets}
              onChange={(e) => setShowSecrets(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span className="ml-2 text-sm font-medium text-gray-700">
              {showSecrets ? 'Hide credentials' : 'Show credentials'}
            </span>
          </label>
          {isConfigured && (
            <p className="text-xs text-gray-500 text-center mt-2">
              Saved credentials show first 4 and last 4 characters (e.g., ABCD••••WXYZ). Enter new values to update them.
            </p>
          )}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center gap-3 pt-4 border-t border-gray-200">
          {isConfigured && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isLoading}
              className="px-4 py-2.5 text-sm font-medium text-red-700 bg-white border-2 border-red-300 rounded-lg hover:bg-red-50 hover:border-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Remove Integration
              </span>
            </button>
          )}

          <div className="flex gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-700 hover:border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <span className="flex items-center gap-2">
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Configuration
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

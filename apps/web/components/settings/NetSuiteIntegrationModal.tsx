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

        // Load account IDs (these are not sensitive)
        if (data.data?.sandboxAccountId) {
          setSandboxAccountId(data.data.sandboxAccountId)
        }
        if (data.data?.productionAccountId) {
          setProductionAccountId(data.data.productionAccountId)
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
      const requestBody: any = {
        currentMode,
        sandboxEnabled,
        productionEnabled,
      }

      // Only include sandbox credentials if they're being updated (not empty or just loaded)
      if (sandboxAccountId) requestBody.sandboxAccountId = sandboxAccountId
      if (sandboxConsumerKey) requestBody.sandboxConsumerKey = sandboxConsumerKey
      if (sandboxConsumerSecret) requestBody.sandboxConsumerSecret = sandboxConsumerSecret
      if (sandboxTokenId) requestBody.sandboxTokenId = sandboxTokenId
      if (sandboxTokenSecret) requestBody.sandboxTokenSecret = sandboxTokenSecret

      // Only include production credentials if they're being updated
      if (productionAccountId) requestBody.productionAccountId = productionAccountId
      if (productionConsumerKey) requestBody.productionConsumerKey = productionConsumerKey
      if (productionConsumerSecret) requestBody.productionConsumerSecret = productionConsumerSecret
      if (productionTokenId) requestBody.productionTokenId = productionTokenId
      if (productionTokenSecret) requestBody.productionTokenSecret = productionTokenSecret

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
    <Modal isOpen={isOpen} onClose={onClose} title="NetSuite Integration">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Current Mode Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current Mode
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="sandbox"
                checked={currentMode === 'sandbox'}
                onChange={(e) => setCurrentMode(e.target.value as 'sandbox')}
                className="mr-2"
              />
              Sandbox
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="production"
                checked={currentMode === 'production'}
                onChange={(e) => setCurrentMode(e.target.value as 'production')}
                className="mr-2"
              />
              Production
            </label>
          </div>
        </div>

        {/* Sandbox Credentials */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Sandbox Credentials</h3>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={sandboxEnabled}
                onChange={(e) => setSandboxEnabled(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Enable</span>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Account ID</label>
              <input
                type="text"
                value={sandboxAccountId}
                onChange={(e) => setSandboxAccountId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="1234567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Consumer Key</label>
              <input
                type={showSecrets ? 'text' : 'password'}
                value={sandboxConsumerKey}
                onChange={(e) => setSandboxConsumerKey(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="Enter consumer key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Consumer Secret</label>
              <input
                type={showSecrets ? 'text' : 'password'}
                value={sandboxConsumerSecret}
                onChange={(e) => setSandboxConsumerSecret(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="Enter consumer secret"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Token ID</label>
              <input
                type={showSecrets ? 'text' : 'password'}
                value={sandboxTokenId}
                onChange={(e) => setSandboxTokenId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="Enter token ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Token Secret</label>
              <input
                type={showSecrets ? 'text' : 'password'}
                value={sandboxTokenSecret}
                onChange={(e) => setSandboxTokenSecret(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="Enter token secret"
              />
            </div>
          </div>
        </div>

        {/* Production Credentials */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Production Credentials</h3>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={productionEnabled}
                onChange={(e) => setProductionEnabled(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Enable</span>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Account ID</label>
              <input
                type="text"
                value={productionAccountId}
                onChange={(e) => setProductionAccountId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="1234567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Consumer Key</label>
              <input
                type={showSecrets ? 'text' : 'password'}
                value={productionConsumerKey}
                onChange={(e) => setProductionConsumerKey(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="Enter consumer key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Consumer Secret</label>
              <input
                type={showSecrets ? 'text' : 'password'}
                value={productionConsumerSecret}
                onChange={(e) => setProductionConsumerSecret(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="Enter consumer secret"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Token ID</label>
              <input
                type={showSecrets ? 'text' : 'password'}
                value={productionTokenId}
                onChange={(e) => setProductionTokenId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="Enter token ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Token Secret</label>
              <input
                type={showSecrets ? 'text' : 'password'}
                value={productionTokenSecret}
                onChange={(e) => setProductionTokenSecret(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="Enter token secret"
              />
            </div>
          </div>
        </div>

        {/* Show/Hide Secrets Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="showSecrets"
            checked={showSecrets}
            onChange={(e) => setShowSecrets(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="showSecrets" className="text-sm text-gray-700">
            Show credentials
          </label>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between gap-3 pt-4 border-t">
          {isConfigured && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
            >
              Remove Integration
            </button>
          )}

          <div className="flex gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

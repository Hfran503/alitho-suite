'use client'

import { useState, useEffect } from 'react'
import { Modal } from '../Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  FlaskConical,
  Rocket,
  Webhook,
  Shield,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

        if (data.data?.sandboxAccountId) setSandboxAccountId(data.data.sandboxAccountId)
        if (data.data?.sandboxConsumerKey) setSandboxConsumerKey(data.data.sandboxConsumerKey)
        if (data.data?.sandboxConsumerSecret) setSandboxConsumerSecret(data.data.sandboxConsumerSecret)
        if (data.data?.sandboxTokenId) setSandboxTokenId(data.data.sandboxTokenId)
        if (data.data?.sandboxTokenSecret) setSandboxTokenSecret(data.data.sandboxTokenSecret)

        if (data.data?.productionAccountId) setProductionAccountId(data.data.productionAccountId)
        if (data.data?.productionConsumerKey) setProductionConsumerKey(data.data.productionConsumerKey)
        if (data.data?.productionConsumerSecret) setProductionConsumerSecret(data.data.productionConsumerSecret)
        if (data.data?.productionTokenId) setProductionTokenId(data.data.productionTokenId)
        if (data.data?.productionTokenSecret) setProductionTokenSecret(data.data.productionTokenSecret)

        if (data.data?.webhookToken) setWebhookToken(data.data.webhookToken)
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
      const isMaskedValue = (value: string): boolean => {
        return value === '••••••••' || /^.{0,4}••••.{0,4}$/.test(value)
      }

      const requestBody: any = {
        currentMode,
        sandboxEnabled,
        productionEnabled,
      }

      if (sandboxAccountId && !isMaskedValue(sandboxAccountId)) requestBody.sandboxAccountId = sandboxAccountId
      if (sandboxConsumerKey && !isMaskedValue(sandboxConsumerKey)) requestBody.sandboxConsumerKey = sandboxConsumerKey
      if (sandboxConsumerSecret && !isMaskedValue(sandboxConsumerSecret)) requestBody.sandboxConsumerSecret = sandboxConsumerSecret
      if (sandboxTokenId && !isMaskedValue(sandboxTokenId)) requestBody.sandboxTokenId = sandboxTokenId
      if (sandboxTokenSecret && !isMaskedValue(sandboxTokenSecret)) requestBody.sandboxTokenSecret = sandboxTokenSecret

      if (productionAccountId && !isMaskedValue(productionAccountId)) requestBody.productionAccountId = productionAccountId
      if (productionConsumerKey && !isMaskedValue(productionConsumerKey)) requestBody.productionConsumerKey = productionConsumerKey
      if (productionConsumerSecret && !isMaskedValue(productionConsumerSecret)) requestBody.productionConsumerSecret = productionConsumerSecret
      if (productionTokenId && !isMaskedValue(productionTokenId)) requestBody.productionTokenId = productionTokenId
      if (productionTokenSecret && !isMaskedValue(productionTokenSecret)) requestBody.productionTokenSecret = productionTokenSecret

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

  const CredentialInput = ({
    label,
    value,
    onChange,
    disabled,
    placeholder,
    required = true
  }: {
    label: string
    value: string
    onChange: (v: string) => void
    disabled: boolean
    placeholder: string
    required?: boolean
  }) => (
    <div className="space-y-2">
      <Label className="text-xs text-gray-500">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        type={showSecrets ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn('h-10 font-mono text-sm bg-white', disabled && 'bg-gray-50 cursor-not-allowed')}
        placeholder={placeholder}
      />
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="NetSuite Integration" size="2xl">
      <form onSubmit={handleSave} className="space-y-8">
        {/* Alerts */}
        {success && (
          <Alert className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800 font-medium">{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="bg-gradient-to-r from-red-50 to-rose-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 font-medium">{error}</AlertDescription>
          </Alert>
        )}

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Info className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-violet-900">OAuth 2.0 Token-Based Authentication</h3>
            <p className="mt-1 text-sm text-violet-700">
              Configure your NetSuite integration using OAuth credentials. You can set up both Sandbox and Production environments.
            </p>
          </div>
        </div>

        {/* Environment Selection */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-violet-500" />
            <h3 className="font-semibold text-gray-900">Active Environment</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setCurrentMode('sandbox')}
              className={cn(
                'relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200',
                currentMode === 'sandbox'
                  ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-lg shadow-amber-500/10'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <div className={cn('p-2.5 rounded-lg', currentMode === 'sandbox' ? 'bg-amber-100' : 'bg-gray-100')}>
                <FlaskConical className={cn('h-5 w-5', currentMode === 'sandbox' ? 'text-amber-600' : 'text-gray-400')} />
              </div>
              <div className="text-left flex-1">
                <p className={cn('font-medium', currentMode === 'sandbox' ? 'text-amber-900' : 'text-gray-700')}>Sandbox</p>
                <p className="text-xs text-gray-500">Development testing</p>
              </div>
              {sandboxEnabled && (
                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Configured</Badge>
              )}
              {currentMode === 'sandbox' && (
                <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-amber-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setCurrentMode('production')}
              className={cn(
                'relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200',
                currentMode === 'production'
                  ? 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-green-50 shadow-lg shadow-emerald-500/10'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <div className={cn('p-2.5 rounded-lg', currentMode === 'production' ? 'bg-emerald-100' : 'bg-gray-100')}>
                <Rocket className={cn('h-5 w-5', currentMode === 'production' ? 'text-emerald-600' : 'text-gray-400')} />
              </div>
              <div className="text-left flex-1">
                <p className={cn('font-medium', currentMode === 'production' ? 'text-emerald-900' : 'text-gray-700')}>Production</p>
                <p className="text-xs text-gray-500">Live environment</p>
              </div>
              {productionEnabled && (
                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Configured</Badge>
              )}
              {currentMode === 'production' && (
                <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-emerald-500" />
              )}
            </button>
          </div>
        </div>

        {/* Sandbox Credentials */}
        <div className={cn(
          'rounded-2xl border-2 p-5 transition-all duration-200',
          currentMode === 'sandbox'
            ? 'border-amber-200 bg-gradient-to-br from-amber-50/50 to-yellow-50/30'
            : 'border-gray-200 bg-gray-50/50'
        )}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', currentMode === 'sandbox' ? 'bg-amber-100' : 'bg-gray-200')}>
                <FlaskConical className={cn('h-5 w-5', currentMode === 'sandbox' ? 'text-amber-600' : 'text-gray-400')} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Sandbox Environment</h3>
                <p className="text-xs text-gray-500">Development and testing credentials</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSandboxEnabled(!sandboxEnabled)}
              className={cn(
                'relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-300',
                sandboxEnabled ? 'bg-gradient-to-r from-amber-500 to-yellow-500' : 'bg-gray-200'
              )}
            >
              <span className={cn(
                'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 mt-0.5',
                sandboxEnabled ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'
              )} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Account ID <span className="text-red-500">*</span></Label>
              <Input
                type="text"
                value={sandboxAccountId}
                onChange={(e) => setSandboxAccountId(e.target.value)}
                disabled={!sandboxEnabled}
                className={cn('h-10 bg-white', !sandboxEnabled && 'bg-gray-100 cursor-not-allowed')}
                placeholder="e.g., 1234567_SB1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <CredentialInput label="Consumer Key" value={sandboxConsumerKey} onChange={setSandboxConsumerKey} disabled={!sandboxEnabled} placeholder="Enter consumer key" />
              <CredentialInput label="Consumer Secret" value={sandboxConsumerSecret} onChange={setSandboxConsumerSecret} disabled={!sandboxEnabled} placeholder="Enter consumer secret" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <CredentialInput label="Token ID" value={sandboxTokenId} onChange={setSandboxTokenId} disabled={!sandboxEnabled} placeholder="Enter token ID" />
              <CredentialInput label="Token Secret" value={sandboxTokenSecret} onChange={setSandboxTokenSecret} disabled={!sandboxEnabled} placeholder="Enter token secret" />
            </div>
          </div>
        </div>

        {/* Production Credentials */}
        <div className={cn(
          'rounded-2xl border-2 p-5 transition-all duration-200',
          currentMode === 'production'
            ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-green-50/30'
            : 'border-gray-200 bg-gray-50/50'
        )}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', currentMode === 'production' ? 'bg-emerald-100' : 'bg-gray-200')}>
                <Rocket className={cn('h-5 w-5', currentMode === 'production' ? 'text-emerald-600' : 'text-gray-400')} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Production Environment</h3>
                <p className="text-xs text-gray-500">Live production credentials</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setProductionEnabled(!productionEnabled)}
              className={cn(
                'relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-300',
                productionEnabled ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-gray-200'
              )}
            >
              <span className={cn(
                'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 mt-0.5',
                productionEnabled ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'
              )} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Account ID <span className="text-red-500">*</span></Label>
              <Input
                type="text"
                value={productionAccountId}
                onChange={(e) => setProductionAccountId(e.target.value)}
                disabled={!productionEnabled}
                className={cn('h-10 bg-white', !productionEnabled && 'bg-gray-100 cursor-not-allowed')}
                placeholder="e.g., 1234567"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <CredentialInput label="Consumer Key" value={productionConsumerKey} onChange={setProductionConsumerKey} disabled={!productionEnabled} placeholder="Enter consumer key" />
              <CredentialInput label="Consumer Secret" value={productionConsumerSecret} onChange={setProductionConsumerSecret} disabled={!productionEnabled} placeholder="Enter consumer secret" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <CredentialInput label="Token ID" value={productionTokenId} onChange={setProductionTokenId} disabled={!productionEnabled} placeholder="Enter token ID" />
              <CredentialInput label="Token Secret" value={productionTokenSecret} onChange={setProductionTokenSecret} disabled={!productionEnabled} placeholder="Enter token secret" />
            </div>
          </div>
        </div>

        {/* Webhook Token */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold text-gray-900">Webhook Authentication</h3>
          </div>
          <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 space-y-3">
            <p className="text-sm text-gray-600">
              Configure a Bearer token for authenticating incoming webhooks from NetSuite scheduled scripts.
            </p>
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Webhook Token</Label>
              <div className="relative">
                <Input
                  type={showSecrets ? 'text' : 'password'}
                  value={webhookToken}
                  onChange={(e) => setWebhookToken(e.target.value)}
                  className="h-10 font-mono text-sm pr-10 bg-white"
                  placeholder="Enter webhook authentication token"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSecrets(!showSecrets)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                >
                  {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Shield className="h-3.5 w-3.5" />
              <span>Credentials are encrypted and stored in AWS Secrets Manager</span>
            </div>
          </div>
        </div>

        {/* Show/Hide Toggle */}
        <div className="flex items-center justify-center gap-2 p-3 bg-gray-50 rounded-xl">
          <input
            type="checkbox"
            id="showSecrets"
            checked={showSecrets}
            onChange={(e) => setShowSecrets(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
          />
          <Label htmlFor="showSecrets" className="text-sm text-gray-600 cursor-pointer">
            {showSecrets ? 'Hide all credentials' : 'Show all credentials'}
          </Label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-6 border-t border-gray-100">
          {isConfigured && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={isLoading}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Integration
            </Button>
          )}

          <div className="flex gap-3 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="px-6"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="px-6 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/25"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

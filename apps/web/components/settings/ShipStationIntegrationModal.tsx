'use client'

import { useState, useEffect } from 'react'
import { Modal } from '../Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Ship,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Loader2,
  Zap,
  FlaskConical,
  Rocket,
  Key,
  Truck,
  MapPin,
  ExternalLink,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
            setCarriers(data.data.config.carrierIds.map((id: string) => ({ id, name: '', estimateRateMarkup: 0, estimateRateMarkupDollar: 0, trackingUrlTemplate: '' })))
          }

          if (data.data.config.defaultFromAddress) {
            setDefaultFromAddress(data.data.config.defaultFromAddress)
          }
        }

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
      const easypostResponse = await fetch('/api/integrations/easypost')
      if (easypostResponse.ok) {
        const easypostData = await easypostResponse.json()
        if (easypostData.data?.enabled) {
          setError('EasyPost integration is currently active. Please disable EasyPost before enabling ShipStation.')
          setIsLoading(false)
          return
        }
      }

      const isMaskedTest = testApiKey.includes('...')
      const isMaskedProduction = productionApiKey.includes('...')
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
          productionApiKey: !isMaskedProduction && productionApiKey.trim() ? productionApiKey.trim() : undefined,
          enabled,
          config: {
            mode,
            carriers: filteredCarriers,
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

      if (apiKey.includes('...')) {
        setError(`Please enter a new ${mode} API key to test. The current key is masked for security.`)
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
    <Modal isOpen={isOpen} onClose={onClose} title="ShipStation Integration" size="2xl">
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

        {/* Enable Toggle */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                'p-3 rounded-xl transition-all duration-300',
                enabled
                  ? 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25'
                  : 'bg-gray-100'
              )}>
                <Ship className={cn('h-6 w-6', enabled ? 'text-white' : 'text-gray-400')} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900">Enable ShipStation</h4>
                  {enabled && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0">Active</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {enabled ? 'Integration is active and processing shipments' : 'Enable to start using ShipStation for shipping'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={cn(
                'relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                enabled ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-gray-200'
              )}
            >
              <span className={cn(
                'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out mt-0.5',
                enabled ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'
              )} />
            </button>
          </div>
        </div>

        {/* Environment Mode */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-gray-900">Environment</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setMode('test')}
              className={cn(
                'relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200',
                mode === 'test'
                  ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-lg shadow-amber-500/10'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <div className={cn(
                'p-2.5 rounded-lg',
                mode === 'test' ? 'bg-amber-100' : 'bg-gray-100'
              )}>
                <FlaskConical className={cn('h-5 w-5', mode === 'test' ? 'text-amber-600' : 'text-gray-400')} />
              </div>
              <div className="text-left">
                <p className={cn('font-medium', mode === 'test' ? 'text-amber-900' : 'text-gray-700')}>Test Mode</p>
                <p className="text-xs text-gray-500">Sandbox environment</p>
              </div>
              {mode === 'test' && (
                <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-amber-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMode('production')}
              className={cn(
                'relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200',
                mode === 'production'
                  ? 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-green-50 shadow-lg shadow-emerald-500/10'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <div className={cn(
                'p-2.5 rounded-lg',
                mode === 'production' ? 'bg-emerald-100' : 'bg-gray-100'
              )}>
                <Rocket className={cn('h-5 w-5', mode === 'production' ? 'text-emerald-600' : 'text-gray-400')} />
              </div>
              <div className="text-left">
                <p className={cn('font-medium', mode === 'production' ? 'text-emerald-900' : 'text-gray-700')}>Production</p>
                <p className="text-xs text-gray-500">Live environment</p>
              </div>
              {mode === 'production' && (
                <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-emerald-500" />
              )}
            </button>
          </div>
        </div>

        {/* API Key */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-violet-500" />
            <h3 className="font-semibold text-gray-900">API Authentication</h3>
          </div>
          <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 space-y-3">
            <Label htmlFor="apiKey" className="text-sm font-medium text-gray-700">
              {mode === 'test' ? 'Test' : 'Production'} API Key
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                id="apiKey"
                value={currentApiKey}
                onChange={(e) => setCurrentApiKey(e.target.value)}
                className="pr-28 font-mono text-sm h-11 bg-white"
                placeholder={mode === 'test' ? 'TEST_xxxxx...' : 'PROD_xxxxx...'}
                required
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTesting || !currentApiKey.trim()}
                  className="h-7 px-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Test'}
                </Button>
                <div className="w-px h-4 bg-gray-200" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Shield className="h-3.5 w-3.5" />
              <span>Keys are encrypted and stored in AWS Secrets Manager</span>
              <a
                href="https://www.shipengine.com/docs/auth/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 ml-auto"
              >
                Get API Key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Carriers */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold text-gray-900">Carriers</h3>
            <Badge variant="secondary" className="ml-auto">{carriers.filter(c => c.id).length} configured</Badge>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Carrier ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Markup %</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Markup $</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tracking URL</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {carriers.map((carrier, index) => (
                    <tr key={index} className="group hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <Input
                          type="text"
                          value={carrier.name}
                          onChange={(e) => updateCarrier(index, 'name', e.target.value)}
                          placeholder="e.g., UPS"
                          className="h-9 text-sm bg-white"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="text"
                          value={carrier.id}
                          onChange={(e) => updateCarrier(index, 'id', e.target.value)}
                          placeholder="se-123456"
                          className="h-9 text-sm font-mono bg-white"
                          required
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <Input
                            type="number"
                            value={carrier.estimateRateMarkup ?? 0}
                            onChange={(e) => updateCarrier(index, 'estimateRateMarkup', e.target.value)}
                            min="0"
                            step="0.01"
                            className="h-9 text-sm pr-6 bg-white"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                          <Input
                            type="number"
                            value={carrier.estimateRateMarkupDollar ?? 0}
                            onChange={(e) => updateCarrier(index, 'estimateRateMarkupDollar', e.target.value)}
                            min="0"
                            step="0.01"
                            className="h-9 text-sm pl-5 bg-white"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="text"
                          value={carrier.trackingUrlTemplate ?? ''}
                          onChange={(e) => updateCarrier(index, 'trackingUrlTemplate', e.target.value)}
                          placeholder="https://.../{tracking}"
                          className="h-9 text-sm font-mono bg-white"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {carriers.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCarrier(index)}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 p-3 bg-gray-50/50">
              <Button
                type="button"
                variant="ghost"
                onClick={addCarrier}
                className="w-full h-9 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 border-2 border-dashed border-gray-200 hover:border-blue-300"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Carrier
              </Button>
            </div>
          </div>
        </div>

        {/* Ship From Address */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-rose-500" />
            <h3 className="font-semibold text-gray-900">Default Ship-From Address</h3>
          </div>

          <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Contact Name</Label>
                <Input
                  type="text"
                  value={defaultFromAddress.name}
                  onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, name: e.target.value })}
                  placeholder="John Smith"
                  className="h-10 bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Company</Label>
                <Input
                  type="text"
                  value={defaultFromAddress.company}
                  onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, company: e.target.value })}
                  placeholder="Acme Corp"
                  className="h-10 bg-white"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-xs text-gray-500">Street Address</Label>
                <Input
                  type="text"
                  value={defaultFromAddress.street1}
                  onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, street1: e.target.value })}
                  placeholder="123 Main Street"
                  className="h-10 bg-white"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-xs text-gray-500">Street Address 2</Label>
                <Input
                  type="text"
                  value={defaultFromAddress.street2}
                  onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, street2: e.target.value })}
                  placeholder="Suite 100 (optional)"
                  className="h-10 bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">City</Label>
                <Input
                  type="text"
                  value={defaultFromAddress.city}
                  onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, city: e.target.value })}
                  placeholder="Los Angeles"
                  className="h-10 bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">State</Label>
                <Input
                  type="text"
                  value={defaultFromAddress.state}
                  onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, state: e.target.value })}
                  placeholder="CA"
                  className="h-10 bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">ZIP Code</Label>
                <Input
                  type="text"
                  value={defaultFromAddress.zip}
                  onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, zip: e.target.value })}
                  placeholder="90001"
                  className="h-10 bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Phone</Label>
                <Input
                  type="tel"
                  value={defaultFromAddress.phone}
                  onChange={(e) => setDefaultFromAddress({ ...defaultFromAddress, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="h-10 bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
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
            disabled={isLoading || !currentApiKey.trim()}
            className="px-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-500/25"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              isConfigured ? 'Update Configuration' : 'Save Configuration'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Warehouse,
  Mail,
  Loader2,
  Save,
  CheckCircle2,
  Settings2,
  Bell,
  Package,
  Truck,
  ClipboardList,
  AlertCircle,
  ShoppingCart,
  AlertTriangle,
  User,
  Users,
  Plus,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotificationRecipients {
  customer: boolean
  internal: boolean
}

interface StorefrontNotifications {
  orderPlaced: NotificationRecipients
  orderApproved: NotificationRecipients
  orderShipped: NotificationRecipients
  orderDelivered: NotificationRecipients
  orderCancelled: NotificationRecipients
  pickOrderCreated: NotificationRecipients
  pickOrderStarted: NotificationRecipients
  pickOrderCompleted: NotificationRecipients
  pickOrderCancelled: NotificationRecipients
}

interface WarehouseModuleConfig {
  emailNotificationsEnabled: boolean
  internalNotificationEmails: string[]
  notifications: StorefrontNotifications
}

const defaultConfig: WarehouseModuleConfig = {
  emailNotificationsEnabled: false,
  internalNotificationEmails: [],
  notifications: {
    orderPlaced: { customer: true, internal: true },
    orderApproved: { customer: true, internal: false },
    orderShipped: { customer: true, internal: false },
    orderDelivered: { customer: true, internal: false },
    orderCancelled: { customer: true, internal: true },
    pickOrderCreated: { customer: false, internal: true },
    pickOrderStarted: { customer: true, internal: false },
    pickOrderCompleted: { customer: true, internal: true },
    pickOrderCancelled: { customer: true, internal: true },
  },
}

const orderNotificationTypes = [
  { key: 'orderPlaced', label: 'Order Placed', description: 'When a storefront order is submitted', icon: ShoppingCart, customerLabel: 'Customer' },
  { key: 'orderApproved', label: 'Order Approved', description: 'When an order is approved for fulfillment', icon: CheckCircle2, customerLabel: 'Customer' },
  { key: 'orderShipped', label: 'Order Shipped', description: 'When an order ships with tracking info', icon: Truck, customerLabel: 'Customer' },
  { key: 'orderDelivered', label: 'Order Delivered', description: 'When shipment is marked as delivered', icon: Package, customerLabel: 'Customer' },
  { key: 'orderCancelled', label: 'Order Cancelled', description: 'When an order is cancelled', icon: AlertCircle, customerLabel: 'Customer' },
] as const

const pickOrderNotificationTypes = [
  { key: 'pickOrderCreated', label: 'Pick Order Created', description: 'When a pick order is generated', icon: ClipboardList, customerLabel: 'Creator' },
  { key: 'pickOrderStarted', label: 'Pick Order Started', description: 'When picking begins on an order', icon: ClipboardList, customerLabel: 'Creator' },
  { key: 'pickOrderCompleted', label: 'Pick Order Completed', description: 'When all items are picked and confirmed', icon: CheckCircle2, customerLabel: 'Creator' },
  { key: 'pickOrderCancelled', label: 'Pick Order Cancelled', description: 'When a pick order is cancelled', icon: AlertCircle, customerLabel: 'Creator' },
] as const

interface EmailIntegrationStatus {
  configured: boolean
  enabled: boolean
  fromEmail?: string
  fromName?: string
}

export function ModulesSettings() {
  const [config, setConfig] = useState<WarehouseModuleConfig>(defaultConfig)
  const [emailStatus, setEmailStatus] = useState<EmailIntegrationStatus>({ configured: false, enabled: false })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)

  useEffect(() => {
    fetchModuleSettings()
    fetchEmailIntegrationStatus()
  }, [])

  const fetchModuleSettings = async () => {
    try {
      const response = await fetch('/api/settings/modules')
      if (response.ok) {
        const data = await response.json()
        if (data.data?.warehouseStorefront) {
          setConfig({
            ...defaultConfig,
            ...data.data.warehouseStorefront,
            notifications: {
              ...defaultConfig.notifications,
              ...data.data.warehouseStorefront.notifications,
            },
          })
        }
      }
    } catch (error) {
      console.error('Error fetching module settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchEmailIntegrationStatus = async () => {
    try {
      const response = await fetch('/api/integrations/email')
      if (response.ok) {
        const data = await response.json()
        setEmailStatus({
          configured: data.data?.configured || false,
          enabled: data.data?.enabled || false,
          fromEmail: data.data?.credentials?.fromEmail,
          fromName: data.data?.credentials?.fromName,
        })
      }
    } catch (error) {
      console.error('Error fetching email integration status:', error)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSaveSuccess(false)

    try {
      const response = await fetch('/api/settings/modules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouseStorefront: config }),
      })

      if (!response.ok) {
        throw new Error('Failed to save settings')
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      setError('Failed to save module settings. Please try again.')
      console.error('Error saving module settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const updateNotification = (
    key: keyof StorefrontNotifications,
    recipient: 'customer' | 'internal',
    value: boolean
  ) => {
    setConfig(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: {
          ...prev.notifications[key],
          [recipient]: value,
        },
      },
    }))
  }

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const addEmail = useCallback(() => {
    setEmailError(null)
    const trimmedEmail = newEmail.trim().toLowerCase()

    if (!trimmedEmail) {
      return
    }

    if (!isValidEmail(trimmedEmail)) {
      setEmailError('Please enter a valid email address')
      return
    }

    if (config.internalNotificationEmails.includes(trimmedEmail)) {
      setEmailError('This email is already in the list')
      return
    }

    setConfig(prev => ({
      ...prev,
      internalNotificationEmails: [...prev.internalNotificationEmails, trimmedEmail],
    }))
    setNewEmail('')
  }, [newEmail, config.internalNotificationEmails])

  const removeEmail = (emailToRemove: string) => {
    setConfig(prev => ({
      ...prev,
      internalNotificationEmails: prev.internalNotificationEmails.filter(e => e !== emailToRemove),
    }))
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Loading module settings...</p>
      </div>
    )
  }

  const emailReady = emailStatus.configured && emailStatus.enabled

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          <Settings2 className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900">Module Configuration</p>
          <p className="text-xs text-blue-700">
            Configure application modules and their settings.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Warehouse / Storefront Module */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
              <Warehouse className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Warehouse / Storefront</CardTitle>
              <CardDescription>
                Configure email notifications for storefront orders
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Email Integration Status */}
          <div className={cn(
            'flex items-start gap-3 p-4 rounded-xl border',
            emailReady
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          )}>
            <div className={cn(
              'p-2 rounded-lg',
              emailReady ? 'bg-emerald-100' : 'bg-amber-100'
            )}>
              {emailReady ? (
                <Mail className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
            </div>
            <div className="flex-1">
              {emailReady ? (
                <>
                  <p className="text-sm font-medium text-emerald-900">Email Integration Active</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Sending from: {emailStatus.fromEmail} {emailStatus.fromName && `(${emailStatus.fromName})`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-amber-900">Email Integration Required</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Configure the Email Integration in Settings → Integrations to enable notifications.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Email Notifications Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-indigo-600" />
              <h4 className="text-sm font-semibold text-gray-900">Email Notifications</h4>
            </div>

            {/* Main Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Mail className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-900">Enable Email Notifications</Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Send emails for storefront order events
                  </p>
                </div>
              </div>
              <Switch
                checked={config.emailNotificationsEnabled}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, emailNotificationsEnabled: checked }))}
                disabled={!emailReady}
              />
            </div>

            {/* Internal Email Configuration */}
            {config.emailNotificationsEnabled && (
              <>
                <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-600" />
                    <Label className="text-sm font-semibold text-gray-900">Warehouse Crew Emails</Label>
                  </div>

                  {/* Email List */}
                  {config.internalNotificationEmails.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {config.internalNotificationEmails.map((email) => (
                        <div
                          key={email}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-gray-200 text-sm"
                        >
                          <Mail className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-gray-700">{email}</span>
                          <button
                            type="button"
                            onClick={() => removeEmail(email)}
                            className="ml-1 p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Email Input */}
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="warehouse@yourcompany.com"
                      value={newEmail}
                      onChange={(e) => {
                        setNewEmail(e.target.value)
                        setEmailError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addEmail()
                        }
                      }}
                      className="bg-white flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addEmail}
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>

                  {emailError && (
                    <p className="text-xs text-red-600">{emailError}</p>
                  )}

                  <p className="text-xs text-gray-500">
                    Add email addresses for internal warehouse notifications. You can add multiple emails including group addresses.
                  </p>
                </div>

                {/* Notification Types */}
                <div className="space-y-6 pt-4 border-t border-gray-100">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700">Notification Events</h4>
                    <p className="text-xs text-gray-500">Configure which events trigger emails and who receives them</p>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-6 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      <span>Customer / Creator</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <span>Warehouse Crew</span>
                    </div>
                  </div>

                  {/* Order Notifications Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                      <h5 className="text-sm font-semibold text-gray-800">Order Notifications</h5>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {orderNotificationTypes.map((type) => {
                        const Icon = type.icon
                        const recipients = config.notifications[type.key]
                        const hasAnyEnabled = recipients.customer || recipients.internal
                        return (
                          <div
                            key={type.key}
                            className={cn(
                              'p-4 rounded-xl border transition-all',
                              hasAnyEnabled
                                ? 'bg-blue-50/50 border-blue-200'
                                : 'bg-gray-50 border-gray-200'
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className={cn(
                                  'p-2 rounded-lg mt-0.5',
                                  hasAnyEnabled ? 'bg-blue-100' : 'bg-gray-100'
                                )}>
                                  <Icon className={cn(
                                    'h-4 w-4',
                                    hasAnyEnabled ? 'text-blue-600' : 'text-gray-400'
                                  )} />
                                </div>
                                <div>
                                  <Label className="text-sm font-medium text-gray-900">{type.label}</Label>
                                  <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
                                </div>
                              </div>

                              {/* Recipient Toggles */}
                              <div className="flex items-center gap-4">
                                {/* Customer Toggle */}
                                <div className="flex flex-col items-center gap-1">
                                  <div className={cn(
                                    'p-1.5 rounded-lg transition-colors',
                                    recipients.customer ? 'bg-blue-100' : 'bg-gray-100'
                                  )}>
                                    <User className={cn(
                                      'h-3.5 w-3.5',
                                      recipients.customer ? 'text-blue-600' : 'text-gray-400'
                                    )} />
                                  </div>
                                  <Switch
                                    checked={recipients.customer}
                                    onCheckedChange={(checked) => updateNotification(type.key, 'customer', checked)}
                                    className="scale-90"
                                  />
                                </div>

                                {/* Internal Toggle */}
                                <div className="flex flex-col items-center gap-1">
                                  <div className={cn(
                                    'p-1.5 rounded-lg transition-colors',
                                    recipients.internal ? 'bg-amber-100' : 'bg-gray-100'
                                  )}>
                                    <Users className={cn(
                                      'h-3.5 w-3.5',
                                      recipients.internal ? 'text-amber-600' : 'text-gray-400'
                                    )} />
                                  </div>
                                  <Switch
                                    checked={recipients.internal}
                                    onCheckedChange={(checked) => updateNotification(type.key, 'internal', checked)}
                                    className="scale-90"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Pick Order Notifications Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-purple-600" />
                      <h5 className="text-sm font-semibold text-gray-800">Pick Order Notifications</h5>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {pickOrderNotificationTypes.map((type) => {
                        const Icon = type.icon
                        const recipients = config.notifications[type.key]
                        const hasAnyEnabled = recipients.customer || recipients.internal
                        return (
                          <div
                            key={type.key}
                            className={cn(
                              'p-4 rounded-xl border transition-all',
                              hasAnyEnabled
                                ? 'bg-purple-50/50 border-purple-200'
                                : 'bg-gray-50 border-gray-200'
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className={cn(
                                  'p-2 rounded-lg mt-0.5',
                                  hasAnyEnabled ? 'bg-purple-100' : 'bg-gray-100'
                                )}>
                                  <Icon className={cn(
                                    'h-4 w-4',
                                    hasAnyEnabled ? 'text-purple-600' : 'text-gray-400'
                                  )} />
                                </div>
                                <div>
                                  <Label className="text-sm font-medium text-gray-900">{type.label}</Label>
                                  <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
                                </div>
                              </div>

                              {/* Recipient Toggles */}
                              <div className="flex items-center gap-4">
                                {/* Creator Toggle */}
                                <div className="flex flex-col items-center gap-1">
                                  <div className={cn(
                                    'p-1.5 rounded-lg transition-colors',
                                    recipients.customer ? 'bg-purple-100' : 'bg-gray-100'
                                  )}>
                                    <User className={cn(
                                      'h-3.5 w-3.5',
                                      recipients.customer ? 'text-purple-600' : 'text-gray-400'
                                    )} />
                                  </div>
                                  <Switch
                                    checked={recipients.customer}
                                    onCheckedChange={(checked) => updateNotification(type.key, 'customer', checked)}
                                    className="scale-90"
                                  />
                                </div>

                                {/* Internal Toggle */}
                                <div className="flex flex-col items-center gap-1">
                                  <div className={cn(
                                    'p-1.5 rounded-lg transition-colors',
                                    recipients.internal ? 'bg-amber-100' : 'bg-gray-100'
                                  )}>
                                    <Users className={cn(
                                      'h-3.5 w-3.5',
                                      recipients.internal ? 'text-amber-600' : 'text-gray-400'
                                    )} />
                                  </div>
                                  <Switch
                                    checked={recipients.internal}
                                    onCheckedChange={(checked) => updateNotification(type.key, 'internal', checked)}
                                    className="scale-90"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3">
        {saveSuccess && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Settings saved successfully</span>
          </div>
        )}
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

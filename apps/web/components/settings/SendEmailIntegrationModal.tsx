'use client'

import { useState, useEffect } from 'react'
import { Modal } from '../Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Send,
  Server,
  Cloud,
  Shield,
  ExternalLink,
  Inbox,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SendEmailIntegrationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type EmailProvider = 'smtp' | 'sendgrid' | 'ses' | 'resend'

const providerConfig = {
  smtp: { name: 'SMTP', icon: Server, color: 'text-gray-600', gradient: 'from-gray-500 to-slate-600' },
  sendgrid: { name: 'SendGrid', icon: Send, color: 'text-blue-600', gradient: 'from-blue-500 to-cyan-500' },
  ses: { name: 'AWS SES', icon: Cloud, color: 'text-amber-600', gradient: 'from-amber-500 to-orange-500' },
  resend: { name: 'Resend', icon: Mail, color: 'text-violet-600', gradient: 'from-violet-500 to-purple-500' },
}

export function SendEmailIntegrationModal({
  isOpen,
  onClose,
  onSuccess,
}: SendEmailIntegrationModalProps) {
  const [provider, setProvider] = useState<EmailProvider>('smtp')
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [testEmail, setTestEmail] = useState('')

  // Common fields
  const [fromEmail, setFromEmail] = useState('')
  const [fromName, setFromName] = useState('')

  // SMTP fields
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpSecure, setSmtpSecure] = useState(false)
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')

  // SendGrid fields
  const [sendgridApiKey, setSendgridApiKey] = useState('')

  // AWS SES fields
  const [sesRegion, setSesRegion] = useState('us-east-1')
  const [sesAccessKeyId, setSesAccessKeyId] = useState('')
  const [sesSecretAccessKey, setSesSecretAccessKey] = useState('')

  // Resend fields
  const [resendApiKey, setResendApiKey] = useState('')

  // IMAP fields
  const [imapServer, setImapServer] = useState('')
  const [imapUser, setImapUser] = useState('')
  const [imapPassword, setImapPassword] = useState('')

  useEffect(() => {
    if (isOpen) {
      checkConfiguration()
    }
  }, [isOpen])

  const checkConfiguration = async () => {
    try {
      const response = await fetch('/api/integrations/email')
      if (response.ok) {
        const data = await response.json()
        setIsConfigured(data.data?.configured || false)
        setEnabled(data.data?.enabled || false)

        if (data.data?.provider) setProvider(data.data.provider)

        if (data.data?.credentials) {
          const creds = data.data.credentials
          if (creds.fromEmail) setFromEmail(creds.fromEmail)
          if (creds.fromName) setFromName(creds.fromName)
          if (creds.smtpHost) setSmtpHost(creds.smtpHost)
          if (creds.smtpPort) setSmtpPort(creds.smtpPort.toString())
          if (creds.smtpSecure !== undefined) setSmtpSecure(creds.smtpSecure)
          if (creds.smtpUser) setSmtpUser(creds.smtpUser)
          if (creds.sesRegion) setSesRegion(creds.sesRegion)
          if (creds.sesAccessKeyId) setSesAccessKeyId(creds.sesAccessKeyId)
          if (creds.imapServer) setImapServer(creds.imapServer)
          if (creds.imapUser) setImapUser(creds.imapUser)
        }

        if (data.data?.maskedCredentials) {
          const masked = data.data.maskedCredentials
          if (masked.smtpPassword) setSmtpPassword(masked.smtpPassword)
          if (masked.sendgridApiKey) setSendgridApiKey(masked.sendgridApiKey)
          if (masked.sesSecretAccessKey) setSesSecretAccessKey(masked.sesSecretAccessKey)
          if (masked.resendApiKey) setResendApiKey(masked.resendApiKey)
          if (masked.imapPassword) setImapPassword(masked.imapPassword)
        }
      }
    } catch (error) {
      console.error('Error checking configuration:', error)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setError('')
    setSuccess('')

    if (!testEmail) {
      setError('Please enter a test email address')
      setIsTesting(false)
      return
    }

    try {
      const testData: any = { provider, fromEmail, testEmail }

      if (provider === 'smtp') {
        if (smtpPassword === '••••••••' || smtpPassword.includes('•')) {
          setError('Please enter your actual password to test')
          setIsTesting(false)
          return
        }
        testData.smtpHost = smtpHost
        testData.smtpPort = parseInt(smtpPort)
        testData.smtpSecure = smtpSecure
        testData.smtpUser = smtpUser
        testData.smtpPassword = smtpPassword
      } else if (provider === 'sendgrid') {
        testData.sendgridApiKey = sendgridApiKey
      } else if (provider === 'ses') {
        testData.sesRegion = sesRegion
        testData.sesAccessKeyId = sesAccessKeyId
        testData.sesSecretAccessKey = sesSecretAccessKey
      } else if (provider === 'resend') {
        testData.resendApiKey = resendApiKey
      }

      const response = await fetch('/api/integrations/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess(data.message || 'Test email sent successfully!')
      } else {
        setError(data.error || 'Failed to send test email')
      }
    } catch (error) {
      setError('Failed to test email configuration')
      console.error('Error testing email:', error)
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    if (!fromEmail) {
      setError('From email address is required')
      setIsLoading(false)
      return
    }

    if (provider === 'smtp' && (!smtpHost || !smtpPort || !smtpUser || !smtpPassword)) {
      setError('All SMTP fields are required')
      setIsLoading(false)
      return
    } else if (provider === 'sendgrid' && !sendgridApiKey) {
      setError('SendGrid API key is required')
      setIsLoading(false)
      return
    } else if (provider === 'ses' && (!sesRegion || !sesAccessKeyId || !sesSecretAccessKey)) {
      setError('All AWS SES fields are required')
      setIsLoading(false)
      return
    } else if (provider === 'resend' && !resendApiKey) {
      setError('Resend API key is required')
      setIsLoading(false)
      return
    }

    try {
      const configData: any = {
        enabled,
        provider,
        fromEmail,
        fromName,
        imapServer,
        imapUser,
        imapPassword,
      }

      if (provider === 'smtp') {
        configData.smtpHost = smtpHost
        configData.smtpPort = parseInt(smtpPort)
        configData.smtpSecure = smtpSecure
        configData.smtpUser = smtpUser
        configData.smtpPassword = smtpPassword
      } else if (provider === 'sendgrid') {
        configData.sendgridApiKey = sendgridApiKey
      } else if (provider === 'ses') {
        configData.sesRegion = sesRegion
        configData.sesAccessKeyId = sesAccessKeyId
        configData.sesSecretAccessKey = sesSecretAccessKey
      } else if (provider === 'resend') {
        configData.resendApiKey = resendApiKey
      }

      const response = await fetch('/api/integrations/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      })

      if (response.ok) {
        setSuccess('Email integration configured successfully!')
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Email Integration" size="2xl">
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

        {/* Configuration Status */}
        {isConfigured && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Info className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900">
                Currently configured with {providerConfig[provider].name}
              </p>
              {fromEmail && (
                <p className="text-xs text-blue-700 mt-1">
                  Sending from: {fromEmail} {fromName && `(${fromName})`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Enable Toggle */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                'p-3 rounded-xl transition-all duration-300',
                enabled
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25'
                  : 'bg-gray-100'
              )}>
                <Mail className={cn('h-6 w-6', enabled ? 'text-white' : 'text-gray-400')} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900">Enable Email Sending</h4>
                  {enabled && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0">Active</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {enabled ? 'Email sending is active' : 'Enable to start sending emails'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={cn(
                'relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-300',
                enabled ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gray-200'
              )}
            >
              <span className={cn(
                'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 mt-0.5',
                enabled ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'
              )} />
            </button>
          </div>
        </div>

        {/* Provider Selection */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold text-gray-900">Email Provider</h3>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {(Object.keys(providerConfig) as EmailProvider[]).map((p) => {
              const config = providerConfig[p]
              const Icon = config.icon
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProvider(p)}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                    provider === p
                      ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg shadow-blue-500/10'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <div className={cn(
                    'p-2 rounded-lg',
                    provider === p ? `bg-gradient-to-br ${config.gradient}` : 'bg-gray-100'
                  )}>
                    <Icon className={cn('h-5 w-5', provider === p ? 'text-white' : 'text-gray-400')} />
                  </div>
                  <span className={cn(
                    'text-sm font-medium',
                    provider === p ? 'text-blue-900' : 'text-gray-600'
                  )}>
                    {config.name}
                  </span>
                  {provider === p && (
                    <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-blue-500" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Common Fields */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold text-gray-900">Sender Information</h3>
          </div>
          <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">From Email <span className="text-red-500">*</span></Label>
                <Input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="h-10 bg-white"
                  placeholder="noreply@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">From Name</Label>
                <Input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  className="h-10 bg-white"
                  placeholder="Calitho Suite"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Provider-specific fields */}
        {provider === 'smtp' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-gray-500" />
              <h3 className="font-semibold text-gray-900">SMTP Configuration</h3>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">SMTP Host <span className="text-red-500">*</span></Label>
                  <Input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="h-10 bg-white"
                    placeholder="smtp.gmail.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">SMTP Port <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    className="h-10 bg-white"
                    placeholder="587"
                    required
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="smtpSecure"
                  checked={smtpSecure}
                  onChange={(e) => setSmtpSecure(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="smtpSecure" className="text-sm text-gray-600 cursor-pointer">
                  Use SSL/TLS (port 465)
                </Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Username <span className="text-red-500">*</span></Label>
                  <Input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    className="h-10 bg-white"
                    placeholder="username@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Password <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      onFocus={(e) => {
                        if (smtpPassword.includes('•')) {
                          e.target.select()
                          setTimeout(() => setSmtpPassword(''), 0)
                        }
                      }}
                      className="h-10 pr-10 bg-white"
                      placeholder="Enter your password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {provider === 'sendgrid' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900">SendGrid Configuration</h3>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">API Key <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={sendgridApiKey}
                    onChange={(e) => setSendgridApiKey(e.target.value)}
                    onFocus={() => {
                      if (sendgridApiKey.includes('•')) setSendgridApiKey('')
                    }}
                    className="h-10 font-mono text-sm pr-10 bg-white"
                    placeholder="SG.••••••••"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <a
                href="https://app.sendgrid.com/settings/api_keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                Get API Key from SendGrid Dashboard <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {provider === 'ses' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-gray-900">AWS SES Configuration</h3>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">AWS Region <span className="text-red-500">*</span></Label>
                <Select value={sesRegion} onValueChange={setSesRegion}>
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                    <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                    <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Access Key ID <span className="text-red-500">*</span></Label>
                  <Input
                    type="text"
                    value={sesAccessKeyId}
                    onChange={(e) => setSesAccessKeyId(e.target.value)}
                    className="h-10 font-mono text-sm bg-white"
                    placeholder="AKIA••••••••"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Secret Access Key <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={sesSecretAccessKey}
                      onChange={(e) => setSesSecretAccessKey(e.target.value)}
                      onFocus={() => {
                        if (sesSecretAccessKey === '••••••••') setSesSecretAccessKey('')
                      }}
                      className="h-10 font-mono text-sm pr-10 bg-white"
                      placeholder="••••••••"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {provider === 'resend' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-violet-500" />
              <h3 className="font-semibold text-gray-900">Resend Configuration</h3>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">API Key <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={resendApiKey}
                    onChange={(e) => setResendApiKey(e.target.value)}
                    onFocus={() => {
                      if (resendApiKey.includes('•')) setResendApiKey('')
                    }}
                    className="h-10 font-mono text-sm pr-10 bg-white"
                    placeholder="re_••••••••"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <a
                href="https://resend.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700"
              >
                Get API Key from Resend Dashboard <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {/* IMAP Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-rose-500" />
            <h3 className="font-semibold text-gray-900">IMAP Configuration</h3>
            <Badge variant="secondary" className="text-xs">Optional</Badge>
          </div>
          <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 space-y-4">
            <p className="text-xs text-gray-500">
              Configure IMAP settings to monitor incoming emails. Credentials are securely stored in AWS Secrets Manager.
            </p>
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">IMAP Server</Label>
              <Input
                type="text"
                value={imapServer}
                onChange={(e) => setImapServer(e.target.value)}
                className="h-10 bg-white"
                placeholder="imap.hostinger.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">IMAP Username</Label>
                <Input
                  type="email"
                  value={imapUser}
                  onChange={(e) => setImapUser(e.target.value)}
                  className="h-10 bg-white"
                  placeholder="info@calithosuite.com"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">IMAP Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={imapPassword}
                    onChange={(e) => setImapPassword(e.target.value)}
                    onFocus={(e) => {
                      if (imapPassword.includes('•')) {
                        e.target.select()
                        setTimeout(() => setImapPassword(''), 0)
                      }
                    }}
                    className="h-10 pr-10 bg-white"
                    placeholder="Enter IMAP password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Test Email */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-indigo-500" />
            <h3 className="font-semibold text-gray-900">Test Configuration</h3>
          </div>
          <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 space-y-3">
            <div className="flex gap-3">
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="h-10 flex-1 bg-white"
                placeholder="test@example.com"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-6"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Shield className="h-3.5 w-3.5" />
              <span>Credentials are encrypted and stored in AWS Secrets Manager</span>
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
            disabled={isLoading}
            className="px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/25"
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

'use client'

import { useState, useEffect } from 'react'
import { Modal } from '../Modal'

interface SendEmailIntegrationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type EmailProvider = 'smtp' | 'sendgrid' | 'ses' | 'resend'

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

        if (data.data?.provider) {
          setProvider(data.data.provider)
        }

        // Load all saved configuration (non-sensitive fields)
        if (data.data?.credentials) {
          const creds = data.data.credentials

          // Common fields
          if (creds.fromEmail) setFromEmail(creds.fromEmail)
          if (creds.fromName) setFromName(creds.fromName)

          // SMTP fields
          if (creds.smtpHost) setSmtpHost(creds.smtpHost)
          if (creds.smtpPort) setSmtpPort(creds.smtpPort.toString())
          if (creds.smtpSecure !== undefined) setSmtpSecure(creds.smtpSecure)
          if (creds.smtpUser) setSmtpUser(creds.smtpUser)

          // AWS SES fields
          if (creds.sesRegion) setSesRegion(creds.sesRegion)
          if (creds.sesAccessKeyId) setSesAccessKeyId(creds.sesAccessKeyId)
        }

        // Show masked credentials if they exist
        if (data.data?.maskedCredentials) {
          const masked = data.data.maskedCredentials
          if (masked.smtpPassword) setSmtpPassword(masked.smtpPassword)
          if (masked.sendgridApiKey) setSendgridApiKey(masked.sendgridApiKey)
          if (masked.sesSecretAccessKey) setSesSecretAccessKey(masked.sesSecretAccessKey)
          if (masked.resendApiKey) setResendApiKey(masked.resendApiKey)
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
      const testData: any = {
        provider,
        fromEmail,
        testEmail,
      }

      if (provider === 'smtp') {
        // Don't send masked password
        if (smtpPassword === '••••••••' || smtpPassword.includes('•')) {
          setError('Please enter your actual password (click the password field to update it)')
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
        const errorMessage = data.error || 'Failed to send test email'
        console.error('Test email failed:', data)
        setError(errorMessage)
      }
    } catch (error) {
      setError('Failed to test email configuration. Please try again.')
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

    // Validate common fields
    if (!fromEmail) {
      setError('From email address is required')
      setIsLoading(false)
      return
    }

    // Validate provider-specific fields
    if (provider === 'smtp') {
      if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
        setError('All SMTP fields are required')
        setIsLoading(false)
        return
      }
    } else if (provider === 'sendgrid') {
      if (!sendgridApiKey) {
        setError('SendGrid API key is required')
        setIsLoading(false)
        return
      }
    } else if (provider === 'ses') {
      if (!sesRegion || !sesAccessKeyId || !sesSecretAccessKey) {
        setError('All AWS SES fields are required')
        setIsLoading(false)
        return
      }
    } else if (provider === 'resend') {
      if (!resendApiKey) {
        setError('Resend API key is required')
        setIsLoading(false)
        return
      }
    }

    try {
      const configData: any = {
        enabled,
        provider,
        fromEmail,
        fromName,
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
    <Modal isOpen={isOpen} onClose={onClose} title="Send Emails Integration" size="xl">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Configuration Status */}
        {isConfigured && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  Currently configured with {provider.toUpperCase()}
                </p>
                {fromEmail && (
                  <p className="text-xs text-blue-700 mt-1">
                    Sending from: {fromEmail}
                    {fromName && ` (${fromName})`}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

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
                  ? 'Email sending is active'
                  : 'Integration is disabled. Enable to start sending emails'}
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

        {/* Provider Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Provider
            <span className="text-red-500 ml-1">*</span>
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as EmailProvider)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="smtp">SMTP</option>
            <option value="sendgrid">SendGrid</option>
            <option value="ses">AWS SES</option>
            <option value="resend">Resend</option>
          </select>
        </div>

        {/* Common Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Email
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="noreply@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Name</label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Calitho Suite"
            />
          </div>
        </div>

        {/* Provider-specific fields */}
        {provider === 'smtp' && (
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-semibold text-gray-900">SMTP Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SMTP Host
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="smtp.gmail.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SMTP Port
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="587"
                  required
                />
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="smtpSecure"
                checked={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="smtpSecure" className="ml-2 text-sm text-gray-700">
                Use SSL/TLS (port 465)
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="username@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    onFocus={(e) => {
                      // Clear masked password on focus
                      if (smtpPassword === '••••••••' || smtpPassword.includes('•')) {
                        e.target.select() // Select all so typing replaces it
                        setTimeout(() => setSmtpPassword(''), 0)
                      }
                    }}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {provider === 'sendgrid' && (
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-semibold text-gray-900">SendGrid Configuration</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="password"
                value={sendgridApiKey}
                onChange={(e) => setSendgridApiKey(e.target.value)}
                onFocus={() => {
                  // Clear masked API key on focus
                  if (sendgridApiKey.includes('••••••••')) {
                    setSendgridApiKey('')
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="SG.••••••••"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Get your API key from{' '}
                <a
                  href="https://app.sendgrid.com/settings/api_keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  SendGrid Dashboard
                </a>
              </p>
            </div>
          </div>
        )}

        {provider === 'ses' && (
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-semibold text-gray-900">AWS SES Configuration</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AWS Region
                <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                value={sesRegion}
                onChange={(e) => setSesRegion(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="us-east-1">US East (N. Virginia)</option>
                <option value="us-west-2">US West (Oregon)</option>
                <option value="eu-west-1">EU (Ireland)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Key ID
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={sesAccessKeyId}
                  onChange={(e) => setSesAccessKeyId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="AKIA••••••••"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secret Access Key
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="password"
                  value={sesSecretAccessKey}
                  onChange={(e) => setSesSecretAccessKey(e.target.value)}
                  onFocus={() => {
                    // Clear masked secret key on focus
                    if (sesSecretAccessKey === '••••••••') {
                      setSesSecretAccessKey('')
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {provider === 'resend' && (
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-semibold text-gray-900">Resend Configuration</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="password"
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
                onFocus={() => {
                  // Clear masked API key on focus
                  if (resendApiKey.includes('••••••••')) {
                    setResendApiKey('')
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="re_••••••••"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Get your API key from{' '}
                <a
                  href="https://resend.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  Resend Dashboard
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Test Email Section */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="text-sm font-semibold text-gray-900">Test Configuration</h4>
          <div className="flex gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="test@example.com"
            />
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 font-medium transition-colors"
            >
              {isTesting ? 'Sending...' : 'Send Test'}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Send a test email to verify your configuration. Credentials are securely stored in AWS
            Secrets Manager.
          </p>
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
            disabled={isLoading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
          >
            {isLoading ? 'Saving...' : isConfigured ? 'Update Configuration' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { EasyPostIntegrationModal } from './EasyPostIntegrationModal'
import ShipStationIntegrationModal from './ShipStationIntegrationModal'
import { NetSuiteIntegrationModal } from './NetSuiteIntegrationModal'
import { SendEmailIntegrationModal } from './SendEmailIntegrationModal'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Package,
  Ship,
  Briefcase,
  Mail,
  Plug,
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Integration {
  provider: string
  name: string
  description: string
  icon: React.ElementType
  color: string
  gradient: string
  configured: boolean
  enabled: boolean
}

export function IntegrationsSettings() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEasyPostModalOpen, setIsEasyPostModalOpen] = useState(false)
  const [isShipStationModalOpen, setIsShipStationModalOpen] = useState(false)
  const [isNetSuiteModalOpen, setIsNetSuiteModalOpen] = useState(false)
  const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState(false)

  useEffect(() => {
    fetchIntegrations()
  }, [])

  const fetchIntegrations = async () => {
    try {
      // Fetch EasyPost integration status
      const easypostResponse = await fetch('/api/integrations/easypost')
      const easypostData = await easypostResponse.json()

      // Fetch ShipStation integration status
      const shipstationResponse = await fetch('/api/integrations/shipstation')
      const shipstationData = await shipstationResponse.json()

      // Fetch NetSuite integration status
      const netsuiteResponse = await fetch('/api/integrations/netsuite')
      const netsuiteData = await netsuiteResponse.json()

      // Fetch Send Emails integration status
      const emailResponse = await fetch('/api/integrations/email')
      const emailData = await emailResponse.json()

      const integrationsList: Integration[] = [
        {
          provider: 'easypost',
          name: 'EasyPost',
          description: 'Shipping API for creating labels, tracking packages, and managing shipments.',
          icon: Package,
          color: 'text-orange-600',
          gradient: 'from-orange-500 to-amber-500',
          configured: easypostData.data?.configured || false,
          enabled: easypostData.data?.enabled || false,
        },
        {
          provider: 'shipstation',
          name: 'ShipStation',
          description: 'Multi-carrier shipping software with native multi-piece shipment support.',
          icon: Ship,
          color: 'text-blue-600',
          gradient: 'from-blue-500 to-cyan-500',
          configured: shipstationData.data?.configured || false,
          enabled: shipstationData.data?.enabled || false,
        },
        {
          provider: 'netsuite',
          name: 'NetSuite',
          description: 'Cloud ERP system for managing invoices, customers, and business operations.',
          icon: Briefcase,
          color: 'text-violet-600',
          gradient: 'from-violet-500 to-purple-500',
          configured: netsuiteData.data?.configured || false,
          enabled: netsuiteData.data?.sandboxEnabled || netsuiteData.data?.productionEnabled || false,
        },
        {
          provider: 'email',
          name: 'Send Emails',
          description: 'Configure email sending via SMTP, SendGrid, AWS SES, or Resend.',
          icon: Mail,
          color: 'text-emerald-600',
          gradient: 'from-emerald-500 to-teal-500',
          configured: emailData.data?.configured || false,
          enabled: emailData.data?.enabled || false,
        },
      ]

      setIntegrations(integrationsList)
    } catch (error) {
      console.error('Error fetching integrations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfigureIntegration = (provider: string) => {
    if (provider === 'easypost') {
      setIsEasyPostModalOpen(true)
    } else if (provider === 'shipstation') {
      setIsShipStationModalOpen(true)
    } else if (provider === 'netsuite') {
      setIsNetSuiteModalOpen(true)
    } else if (provider === 'email') {
      setIsSendEmailModalOpen(true)
    }
  }

  const handleIntegrationUpdated = () => {
    fetchIntegrations()
    setIsEasyPostModalOpen(false)
    setIsShipStationModalOpen(false)
    setIsNetSuiteModalOpen(false)
    setIsSendEmailModalOpen(false)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Loading integrations...</p>
      </div>
    )
  }

  const connectedCount = integrations.filter(i => i.enabled).length

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="flex items-center gap-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Plug className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{connectedCount}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Connected</p>
          </div>
        </div>
        <div className="h-10 w-px bg-blue-200" />
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Sparkles className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{integrations.length}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Available</p>
          </div>
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {integrations.map((integration) => {
          const Icon = integration.icon
          return (
            <Card
              key={integration.provider}
              className={cn(
                'group relative overflow-hidden border-0 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5',
                integration.enabled
                  ? 'bg-gradient-to-br from-white to-gray-50 ring-1 ring-green-200'
                  : 'bg-white'
              )}
            >
              {/* Status Indicator */}
              {integration.enabled && (
                <div className="absolute top-4 right-4">
                  <Badge className="bg-green-100 text-green-700 border-0 gap-1.5 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Connected
                  </Badge>
                </div>
              )}
              {integration.configured && !integration.enabled && (
                <div className="absolute top-4 right-4">
                  <Badge className="bg-gray-100 text-gray-600 border-0 gap-1.5 font-medium">
                    <Circle className="h-3.5 w-3.5" />
                    Disabled
                  </Badge>
                </div>
              )}

              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={cn(
                    'p-3 rounded-xl bg-gradient-to-br shadow-lg transition-transform duration-300 group-hover:scale-110',
                    integration.gradient
                  )}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {integration.name}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                      {integration.description}
                    </p>

                    {/* Action Button */}
                    <Button
                      onClick={() => handleConfigureIntegration(integration.provider)}
                      variant={integration.configured ? 'outline' : 'default'}
                      className={cn(
                        'w-full transition-all duration-200',
                        integration.configured
                          ? 'border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25'
                      )}
                    >
                      {integration.configured ? 'Manage Settings' : 'Connect'}
                      <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>

              {/* Decorative gradient border effect */}
              <div className={cn(
                'absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-100',
                integration.gradient
              )} />
            </Card>
          )
        })}
      </div>

      {/* Empty State (if no integrations in the future) */}
      {integrations.length === 0 && (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl mb-4">
            <Plug className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No integrations available</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Check back later for new integration options.
          </p>
        </div>
      )}

      {/* Modals */}
      {isEasyPostModalOpen && (
        <EasyPostIntegrationModal
          isOpen={isEasyPostModalOpen}
          onClose={() => setIsEasyPostModalOpen(false)}
          onSuccess={handleIntegrationUpdated}
        />
      )}

      {isShipStationModalOpen && (
        <ShipStationIntegrationModal
          isOpen={isShipStationModalOpen}
          onClose={() => setIsShipStationModalOpen(false)}
          onSave={handleIntegrationUpdated}
        />
      )}

      {isNetSuiteModalOpen && (
        <NetSuiteIntegrationModal
          isOpen={isNetSuiteModalOpen}
          onClose={() => setIsNetSuiteModalOpen(false)}
          onSuccess={handleIntegrationUpdated}
        />
      )}

      {isSendEmailModalOpen && (
        <SendEmailIntegrationModal
          isOpen={isSendEmailModalOpen}
          onClose={() => setIsSendEmailModalOpen(false)}
          onSuccess={handleIntegrationUpdated}
        />
      )}
    </div>
  )
}

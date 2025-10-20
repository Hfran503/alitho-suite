'use client'

import { useState, useEffect } from 'react'
import { EasyPostIntegrationModal } from './EasyPostIntegrationModal'
import ShipStationIntegrationModal from './ShipStationIntegrationModal'

interface Integration {
  provider: string
  name: string
  description: string
  icon: string
  configured: boolean
  enabled: boolean
}

export function IntegrationsSettings() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEasyPostModalOpen, setIsEasyPostModalOpen] = useState(false)
  const [isShipStationModalOpen, setIsShipStationModalOpen] = useState(false)

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

      const integrationsList: Integration[] = [
        {
          provider: 'easypost',
          name: 'EasyPost',
          description: 'Shipping API for creating labels, tracking packages, and managing shipments.',
          icon: '📦',
          configured: easypostData.data?.configured || false,
          enabled: easypostData.data?.enabled || false,
        },
        {
          provider: 'shipstation',
          name: 'ShipStation',
          description: 'Multi-carrier shipping software with native multi-piece shipment support.',
          icon: '🚢',
          configured: shipstationData.data?.configured || false,
          enabled: shipstationData.data?.enabled || false,
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
    }
  }

  const handleIntegrationUpdated = () => {
    fetchIntegrations()
    setIsEasyPostModalOpen(false)
    setIsShipStationModalOpen(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading integrations...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Integrations</h2>
        <p className="mt-1 text-sm text-gray-500">
          Connect third-party services to extend your application's functionality.
        </p>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <div
            key={integration.provider}
            className="relative flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex-1 p-6">
              {/* Icon and Status */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-4xl">{integration.icon}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {integration.name}
                    </h3>
                    {integration.configured && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          integration.enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {integration.enabled ? 'Connected' : 'Disabled'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="mt-4 text-sm text-gray-500">{integration.description}</p>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => handleConfigureIntegration(integration.provider)}
                className={`w-full px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  integration.configured
                    ? 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {integration.configured ? 'Manage' : 'Connect'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State (if no integrations in the future) */}
      {integrations.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-5xl mb-4">🔌</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No integrations available</h3>
          <p className="text-sm text-gray-500">
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
    </div>
  )
}

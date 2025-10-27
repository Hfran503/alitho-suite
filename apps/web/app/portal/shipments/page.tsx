'use client'

import { useState, useEffect } from 'react'
import { Truck, Package, Calendar, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Briefcase } from 'lucide-react'

interface JobComponent {
  id: string
  itemNumber: string
  description: string
  qtyOrdered?: number
  poNum?: string
}

interface Shipment {
  id: number
  job?: string
  jobNumber?: string
  shipDate?: string
  dateTime?: string
  deliveryDate?: string
  promiseDateTime?: string
  status?: string
  origin?: string
  destination?: string
  trackingNumber?: string
  name?: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  zip?: string
  u_csr_qty?: number
  jobComponents?: JobComponent[]
  [key: string]: any
}

interface ShipmentsByJob {
  job: string
  componentQty: number | undefined
  poNum?: string
  shipments: Shipment[]
}

interface ComponentGroup {
  itemNumber: string
  description: string
  componentId: string
  jobGroups: ShipmentsByJob[]
}

export default function PortalShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [customerID, setCustomerID] = useState('')
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set())
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchShipments()
  }, [])

  const fetchShipments = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/portal/shipments')
      const data = await response.json()

      if (response.ok) {
        console.log('Shipments data:', data.shipments)
        // Log first shipment's components to see PO data
        if (data.shipments?.[0]?.jobComponents) {
          console.log('First shipment components:', data.shipments[0].jobComponents)
        }
        setShipments(data.shipments || [])
        setCustomerID(data.customerID || '')

        if (data.error) {
          setError(data.message || data.error)
        }
      } else {
        setError(data.message || data.error || 'Failed to fetch shipments')
      }
    } catch (err) {
      console.error('Error fetching shipments:', err)
      setError('An error occurred while fetching shipments')
    } finally {
      setLoading(false)
    }
  }

  // Group shipments: Component -> Job -> Shipments
  const groupedShipments = (): ComponentGroup[] => {
    const componentMap = new Map<string, ComponentGroup>()

    shipments.forEach((shipment) => {
      const components = shipment.jobComponents || []

      if (components.length === 0) {
        // Handle shipments without components
        const key = 'unknown'
        if (!componentMap.has(key)) {
          componentMap.set(key, {
            itemNumber: 'Unknown',
            description: 'No item information',
            componentId: 'unknown',
            jobGroups: [],
          })
        }

        const group = componentMap.get(key)!
        const job = shipment.job || 'Unknown'
        let jobGroup = group.jobGroups.find((jg) => jg.job === job)

        if (!jobGroup) {
          jobGroup = {
            job,
            componentQty: undefined,
            shipments: [],
          }
          group.jobGroups.push(jobGroup)
        }

        jobGroup.shipments.push(shipment)
      } else {
        // Add shipment to each component it belongs to
        components.forEach((component) => {
          const key = component.itemNumber || component.id

          if (!componentMap.has(key)) {
            componentMap.set(key, {
              itemNumber: component.itemNumber || 'N/A',
              description: component.description || 'No description',
              componentId: component.id,
              jobGroups: [],
            })
          }

          const group = componentMap.get(key)!
          const job = shipment.job || 'Unknown'
          let jobGroup = group.jobGroups.find((jg) => jg.job === job)

          if (!jobGroup) {
            jobGroup = {
              job,
              componentQty: component.qtyOrdered,
              poNum: component.poNum,
              shipments: [],
            }
            group.jobGroups.push(jobGroup)
          }

          jobGroup.shipments.push(shipment)
        })
      }
    })

    return Array.from(componentMap.values()).sort((a, b) =>
      a.itemNumber.localeCompare(b.itemNumber)
    )
  }

  const toggleComponent = (key: string) => {
    const newExpanded = new Set(expandedComponents)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedComponents(newExpanded)
  }

  const toggleJob = (key: string) => {
    const newExpanded = new Set(expandedJobs)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedJobs(newExpanded)
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return 'N/A'
    return num.toLocaleString('en-US')
  }

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'bg-gray-100 text-gray-800'

    const statusLower = status.toLowerCase()
    if (statusLower.includes('deliver')) return 'bg-green-100 text-green-800'
    if (statusLower.includes('transit') || statusLower.includes('ship')) return 'bg-blue-100 text-blue-800'
    if (statusLower.includes('pending')) return 'bg-yellow-100 text-yellow-800'
    return 'bg-gray-100 text-gray-800'
  }

  const groups = groupedShipments()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shipments</h1>
          <p className="text-gray-600 mt-1">
            View your shipments organized by item and job
            {customerID && <span className="text-sm ml-2">(Customer ID: {customerID})</span>}
          </p>
        </div>
        <button
          onClick={fetchShipments}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Loading shipments...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-yellow-900">Notice</h3>
            <p className="text-yellow-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && shipments.length === 0 && (
        <div className="text-center py-12">
          <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No shipments found</h3>
          <p className="text-gray-600">There are no shipments available for your account.</p>
        </div>
      )}

      {/* Level 1: Components */}
      {!loading && !error && groups.length > 0 && (
        <div className="space-y-4">
          {groups.map((componentGroup) => {
            const isComponentExpanded = expandedComponents.has(componentGroup.componentId)
            const totalShipments = componentGroup.jobGroups.reduce((sum, jg) => sum + jg.shipments.length, 0)

            return (
              <div key={componentGroup.componentId} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Level 1: Component Header */}
                <button
                  onClick={() => toggleComponent(componentGroup.componentId)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-blue-600" />
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">
                        Item #{componentGroup.itemNumber}
                      </h3>
                      <p className="text-sm text-gray-600">{componentGroup.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600">
                      {componentGroup.jobGroups.length} {componentGroup.jobGroups.length === 1 ? 'job' : 'jobs'} • {totalShipments} {totalShipments === 1 ? 'shipment' : 'shipments'}
                    </span>
                    {isComponentExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Level 2: Jobs */}
                {isComponentExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    {componentGroup.jobGroups.map((jobGroup) => {
                      const jobKey = `${componentGroup.componentId}-${jobGroup.job}`
                      const isJobExpanded = expandedJobs.has(jobKey)

                      return (
                        <div key={jobKey} className="border-b border-gray-200 last:border-b-0">
                          {/* Level 2: Job Header */}
                          <button
                            onClick={() => toggleJob(jobKey)}
                            className="w-full flex items-center justify-between p-3 px-6 hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Briefcase className="w-4 h-4 text-gray-600" />
                              <div className="text-left">
                                <span className="font-medium text-gray-900">
                                  {jobGroup.poNum && (
                                    <span className="text-gray-600">PO: {jobGroup.poNum} - </span>
                                  )}
                                  Job: {jobGroup.job}
                                </span>
                                {jobGroup.componentQty !== undefined && jobGroup.componentQty !== null && (
                                  <span className="ml-3 text-sm text-gray-600">
                                    Component Qty: {formatNumber(jobGroup.componentQty)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-gray-600">
                                {jobGroup.shipments.length} {jobGroup.shipments.length === 1 ? 'shipment' : 'shipments'}
                              </span>
                              {isJobExpanded ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                          </button>

                          {/* Level 3: Shipments */}
                          {isJobExpanded && (
                            <div className="bg-white divide-y divide-gray-200">
                              {jobGroup.shipments.map((shipment) => (
                                <div key={shipment.id} className="p-4 px-8">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Shipment Info & Status */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Truck className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm font-medium text-gray-700">
                                          Shipment #{shipment.id}
                                        </span>
                                      </div>
                                      {shipment.u_csr_qty !== undefined && shipment.u_csr_qty !== null && (
                                        <div className="text-sm text-gray-600 mb-1">
                                          <span className="font-medium">Qty:</span> {formatNumber(shipment.u_csr_qty)}
                                        </div>
                                      )}
                                      {shipment.status && (
                                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(shipment.status)}`}>
                                          {shipment.status}
                                        </span>
                                      )}
                                    </div>

                                    {/* Dates */}
                                    <div>
                                      {shipment.promiseDateTime && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                          <Calendar className="w-4 h-4" />
                                          <span className="font-medium">Promise: {formatDate(shipment.promiseDateTime)}</span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                        <Calendar className="w-4 h-4" />
                                        <span>Ship: {formatDate(shipment.shipDate || shipment.dateTime)}</span>
                                      </div>
                                      {shipment.deliveryDate && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                          <Calendar className="w-4 h-4" />
                                          <span>Delivery: {formatDate(shipment.deliveryDate)}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Ship To */}
                                    <div>
                                      {(shipment.name || shipment.address1 || shipment.city) && (
                                        <div className="text-sm">
                                          {shipment.name && (
                                            <div className="font-medium text-gray-700 mb-0.5">{shipment.name}</div>
                                          )}
                                          {shipment.address1 && (
                                            <div className="text-gray-600 text-xs">{shipment.address1}</div>
                                          )}
                                          {shipment.address2 && (
                                            <div className="text-gray-600 text-xs">{shipment.address2}</div>
                                          )}
                                          {(shipment.city || shipment.state || shipment.zip) && (
                                            <div className="text-gray-600 text-xs">
                                              {[shipment.city, shipment.state, shipment.zip].filter(Boolean).join(', ')}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Tracking */}
                                    <div>
                                      {shipment.trackingNumber && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                          <Truck className="w-4 h-4" />
                                          <span className="font-mono text-xs">{shipment.trackingNumber}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

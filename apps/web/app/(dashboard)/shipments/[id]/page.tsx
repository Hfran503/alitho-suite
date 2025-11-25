'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { JobShipment, Carton } from '@repo/types'
import { formatDateOnlyPT } from '@/lib/dateUtils'
import { ProcessShipmentParcelModal } from '@/components/shipments/ProcessShipmentParcelModal'
import { ProcessShipmentShipStationModal } from '@/components/shipments/ProcessShipmentShipStationModal'

export default function ShipmentDetailsPage() {
  const params = useParams()
  const shipmentId = params.id as string

  const [shipment, setShipment] = useState<JobShipment | null>(null)
  const [cartons, setCartons] = useState<Carton[]>([])
  const [_labels, setLabels] = useState<any[]>([])
  const [returnLabels, setReturnLabels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCartons, setLoadingCartons] = useState(false)
  const [_loadingLabels, setLoadingLabels] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'special' | 'other'>('details')
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [showProcessSkidsModal, setShowProcessSkidsModal] = useState(false)
  const [showProcessParcelModal, setShowProcessParcelModal] = useState(false)
  const [editingCarton, setEditingCarton] = useState<Carton | null>(null)
  const [cancelingLabels, setCancelingLabels] = useState(false)
  const [reprintingLabel, setReprintingLabel] = useState(false)

  // Integration detection state
  const [activeIntegration, setActiveIntegration] = useState<'easypost' | 'shipstation' | null>(null)
  const [integrationLoading, setIntegrationLoading] = useState(false)
  const [integrationCheckRequested, setIntegrationCheckRequested] = useState(false)

  // Lookup descriptions
  const [shipViaDescription, setShipViaDescription] = useState<string | null>(null)
  const [shipViaProvider, setShipViaProvider] = useState<string | null>(null)
  const [shipmentTypeDescription, setShipmentTypeDescription] = useState<string | null>(null)

  // Job details
  const [jobDescription, setJobDescription] = useState<string | null>(null)
  const [jobCustomer, setJobCustomer] = useState<string | null>(null)
  const [jobCustomerName, setJobCustomerName] = useState<string | null>(null)
  const [jobSalesperson, setJobSalesperson] = useState<string | null>(null)

  // Contact company name
  const [companyName, setCompanyName] = useState<string | null>(null)

  // Modal-specific state for fresh data
  const [modalShipment, setModalShipment] = useState<JobShipment | null>(null)
  const [modalCartons, setModalCartons] = useState<Carton[] | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    if (shipmentId) {
      fetchShipment()
      fetchCartons()
      fetchLabels()
    }
  }, [shipmentId])

  // Fetch fresh data when Edit Shipment modal opens
  useEffect(() => {
    if (showProcessSkidsModal && shipmentId) {
      const fetchModalData = async () => {
        setModalLoading(true)
        try {
          const [shipmentRes, cartonsRes] = await Promise.all([
            fetch(`/api/pace/shipments/${shipmentId}`),
            fetch(`/api/pace/shipments/${shipmentId}/cartons`)
          ])

          if (shipmentRes.ok) {
            const shipmentData = await shipmentRes.json()
            if (shipmentData.success) {
              setModalShipment(shipmentData.data)
            }
          }

          if (cartonsRes.ok) {
            const cartonsData = await cartonsRes.json()
            if (cartonsData.success) {
              setModalCartons(cartonsData.data || [])
            }
          }
        } catch (err) {
          console.error('Error fetching modal data:', err)
        } finally {
          setModalLoading(false)
        }
      }
      fetchModalData()
    } else {
      // Reset modal data when closed
      setModalShipment(null)
      setModalCartons(null)
    }
  }, [showProcessSkidsModal, shipmentId])

  const fetchShipment = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/pace/shipments/${shipmentId}`)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('API Error Response:', errorData)

        if (errorData.details?.response?.message === 'System License Expired') {
          throw new Error('PACE System License Expired. Please contact your PACE administrator to renew the license.')
        }

        throw new Error(errorData.error || 'Failed to fetch shipment')
      }

      const data = await response.json()

      if (data.success) {
        setShipment(data.data)

        // Fetch lookup descriptions in parallel
        const lookupPromises = []

        if (data.data.shipVia) {
          lookupPromises.push(
            fetch(`/api/pace/lookup/ShipVia/${data.data.shipVia}`)
              .then(res => res.json())
              .then(result => {
                if (result.success) {
                  setShipViaDescription(result.data.description)

                  if (result.data.provider) {
                    return fetch(`/api/pace/lookup/ShipProvider/${result.data.provider}`)
                      .then(res => res.json())
                      .then(providerResult => {
                        if (providerResult.success) {
                          setShipViaProvider(providerResult.data.description)
                        }
                      })
                  }
                }
              })
              .catch(err => console.error('Error fetching ShipVia:', err))
          )
        }

        if (data.data.shipmentType) {
          lookupPromises.push(
            fetch(`/api/pace/lookup/ShipmentType/${data.data.shipmentType}`)
              .then(res => res.json())
              .then(result => {
                if (result.success) {
                  setShipmentTypeDescription(result.data.description)
                }
              })
              .catch(err => console.error('Error fetching ShipmentType:', err))
          )
        }

        if (data.data.job) {
          lookupPromises.push(
            fetch(`/api/pace/lookup/Job/${encodeURIComponent(data.data.job)}`)
              .then(res => res.json())
              .then(async (result) => {
                if (result.success) {
                  setJobDescription(result.data.description)
                  setJobCustomer(result.data.customer)

                  // Fetch customer name
                  if (result.data.customer) {
                    try {
                      const customerResponse = await fetch(`/api/pace/customers/${encodeURIComponent(result.data.customer)}`)
                      const customerData = await customerResponse.json()
                      if (customerData.success) {
                        setJobCustomerName(customerData.data.custName || customerData.data.id)
                      }
                    } catch (err) {
                      console.error('Error fetching Customer:', err)
                    }
                  }

                  if (result.data.salesPerson) {
                    return fetch(`/api/pace/lookup/SalesPerson/${result.data.salesPerson}`)
                      .then(res => res.json())
                      .then(salesResult => {
                        if (salesResult.success) {
                          setJobSalesperson(salesResult.data.name)
                        }
                      })
                  }
                }
              })
              .catch(err => console.error('Error fetching Job:', err))
          )
        }

        // Fetch company name through JobContact -> Contact chain
        if (data.data.jobContact) {
          lookupPromises.push(
            fetch(`/api/pace/lookup/JobContact/${data.data.jobContact}`)
              .then(res => res.json())
              .then(result => {
                if (result.success && result.data.contact) {
                  // Now fetch the Contact to get company name
                  return fetch(`/api/pace/lookup/Contact/${result.data.contact}`)
                    .then(res => res.json())
                    .then(contactResult => {
                      if (contactResult.success) {
                        setCompanyName(contactResult.data.companyName)
                      }
                    })
                }
              })
              .catch(err => console.error('Error fetching company name:', err))
          )
        }

        await Promise.all(lookupPromises)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Fetch shipment error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCartons = async () => {
    setLoadingCartons(true)

    try {
      const response = await fetch(`/api/pace/shipments/${shipmentId}/cartons`)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Cartons API Error Response:', errorData)
        // Don't throw error, just log it - cartons are optional
        return
      }

      const data = await response.json()

      if (data.success) {
        setCartons(data.data || [])
      }
    } catch (err) {
      console.error('Fetch cartons error:', err)
      // Don't set error state - cartons are optional
    } finally {
      setLoadingCartons(false)
    }
  }

  const fetchLabels = async () => {
    setLoadingLabels(true)

    try {
      const response = await fetch(`/api/labels/by-shipment/${shipmentId}`)

      if (!response.ok) {
        console.error('Failed to fetch labels')
        return
      }

      const data = await response.json()

      if (data.success) {
        setLabels(data.data.labels || [])
        setReturnLabels(data.data.returnLabels || [])
      }
    } catch (err) {
      console.error('Fetch labels error:', err)
    } finally {
      setLoadingLabels(false)
    }
  }

  // Handler to open Edit Shipment modal - opens immediately, data fetches in background
  const handleOpenEditShipmentModal = () => {
    setShowProcessSkidsModal(true)
  }

  // Group cartons by skid for professional display
  const groupedCartons = useMemo(() => {
    const groups: {
      skids: Map<number, { skid: number; description?: string; weight?: number; count?: number; cartons: Carton[] }>
      noSkid: Carton[]
    } = {
      skids: new Map(),
      noSkid: [],
    }

    cartons.forEach((carton) => {
      if (carton.skid) {
        if (!groups.skids.has(carton.skid)) {
          groups.skids.set(carton.skid, {
            skid: carton.skid,
            description: carton.skidDescription,
            weight: carton.skidWeight,
            count: carton.skidCount,
            cartons: [],
          })
        }
        groups.skids.get(carton.skid)!.cartons.push(carton)
      } else {
        groups.noSkid.push(carton)
      }
    })

    return groups
  }, [cartons])

  // Helper function to check if PO validation passes
  const isPOValid = (): boolean => {
    if (!shipment) return true // If no shipment loaded yet, don't block

    // Check if PO validation enforcement is enabled in settings
    const enforcePoValidation = (shipment as any).enforcePoValidation
    if (enforcePoValidation === false) return true // Validation disabled in settings

    const customerPORequired = (shipment as any).customerPORequired
    const jobPO = (shipment as any).jobPoNum?.trim()
    const proposalPO = (shipment as any).proposalPO?.trim()

    // If customer doesn't require PO, validation passes
    if (customerPORequired !== '1') return true

    // If both POs are empty, validation fails
    if (!jobPO && !proposalPO) return false

    // If both have values but don't match, validation fails
    if (jobPO && proposalPO && jobPO !== proposalPO) return false

    // Otherwise, validation passes
    return true
  }

  // Get PO validation error message
  const getPOErrorMessage = (): string | null => {
    if (!shipment) return null

    // Check if PO validation enforcement is enabled
    const enforcePoValidation = (shipment as any).enforcePoValidation
    if (enforcePoValidation === false) return null // Validation disabled in settings

    const customerPORequired = (shipment as any).customerPORequired
    const jobPO = (shipment as any).jobPoNum?.trim()
    const proposalPO = (shipment as any).proposalPO?.trim()

    if (customerPORequired !== '1') return null

    if (!jobPO && !proposalPO) {
      return 'Cannot process shipment: Customer requires a PO number'
    }

    if (jobPO && proposalPO && jobPO !== proposalPO) {
      return 'Cannot process shipment: PO numbers do not match'
    }

    return null
  }

  const handleDeleteAllCartons = async () => {
    if (!cartons || cartons.length === 0) return

    const confirmed = window.confirm(
      `Are you sure you want to delete ALL ${cartons.length} carton(s)? This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      setLoadingCartons(true)

      // Delete all cartons in parallel
      const deletePromises = cartons.map(carton =>
        fetch(`/api/pace/cartons/${carton.id}`, { method: 'DELETE' })
      )

      await Promise.all(deletePromises)

      // Refresh cartons list
      await fetchCartons()
    } catch (err) {
      console.error('Delete all cartons error:', err)
      alert('Failed to delete all cartons. Please try again.')
    } finally {
      setLoadingCartons(false)
    }
  }

  // Check which shipping integration is active
  const checkActiveIntegration = async () => {
    setIntegrationLoading(true)
    try {
      // Check both integrations in parallel
      const [easypostRes, shipstationRes] = await Promise.all([
        fetch('/api/integrations/easypost'),
        fetch('/api/integrations/shipstation'),
      ])

      const [easypostData, shipstationData] = await Promise.all([
        easypostRes.json(),
        shipstationRes.json(),
      ])

      // Determine which one is enabled AND configured (has API keys)
      // Both conditions must be true: enabled in DB and has API keys in Secrets Manager
      if (easypostData.data?.enabled && easypostData.data?.configured) {
        setActiveIntegration('easypost')
      } else if (shipstationData.data?.enabled && shipstationData.data?.configured) {
        setActiveIntegration('shipstation')
      } else {
        setActiveIntegration(null)
      }
    } catch (err) {
      console.error('Failed to check integrations:', err)
      setActiveIntegration(null)
    } finally {
      setIntegrationLoading(false)
    }
  }

  // Handle Process Parcel button click with integration detection
  const handleProcessParcelClick = async () => {
    setIntegrationCheckRequested(true)
    await checkActiveIntegration()

    // The actual modal opening will happen after integration is determined
    // We'll use useEffect to watch for activeIntegration changes
  }

  // Open the appropriate modal based on active integration
  useEffect(() => {
    // Only run if user clicked the button
    if (!integrationCheckRequested) return
    if (integrationLoading) return // Still checking

    // Only proceed if we just checked and have a result
    if (activeIntegration === 'easypost') {
      setShowProcessParcelModal(true)
      setIntegrationCheckRequested(false) // Reset flag
    } else if (activeIntegration === 'shipstation') {
      setShowProcessParcelModal(true) // Will use ShipStation modal
      setIntegrationCheckRequested(false) // Reset flag
    } else if (activeIntegration === null && !integrationLoading) {
      // Only show error if we explicitly checked and found nothing
      const errorMsg =
        'No shipping integration is configured. Please configure EasyPost or ShipStation in Settings before processing parcels.'
      setError(errorMsg)
      alert(errorMsg)
      setIntegrationCheckRequested(false) // Reset flag
    }
  }, [activeIntegration, integrationLoading, integrationCheckRequested])

  const handleReprintLabel = async (carton: Carton) => {
    if (!carton.id || reprintingLabel) return

    setReprintingLabel(true)

    try {
      // Get label from database
      const response = await fetch('/api/labels/reprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartonId: carton.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to retrieve label')
      }

      const data = await response.json()

      if (data.data.labelUrl) {
        window.open(data.data.labelUrl, '_blank')
      } else {
        alert('No label URL found for this carton')
      }
    } catch (err) {
      console.error('Reprint label error:', err)
      alert(err instanceof Error ? err.message : 'Failed to reprint label. Please try again.')
    } finally {
      setReprintingLabel(false)
    }
  }

  const handleReprintAllLabels = async () => {
    const labelsToReprint = cartons.filter(c => c.trackingNumber)

    if (labelsToReprint.length === 0) {
      alert('No labels found to reprint')
      return
    }

    // Just reprint the first carton's label (which contains all labels in one PDF)
    const firstCarton = labelsToReprint[0]
    await handleReprintLabel(firstCarton)
  }

  const handleCancelLabels = async () => {
    if (!cartons || cartons.length === 0) return

    // Check if any cartons have tracking numbers
    const hasTracking = cartons.some(c => c.trackingNumber)
    const hasReturnLabels = returnLabels.length > 0

    let message = hasTracking
      ? `Are you sure you want to cancel ALL labels and delete ALL cartons?\n\nThis will:\n• Void/refund ${cartons.length} label(s) (if applicable)\n• Delete all ${cartons.length} carton(s) and their contents\n• Clear tracking and cost data from the shipment`
      : `Are you sure you want to delete ALL ${cartons.length} carton(s) and clear shipment data?`

    if (hasReturnLabels) {
      message += `\n• Void ${returnLabels.length} return label(s)`
    }

    message += `\n\nThis action cannot be undone.`

    const confirmed = window.confirm(message)
    if (!confirmed) return

    try {
      setCancelingLabels(true)
      setError(null)

      const response = await fetch(`/api/pace/shipments/${shipmentId}/cancel-labels`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to cancel labels')
      }

      const result = await response.json()
      console.log('Cancel labels result:', result)

      // Show summary
      let summary = `Successfully cancelled labels and cleaned up data.\n\n`
      summary += `• Deleted cartons: ${result.data.deletedCartons}\n`
      if (result.data.canceledLabels > 0) {
        summary += `• Refunded labels: ${result.data.canceledLabels}\n`
      }
      if (result.data.failedCancellations > 0) {
        summary += `• Failed label refunds: ${result.data.failedCancellations}\n`
      }
      if (result.data.failedDeletions > 0) {
        summary += `• Failed deletions: ${result.data.failedDeletions}\n`
      }

      alert(summary)

      // Refresh data
      await fetchCartons()
      await fetchShipment()
      await fetchLabels()
    } catch (err) {
      console.error('Cancel labels error:', err)
      setError(err instanceof Error ? err.message : 'Failed to cancel labels')
      alert('Failed to cancel labels. Please try again.')
    } finally {
      setCancelingLabels(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="p-12 text-center text-gray-500">Loading shipment details...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <Link href="/shipments" className="text-blue-600 hover:text-blue-800">
            ← Back to Shipments
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="w-full px-6">
        <div className="mb-4">
          <Link href="/shipments" className="text-blue-600 hover:text-blue-800">
            ← Back to Shipments
          </Link>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          Shipment not found
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-6">
      {/* Header with Status Badge */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Shipment #{shipment.id}</h1>
        <div className="flex items-center gap-4">
          {/* Print Shipping Instructions Button */}
          <button
            onClick={() => {
              const today = new Date()
              const dateParam = `Date(${today.getFullYear()},${today.getMonth() + 1},${today.getDate()})`
              const reportUrl = `http://epace.calitho.com/reports/company:public/reportReader/view/Shipping+Instruction.pdf?init=pdf&prompt0=${shipment.id}&prompt1=${shipment.id}&prompt2=${encodeURIComponent(dateParam)}&prompt3=&prompt4=byCL&prompt5=&prompt6=&showlogo=false&version=22.10&schema=public&selectedLanguage=en&exportfilename=Shipping+Instruction.pdf&key=10044&baseObjectKey=${shipment.id}`
              window.open(reportUrl, '_blank')
            }}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Shipping Instructions
          </button>
          {/* Print Packing Slip Button */}
          <button
            onClick={() => {
              const today = new Date()
              const dateParam = `Date(${today.getFullYear()},${today.getMonth() + 1},${today.getDate()})`
              const reportUrl = `http://epace.calitho.com/reports/company:public/reportReader/view/Packing+Slip.pdf?init=pdf&prompt0=${shipment.id}&prompt1=${shipment.id}&prompt2=${encodeURIComponent(dateParam)}&prompt3=&prompt4=byCL&prompt5=&showlogo=false&version=22.10&schema=public&selectedLanguage=en&exportfilename=Packing+Slip.pdf&key=10091&baseObjectKey=${shipment.id}`
              window.open(reportUrl, '_blank')
            }}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Print Packing Slip
          </button>
          {/* Print COC Button */}
          <button
            onClick={() => {
              const today = new Date()
              const dateParam = `Date(${today.getFullYear()},${today.getMonth() + 1},${today.getDate()})`
              const reportUrl = `http://epace.calitho.com/reports/company:public/reportReader/view/COC.pdf?init=pdf&prompt0=${shipment.id}&prompt1=${shipment.id}&prompt2=${encodeURIComponent(dateParam)}&prompt3=&prompt4=byCL&prompt5=&showlogo=false&version=22.10&schema=public&selectedLanguage=en&exportfilename=COC.pdf&key=10098&baseObjectKey=${shipment.id}`
              window.open(reportUrl, '_blank')
            }}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Print COC
          </button>
          <Link href="/shipments" className="text-sm text-blue-600 hover:text-blue-800">
            ← Back to Shipments
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('details')}
            className={`${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Shipment Details
          </button>
          <button
            onClick={() => setActiveTab('special')}
            className={`${
              activeTab === 'special'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2`}
          >
            Special Information
            {shipment.u_specialinformation && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                ⚠
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('other')}
            className={`${
              activeTab === 'other'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Other Info
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' ? (
        <>
        {/* PO Warning Banner - Show at top if there's an issue */}
        {(() => {
          // Check if PO validation enforcement is enabled in settings
          const enforcePoValidation = (shipment as any).enforcePoValidation
          if (enforcePoValidation === false) return null // Validation disabled in settings

          const customerPORequired = (shipment as any).customerPORequired
          const jobPO = (shipment as any).jobPoNum?.trim()
          const proposalPO = (shipment as any).proposalPO?.trim()

          // Only validate PO if customer requires it (1 = required)
          if (customerPORequired !== '1') {
            return null
          }

          // Both are empty - ISSUE
          if (!jobPO && !proposalPO) {
            return (
              <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded">
                <div className="flex items-start">
                  <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="ml-3">
                    <h3 className="text-base font-semibold text-red-800">Missing PO Number (Required)</h3>
                    <p className="text-sm text-red-700 mt-1">This customer requires a PO number. Please add a PO number to the job or proposal before processing this shipment.</p>
                  </div>
                </div>
              </div>
            )
          }

          // Both have values but don't match - ISSUE
          if (jobPO && proposalPO && jobPO !== proposalPO) {
            return (
              <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded">
                <div className="flex items-start">
                  <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="ml-3">
                    <h3 className="text-base font-semibold text-red-800">PO Number Mismatch</h3>
                    <p className="text-sm text-red-700 mt-1">
                      The PO numbers don't match: <strong>Job PO: {jobPO}</strong> ≠ <strong>Proposal PO: {proposalPO}</strong>
                    </p>
                  </div>
                </div>
              </div>
            )
          }

          // One has value, other is empty - OK, no issue shown
          return null
        })()}

        {/* Top Section - Job & Shipping Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">

        {/* Left Column - Job & Customer Info */}
        <div className="lg:col-span-2 space-y-3 flex flex-col">

          {/* Job Information Card */}
          <div className="bg-white rounded border border-gray-200 flex-1">
            <div className="border-b border-gray-200 px-4 py-2 bg-gray-50">
              <h2 className="text-xs font-semibold text-gray-700 uppercase">Job Information</h2>
            </div>
            <div className="p-4 space-y-3">
              {/* Job Number */}
              <div className="flex items-start justify-between border-b border-gray-100 pb-3 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Job Number</div>
                  <div className="text-2xl font-bold text-gray-900">{shipment.job || 'N/A'}</div>
                </div>
                {shipmentTypeDescription && (
                  <div className="flex flex-wrap gap-1.5 justify-end max-w-md">
                    {shipmentTypeDescription.split('|').map((type, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-xs text-gray-600 bg-gray-100 border border-gray-200 whitespace-normal">
                        {type.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Job Description */}
              {jobDescription && (
                <div className="text-sm text-gray-900 border-b border-gray-100 pb-3">{jobDescription}</div>
              )}

              {/* Customer and Salesperson */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm pt-1 pb-2">
                {(jobCustomerName || jobCustomer) && (
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500 mb-0.5">Customer</div>
                    <div className="font-semibold text-gray-900 break-words">
                      {jobCustomerName || jobCustomer}
                    </div>
                  </div>
                )}
                {jobSalesperson && (
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500 mb-0.5">Salesperson</div>
                    <div className="font-semibold text-gray-900 break-words">
                      {jobSalesperson}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Shipping & Destination Card */}
          <div className="bg-white rounded border border-gray-200 flex-1">
            <div className="border-b border-gray-200 px-4 py-2 bg-gray-50">
              <h2 className="text-xs font-semibold text-gray-700 uppercase">Shipping & Destination</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {/* Destination */}
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">Ship To</div>
                  {companyName && <div className="font-bold text-gray-900 mb-1">{companyName}</div>}
                  {(shipment.contactFirstName || shipment.contactLastName) && (
                    <div className="font-semibold text-gray-700 mb-2">
                      {[shipment.contactFirstName, shipment.contactLastName].filter(Boolean).join(' ')}
                    </div>
                  )}
                  <div className="text-gray-600 space-y-0.5">
                    {shipment.address1 && <div>{shipment.address1}</div>}
                    {shipment.address2 && <div>{shipment.address2}</div>}
                    {shipment.address3 && <div>{shipment.address3}</div>}
                    {(shipment.city || shipment.state || shipment.zip) && (
                      <div className="font-medium">{[shipment.city, shipment.state, shipment.zip].filter(Boolean).join(', ')}</div>
                    )}
                  </div>
                  {(shipment.phone || shipment.email) && (
                    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                      {shipment.phone && <div className="text-gray-700">{shipment.phone}</div>}
                      {shipment.email && <div className="text-gray-600 truncate">{shipment.email}</div>}
                    </div>
                  )}
                </div>

                {/* Shipping Method */}
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">Shipping Method</div>
                  {shipViaDescription && (
                    <div className="mb-2">
                      <div className="text-xs text-gray-500">Carrier</div>
                      <div className="font-bold text-gray-900">{shipViaDescription}</div>
                      {shipViaProvider && <div className="text-xs text-gray-600 mt-0.5">{shipViaProvider}</div>}
                    </div>
                  )}
                  {shipment.trackingNumber && (
                    <div className="mb-2">
                      <div className="text-xs text-gray-500">Tracking Number</div>
                      <div className="font-mono text-xs font-semibold text-gray-900">{shipment.trackingNumber}</div>
                    </div>
                  )}
                  {shipment.shipViaNote && (
                    <div className="text-xs text-gray-600 bg-amber-50 p-2 rounded border border-amber-200">
                      {shipment.shipViaNote}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {shipment.notes && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900">Notes</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">General Notes</label>
                    <p className="text-base text-gray-700 mt-1 whitespace-pre-wrap">{shipment.notes}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Shipment Details */}
        <div className="space-y-3 flex flex-col">

          {/* Dates Section */}
          <div className="bg-white rounded border border-gray-200 overflow-hidden flex-1">
            <div className="border-b border-gray-200 px-4 py-2 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-700 uppercase">Dates</h3>
            </div>
            <div className="p-4 space-y-2 text-sm">
              {shipment.dateTime && (
                <div className="border-b border-gray-100 pb-2">
                  <div className="text-xs text-gray-500 mb-1">Shipment Date</div>
                  <div className="font-semibold text-gray-900">{formatDateOnlyPT(shipment.dateTime)}</div>
                </div>
              )}
              {shipment.u_create_date && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Created</div>
                  <div className="font-semibold text-gray-900">{formatDateOnlyPT(shipment.u_create_date)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Quantity & Type */}
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-2 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-700 uppercase">Shipment Details</h3>
            </div>
            <div className="p-4 space-y-2 text-sm">
              {shipment.u_csr_qty && shipment.u_csr_qty !== '0' && (
                <div className="border-b border-gray-100 pb-2">
                  <div className="text-xs text-gray-500 mb-1">Planned Qty</div>
                  <div className="text-xl font-bold text-gray-900">{shipment.u_csr_qty}</div>
                </div>
              )}
              <div className="border-b border-gray-100 pb-2">
                <div className="text-xs text-gray-500 mb-1">Quantity</div>
                <div className="text-2xl font-bold text-gray-900">{shipment.quantity || '-'}</div>
              </div>
              {shipment.charges && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Shipping Charges</div>
                  <div className="font-semibold text-gray-900">{shipment.charges}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full Width Cartons Section */}
      <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Configuration {!loadingCartons && cartons.length > 0 && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    {(() => {
                      const totalCartonCount = cartons.reduce((sum, carton) => {
                        const skidCount = carton.skidCount || 1
                        const cartonCount = carton.count || 1
                        return sum + (skidCount * cartonCount)
                      }, 0)
                      return `(${totalCartonCount} carton${totalCartonCount !== 1 ? 's' : ''})`
                    })()}
                  </span>
                )}
              </h2>
            </div>

            {loadingCartons ? (
              <div className="text-center py-8 text-gray-500">
                Loading configuration...
              </div>
            ) : cartons.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📦</div>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No Configuration Found</h3>
                <p className="text-gray-500 mb-6">This shipment hasn't been processed yet.</p>
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  <button
                    onClick={handleOpenEditShipmentModal}
                    disabled={!isPOValid()}
                    title={getPOErrorMessage() || undefined}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Process Shipment
                  </button>
                  <button
                    onClick={handleProcessParcelClick}
                    disabled={integrationLoading || !isPOValid()}
                    title={getPOErrorMessage() || undefined}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    {integrationLoading ? 'Checking Integration...' : 'Process Shipment for Parcel'}
                  </button>
                </div>
                {!isPOValid() && (
                  <div className="mt-4 text-center text-sm text-red-600 font-medium">
                    {getPOErrorMessage()}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Action Buttons when cartons exist */}
                {(() => {
                  // Check if any cartons have labels (processed via parcel modal)
                  const hasLabels = cartons.some(c => c.trackingNumber)

                  return (
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex gap-3">
                        {!hasLabels && (
                          <>
                            {groupedCartons.skids.size > 0 ? (
                              // Has skids - show Edit Skid Configuration
                              <button
                                onClick={handleOpenEditShipmentModal}
                                className="inline-flex items-center px-4 py-2 border border-purple-600 text-sm font-medium rounded-md text-purple-600 bg-white hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit Skid Configuration
                              </button>
                            ) : groupedCartons.noSkid.length > 0 ? (
                              // Has loose cartons (Carton Mode) - show Edit Carton Configuration
                              <button
                                onClick={handleOpenEditShipmentModal}
                                className="inline-flex items-center px-4 py-2 border border-blue-600 text-sm font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit Carton Configuration
                              </button>
                            ) : (
                              // No cartons yet - show Create More Cartons and Process Parcel
                              <>
                                <button
                                  onClick={() => setShowProcessModal(true)}
                                  disabled={!isPOValid()}
                                  title={getPOErrorMessage() || undefined}
                                  className="inline-flex items-center px-4 py-2 border border-blue-600 text-sm font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Create More Cartons
                                </button>

                                <button
                                  onClick={handleProcessParcelClick}
                                  disabled={integrationLoading || !isPOValid()}
                                  title={getPOErrorMessage() || undefined}
                                  className="inline-flex items-center px-4 py-2 border border-green-600 text-sm font-medium rounded-md text-green-600 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                  </svg>
                                  {integrationLoading ? 'Checking...' : 'Process Parcel'}
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex gap-3">
                        {hasLabels && (
                          <>
                            <button
                              onClick={handleReprintAllLabels}
                              className="inline-flex items-center px-4 py-2 border border-green-600 text-sm font-medium rounded-md text-green-600 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                              </svg>
                              Reprint Labels
                            </button>

                            <button
                              onClick={handleCancelLabels}
                              disabled={cancelingLabels}
                              className="inline-flex items-center px-4 py-2 border border-orange-600 text-sm font-medium rounded-md text-orange-600 bg-white hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              {cancelingLabels ? 'Canceling Labels...' : 'Cancel All Labels'}
                            </button>
                          </>
                        )}

                        {/* Print PDF Button - Always visible when cartons exist */}
                        <button
                          onClick={() => window.open(`/api/pace/shipments/${shipmentId}/pdf`, '_blank')}
                          className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Print PDF
                        </button>

                        {!hasLabels && (
                          <button
                            onClick={handleDeleteAllCartons}
                            className="inline-flex items-center px-4 py-2 border border-red-600 text-sm font-medium rounded-md text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete All Cartons
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {!isPOValid() && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <strong>⚠️ {getPOErrorMessage()}</strong>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Carton #
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Note
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contents
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qty/Carton
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Qty
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Weight
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cost
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tracking
                      </th>
                      <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {/* Render skid groups */}
                    {Array.from(groupedCartons.skids.values()).map((skidGroup) => (
                      <React.Fragment key={`skid-group-${skidGroup.skid}`}>
                        {/* Skid header row */}
                        <tr className="bg-blue-50 border-t-2 border-blue-200">
                          <td colSpan={9} className="px-4 py-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                  </svg>
                                  <span className="text-sm font-semibold text-blue-900">Skid #{skidGroup.skid}</span>
                                </div>
                                {skidGroup.description && (
                                  <span className="text-sm text-blue-700">{skidGroup.description}</span>
                                )}
                                {skidGroup.weight && (
                                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                    Weight: {skidGroup.weight} lbs
                                  </span>
                                )}
                                {skidGroup.count && (
                                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                    Count: {skidGroup.count}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-blue-600">
                                {skidGroup.cartons.length} carton{skidGroup.cartons.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {/* Cartons in this skid */}
                        {skidGroup.cartons.map((carton, index) => (
                          <tr key={carton.id || `skid-${skidGroup.skid}-carton-${index}`} className="hover:bg-gray-50 border-l-4 border-blue-200">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">#{carton.id}</span>
                                {carton.count && carton.count > 1 && (
                                  <span className="text-xs text-gray-500">{carton.count} cartons</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {carton.note ? (
                                <span className="text-sm text-gray-700">{carton.note}</span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                        <td className="px-4 py-3">
                          {carton.contents && carton.contents.length > 0 ? (
                            <div className="space-y-1.5">
                              {carton.contents.map((content, contentIndex) => {
                                const primaryDescription =
                                  content.jobComponentDescription ||
                                  content.jobProductDescription ||
                                  content.jobMaterialDescription ||
                                  content.jobDescription ||
                                  content.contentDescription

                                let contentType = ''
                                let badgeColor = 'bg-gray-100 text-gray-700'
                                if (content.jobComponent) {
                                  contentType = 'Component'
                                  badgeColor = 'bg-blue-100 text-blue-700'
                                } else if (content.jobProduct) {
                                  contentType = 'Product'
                                  badgeColor = 'bg-green-100 text-green-700'
                                } else if (content.jobMaterial) {
                                  contentType = 'Material'
                                  badgeColor = 'bg-yellow-100 text-yellow-700'
                                } else if (content.job) {
                                  contentType = 'Job'
                                  badgeColor = 'bg-purple-100 text-purple-700'
                                } else if (content.jobPart) {
                                  contentType = 'Part'
                                  badgeColor = 'bg-orange-100 text-orange-700'
                                }

                                return (
                                  <div key={content.id || contentIndex} className="flex items-start gap-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${badgeColor}`}>
                                      {contentType}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-gray-900 truncate" title={primaryDescription || 'N/A'}>
                                        {primaryDescription || 'N/A'}
                                      </p>
                                      <div className="flex gap-3 mt-0.5">
                                        {content.jobComponentItemNumber && (
                                          <p className="text-xs text-gray-600">
                                            <span className="font-medium">Item:</span> {content.jobComponentItemNumber}
                                          </p>
                                        )}
                                        {content.jobComponentPO && (
                                          <p className="text-xs text-gray-600">
                                            <span className="font-medium">PO:</span> {content.jobComponentPO}
                                          </p>
                                        )}
                                        {content.jobMaterialID && (
                                          <p className="text-xs text-gray-600">
                                            <span className="font-medium">Material ID:</span> {content.jobMaterialID}
                                          </p>
                                        )}
                                        {!content.jobComponentItemNumber && !content.jobComponentPO && !content.jobMaterialID && (content.jobPart || content.job || content.jobMaterial) && (
                                          <p className="text-xs text-gray-500 truncate">
                                            {content.jobPart ? `Part: ${content.jobPart}` : content.job ? `Job: ${content.job}` : content.jobMaterial ? `Material: ${content.jobMaterial}` : ''}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No contents</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          {carton.contents && carton.contents.length > 0 ? (
                            <div className="space-y-1.5">
                              {carton.contents.map((content, contentIndex) => (
                                <div key={content.id || contentIndex} className="text-sm text-gray-900 h-[2.25rem] flex items-center justify-end">
                                  {content.quantity || '-'}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          {carton.contents && carton.contents.length > 0 ? (
                            <div className="space-y-1.5">
                              {carton.contents.map((content, contentIndex) => {
                                const totalQty = content.quantity && carton.count
                                  ? content.quantity * carton.count
                                  : content.quantity || 0
                                return (
                                  <div key={content.id || contentIndex} className="text-sm font-semibold text-blue-600 h-[2.25rem] flex items-center justify-end">
                                    {totalQty > 0 ? totalQty.toLocaleString() : '-'}
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span className="text-sm text-gray-900">
                            {carton.weight ? `${carton.weight} lbs` : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span className="text-sm font-semibold text-green-600">
                            {carton.cost ? `$${typeof carton.cost === 'string' ? parseFloat(carton.cost).toFixed(2) : carton.cost.toFixed(2)}` : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {carton.trackingNumber ? (
                            <span className="text-xs font-mono text-gray-900 block truncate max-w-xs" title={carton.trackingNumber}>
                              {carton.trackingNumber}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            {carton.trackingNumber ? (
                              <>
                                <span className="text-gray-400 text-sm font-medium cursor-not-allowed" title="Cannot edit cartons with labels">
                                  Edit
                                </span>
                                <span className="text-gray-400 text-sm font-medium cursor-not-allowed" title="Cannot delete individual labeled cartons. Use 'Cancel All Labels' instead.">
                                  Delete
                                </span>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEditingCarton(carton)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                  title="Edit carton"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Delete carton #${carton.id}?`)) return
                                    setLoadingCartons(true)
                                    try {
                                      await fetch(`/api/pace/cartons/${carton.id}`, { method: 'DELETE' })
                                      await fetchCartons()
                                      await fetchShipment()
                                    } catch (err) {
                                      alert('Failed to delete carton')
                                    } finally {
                                      setLoadingCartons(false)
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                                  title="Delete carton"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                        ))}
                      </React.Fragment>
                    ))}

                    {/* Render cartons without skids */}
                    {groupedCartons.noSkid.map((carton, index) => (
                      <tr key={carton.id || `no-skid-${index}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">#{carton.id}</span>
                            {carton.count && carton.count > 1 && (
                              <span className="text-xs text-gray-500">{carton.count} cartons</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {carton.note ? (
                            <span className="text-sm text-gray-700">{carton.note}</span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {carton.contents && carton.contents.length > 0 ? (
                            <div className="space-y-1.5">
                              {carton.contents.map((content, contentIndex) => {
                                const primaryDescription =
                                  content.jobComponentDescription ||
                                  content.jobProductDescription ||
                                  content.jobMaterialDescription ||
                                  content.jobDescription ||
                                  content.contentDescription

                                let contentType = ''
                                let badgeColor = 'bg-gray-100 text-gray-700'
                                if (content.jobComponent) {
                                  contentType = 'Component'
                                  badgeColor = 'bg-blue-100 text-blue-700'
                                } else if (content.jobProduct) {
                                  contentType = 'Product'
                                  badgeColor = 'bg-green-100 text-green-700'
                                } else if (content.jobMaterial) {
                                  contentType = 'Material'
                                  badgeColor = 'bg-yellow-100 text-yellow-700'
                                } else if (content.job) {
                                  contentType = 'Job'
                                  badgeColor = 'bg-purple-100 text-purple-700'
                                } else if (content.jobPart) {
                                  contentType = 'Part'
                                  badgeColor = 'bg-orange-100 text-orange-700'
                                }

                                return (
                                  <div key={content.id || contentIndex} className="flex items-start gap-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${badgeColor}`}>
                                      {contentType}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-gray-900 truncate" title={primaryDescription || 'N/A'}>
                                        {primaryDescription || 'N/A'}
                                      </p>
                                      <div className="flex gap-3 mt-0.5">
                                        {content.jobComponentItemNumber && (
                                          <p className="text-xs text-gray-600">
                                            <span className="font-medium">Item:</span> {content.jobComponentItemNumber}
                                          </p>
                                        )}
                                        {content.jobComponentPO && (
                                          <p className="text-xs text-gray-600">
                                            <span className="font-medium">PO:</span> {content.jobComponentPO}
                                          </p>
                                        )}
                                        {content.jobMaterialID && (
                                          <p className="text-xs text-gray-600">
                                            <span className="font-medium">Material ID:</span> {content.jobMaterialID}
                                          </p>
                                        )}
                                        {!content.jobComponentItemNumber && !content.jobComponentPO && !content.jobMaterialID && (content.jobPart || content.job || content.jobMaterial) && (
                                          <p className="text-xs text-gray-500 truncate">
                                            {content.jobPart ? `Part: ${content.jobPart}` : content.job ? `Job: ${content.job}` : content.jobMaterial ? `Material: ${content.jobMaterial}` : ''}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No contents</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          {carton.contents && carton.contents.length > 0 ? (
                            <div className="space-y-1.5">
                              {carton.contents.map((content, contentIndex) => (
                                <div key={content.id || contentIndex} className="text-sm text-gray-900 h-[2.25rem] flex items-center justify-end">
                                  {content.quantity || '-'}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          {carton.contents && carton.contents.length > 0 ? (
                            <div className="space-y-1.5">
                              {carton.contents.map((content, contentIndex) => {
                                const totalQty = content.quantity && carton.count
                                  ? content.quantity * carton.count
                                  : content.quantity || 0
                                return (
                                  <div key={content.id || contentIndex} className="text-sm font-semibold text-blue-600 h-[2.25rem] flex items-center justify-end">
                                    {totalQty > 0 ? totalQty.toLocaleString() : '-'}
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span className="text-sm text-gray-900">
                            {carton.weight ? `${carton.weight} lbs` : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span className="text-sm font-semibold text-green-600">
                            {carton.cost ? `$${typeof carton.cost === 'string' ? parseFloat(carton.cost).toFixed(2) : carton.cost.toFixed(2)}` : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {carton.trackingNumber ? (
                            <span className="text-xs font-mono text-gray-900 block truncate max-w-xs" title={carton.trackingNumber}>
                              {carton.trackingNumber}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            {carton.trackingNumber ? (
                              <>
                                <span className="text-gray-400 text-sm font-medium cursor-not-allowed" title="Cannot edit cartons with labels">
                                  Edit
                                </span>
                                <span className="text-gray-400 text-sm font-medium cursor-not-allowed" title="Cannot delete individual labeled cartons. Use 'Cancel All Labels' instead.">
                                  Delete
                                </span>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEditingCarton(carton)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                  title="Edit carton"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Delete carton #${carton.id}?`)) return
                                    setLoadingCartons(true)
                                    try {
                                      await fetch(`/api/pace/cartons/${carton.id}`, { method: 'DELETE' })
                                      await fetchCartons()
                                      await fetchShipment()
                                    } catch (err) {
                                      alert('Failed to delete carton')
                                    } finally {
                                      setLoadingCartons(false)
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                                  title="Delete carton"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {cartons.length > 0 && (
                    <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                      <tr>
                        <td colSpan={2} className="px-4 py-4 text-right">
                          <span className="text-sm font-semibold text-gray-900">Totals:</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm text-gray-500">-</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-lg font-bold text-blue-600">
                            {(() => {
                              const grandTotal = cartons.reduce((sum, carton) => {
                                const cartonTotal = (carton.contents || []).reduce((contentSum, content) => {
                                  const qty = content.quantity || 0
                                  const count = carton.count || 1
                                  const skidCount = carton.skidCount || 1
                                  return contentSum + (qty * count * skidCount)
                                }, 0)
                                return sum + cartonTotal
                              }, 0)
                              return grandTotal.toLocaleString()
                            })()}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm text-gray-500">-</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-lg font-bold text-green-600">
                            {(() => {
                              const totalCost = cartons.reduce((sum, carton) => {
                                const cost = carton.cost ? (typeof carton.cost === 'string' ? parseFloat(carton.cost) : carton.cost) : 0
                                return sum + cost
                              }, 0)
                              return totalCost > 0 ? `$${totalCost.toFixed(2)}` : '-'
                            })()}
                          </span>
                        </td>
                        <td colSpan={2} className="px-4 py-4">
                          <div className="flex items-center gap-4">
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">
                                {(() => {
                                  const totalCartonCount = cartons.reduce((sum, carton) => {
                                    const skidCount = carton.skidCount || 1
                                    const cartonCount = carton.count || 1
                                    return sum + (skidCount * cartonCount)
                                  }, 0)
                                  return totalCartonCount
                                })()}
                              </span>
                              <span className="text-gray-500"> total cartons</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                </div>
              </div>
            )}

            {/* Return Labels Section */}
            {returnLabels.length > 0 && (
              <div className="mt-8 bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    Return Labels
                  </h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {returnLabels.map((label, index) => (
                      <div key={label.id || index} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase">Carrier & Service</label>
                            <p className="text-sm font-semibold text-gray-900 mt-1">
                              {label.carrier} - {label.service}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase">Tracking Number</label>
                            <p className="text-sm font-mono text-gray-900 mt-1">{label.trackingNumber}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase">Cost</label>
                            <p className="text-sm font-semibold text-green-600 mt-1">
                              {label.cost ? `$${typeof label.cost === 'string' ? parseFloat(label.cost).toFixed(2) : label.cost.toFixed(2)}` : '-'}
                            </p>
                          </div>
                        </div>
                        {label.rmaNumber && (
                          <div className="mt-3">
                            <label className="text-xs font-medium text-gray-500 uppercase">RMA Number</label>
                            <p className="text-sm text-gray-900 mt-1">{label.rmaNumber}</p>
                          </div>
                        )}
                        <div className="mt-4 flex items-center gap-3">
                          {label.labelUrl && (
                            <a
                              href={label.labelUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Download Return Label
                            </a>
                          )}
                          <span className="text-xs text-gray-500">
                            Created {new Date(label.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'special' ? (
        /* Special Information Tab */
        <div className="max-w-4xl mx-auto">
          {shipment.u_specialinformation ? (
            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="border-b border-gray-200 px-4 py-2 bg-amber-50">
                <h2 className="text-sm font-semibold text-amber-900 uppercase">Special Information</h2>
              </div>
              <div className="p-4 bg-amber-50/30">
                <div className="bg-white rounded border-l-2 border-amber-500 p-4">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {shipment.u_specialinformation}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded border border-gray-200 p-12 text-center">
              <p className="text-gray-500 text-sm">No special information recorded for this shipment.</p>
            </div>
          )}
        </div>
      ) : (
        /* Other Info Tab */
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-2 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700 uppercase">Additional Information</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {/* Tracking Information */}
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2 uppercase">Tracking</div>
                  <div className="space-y-2">
                    {shipment.trackingNumber && (
                      <div>
                        <div className="text-xs text-gray-500">Tracking Number</div>
                        <div className="font-mono text-xs font-semibold text-gray-900">{shipment.trackingNumber}</div>
                      </div>
                    )}
                    {shipment.trackingLink && (
                      <div>
                        <div className="text-xs text-gray-500">Tracking Link</div>
                        <a
                          href={shipment.trackingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 underline break-all"
                        >
                          {shipment.trackingLink}
                        </a>
                      </div>
                    )}
                    {!shipment.trackingNumber && !shipment.trackingLink && (
                      <p className="text-gray-400 text-xs">No tracking information available</p>
                    )}
                  </div>
                </div>

                {/* Cost Information */}
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2 uppercase">Costs</div>
                  <div className="space-y-2">
                    {shipment.cost !== undefined && shipment.cost !== null && (
                      <div>
                        <div className="text-xs text-gray-500">Shipping Cost</div>
                        <div className="text-lg font-bold text-gray-900">
                          ${shipment.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}
                    {shipment.charges !== undefined && shipment.charges !== null && (
                      <div>
                        <div className="text-xs text-gray-500">Payment Terms</div>
                        <div className="font-semibold text-gray-900">
                          {typeof shipment.charges === 'number'
                            ? `$${shipment.charges.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : shipment.charges
                          }
                        </div>
                      </div>
                    )}
                    {(shipment.cost !== undefined && shipment.cost !== null) &&
                     typeof shipment.charges === 'number' && (
                      <div className="pt-2 border-t border-gray-200">
                        <div className="text-xs text-gray-500">Total Cost</div>
                        <div className="text-xl font-bold text-gray-900">
                          ${((shipment.cost || 0) + (shipment.charges || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}
                    {(shipment.cost === undefined || shipment.cost === null) &&
                     (shipment.charges === undefined || shipment.charges === null) && (
                      <p className="text-gray-400 text-xs">No cost information available</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Process Shipment Modal */}
      {showProcessModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-gray-900">Process Shipment #{shipment.id}</h3>
              <button
                onClick={() => setShowProcessModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <ProcessShipmentForm
              shipmentId={shipment.id!}
              shipment={shipment}
              onSuccess={() => {
                setShowProcessModal(false)
                fetchCartons() // Refresh cartons
              }}
              onCancel={() => setShowProcessModal(false)}
            />
          </div>
        </div>
      )}

      {/* Process Skids Modal */}
      {showProcessSkidsModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-[95vw] w-full h-[95vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                {groupedCartons.skids.size > 0 || cartons.length > 0 ? 'Edit' : 'Process'} Shipment #{shipment.id}
              </h3>
              <button
                onClick={() => setShowProcessSkidsModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              {modalLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <svg className="animate-spin h-8 w-8 text-purple-600 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-gray-600">Loading fresh data from PACE...</p>
                  </div>
                </div>
              ) : (
                <ProcessSkidsForm
                  shipmentId={shipment.id!}
                  shipment={modalShipment || shipment}
                  shipmentTypeDescription={shipmentTypeDescription}
                  existingCartons={(modalCartons || cartons).length > 0 ? (modalCartons || cartons) : undefined}
                  initialMode={groupedCartons.skids.size > 0 ? 'skid' : (groupedCartons.noSkid.length > 0 ? 'carton' : 'skid')}
                  onSuccess={() => {
                    setShowProcessSkidsModal(false)
                    fetchCartons() // Refresh cartons on main page
                  }}
                  onCancel={() => setShowProcessSkidsModal(false)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Process Shipment for Parcel Modal - Show appropriate modal based on active integration */}
      {activeIntegration === 'easypost' && (
        <ProcessShipmentParcelModal
          isOpen={showProcessParcelModal}
          onClose={() => {
            setShowProcessParcelModal(false)
            setActiveIntegration(null) // Reset for next time
          }}
          onSuccess={() => {
            fetchCartons()
            fetchLabels()
            setActiveIntegration(null) // Reset for next time
          }}
          shipment={shipment}
        />
      )}

      {activeIntegration === 'shipstation' && (
        <ProcessShipmentShipStationModal
          isOpen={showProcessParcelModal}
          onClose={() => {
            setShowProcessParcelModal(false)
            setActiveIntegration(null) // Reset for next time
          }}
          onSuccess={() => {
            fetchCartons()
            fetchLabels()
            setActiveIntegration(null) // Reset for next time
          }}
          shipment={shipment}
          companyName={companyName}
        />
      )}

      {/* Edit Carton Modal */}
      {editingCarton && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Edit Carton #{editingCarton.id}</h2>
              <button
                onClick={() => setEditingCarton(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <EditCartonForm
              carton={editingCarton}
              shipment={shipment}
              onSuccess={() => {
                setEditingCarton(null)
                fetchCartons() // Refresh cartons
              }}
              onCancel={() => setEditingCarton(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Process Shipment Form Component
function ProcessShipmentForm({
  shipmentId,
  shipment,
  onSuccess,
  onCancel,
}: {
  shipmentId: number
  shipment: JobShipment
  onSuccess: () => void
  onCancel: () => void
}) {
  const [cartons, setCartons] = useState<Array<{
    count: number
    contents: Array<{
      itemId?: string  // Will be in format "type:id" (e.g., "component:123", "part:1:02", "job:1")
      quantity: number
    }>
  }>>([{ count: 1, contents: [{ itemId: '', quantity: 0 }] }])
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jobItems, setJobItems] = useState<{
    components: Array<{ id: number; description: string; itemNumber?: string; qtyOrdered?: number }>
    products: Array<{ id: number; description: string; productID?: string }>
    parts: Array<{ id: string; description: string; partName?: string }>
  } | null>(null)
  const [loadingItems, setLoadingItems] = useState(false)

  // Load job items on mount
  useEffect(() => {
    if (shipment.job) {
      loadJobItems()
    }
  }, [shipment.job])

  const loadJobItems = async () => {
    if (!shipment.job) return

    setLoadingItems(true)
    try {
      const response = await fetch(`/api/pace/jobs/${encodeURIComponent(shipment.job)}/items`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          console.log('Job items loaded:', data.data)
          setJobItems(data.data)
        }
      } else {
        console.error('Failed to fetch job items:', response.status, response.statusText)
      }
    } catch (err) {
      console.error('Failed to load job items:', err)
    } finally {
      setLoadingItems(false)
    }
  }

  const addCarton = () => {
    setCartons([...cartons, { count: 1, contents: [{ itemId: '', quantity: 0 }] }])
  }

  const removeCarton = (index: number) => {
    setCartons(cartons.filter((_, i) => i !== index))
  }

  const addContent = (cartonIndex: number) => {
    const newCartons = [...cartons]
    newCartons[cartonIndex].contents.push({ itemId: '', quantity: 0 })
    setCartons(newCartons)
  }

  const removeContent = (cartonIndex: number, contentIndex: number) => {
    const newCartons = [...cartons]
    newCartons[cartonIndex].contents = newCartons[cartonIndex].contents.filter((_, i) => i !== contentIndex)
    setCartons(newCartons)
  }

  const updateCarton = (index: number, field: 'count', value: number) => {
    const newCartons = [...cartons]
    newCartons[index][field] = value
    setCartons(newCartons)
  }

  const updateContent = (
    cartonIndex: number,
    contentIndex: number,
    field: 'itemId' | 'quantity',
    value: any
  ) => {
    const newCartons = [...cartons]
    const content = newCartons[cartonIndex].contents[contentIndex]

    if (field === 'itemId') {
      content.itemId = value
    } else if (field === 'quantity') {
      content.quantity = value
    }

    setCartons(newCartons)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProcessing(true)
    setError(null)

    try {
      // Map the form data to PACE API format
      const mappedCartons = cartons.map((carton) => ({
        count: carton.count,
        contents: carton.contents.map((content) => {
          const baseContent: any = {
            quantity: content.quantity,
          }

          // Parse itemId format: "type:value"
          // e.g., "job:1", "component:123", "product:456", "part:1:02"
          if (content.itemId) {
            const parts = content.itemId.split(':')
            const type = parts[0]

            if (type === 'job') {
              baseContent.job = parts[1]
            } else if (type === 'component') {
              baseContent.jobComponent = parseInt(parts[1])
            } else if (type === 'product') {
              baseContent.jobProduct = parseInt(parts[1])
            } else if (type === 'part') {
              // Format: "part:jobId:partNum" (e.g., "part:1:02")
              baseContent.jobPartJob = parts[1]  // The job ID
              baseContent.jobPart = parts[2]     // Just the part number
            }
          }

          return baseContent
        }),
      }))

      const response = await fetch(`/api/pace/shipments/${shipmentId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartons: mappedCartons }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to process shipment')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {cartons.map((carton, cartonIndex) => (
          <div key={cartonIndex} className="border border-gray-200 rounded-lg bg-white">
            {/* Carton Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <h4 className="text-sm font-semibold text-gray-900">
                  Carton {cartonIndex + 1}
                </h4>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">Qty:</label>
                  <input
                    type="number"
                    min="1"
                    value={carton.count}
                    onChange={(e) => updateCarton(cartonIndex, 'count', parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addContent(cartonIndex)}
                  className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                >
                  + Add Item
                </button>
                {cartons.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCarton(cartonIndex)}
                    className="text-red-600 hover:text-red-800 text-xs font-medium ml-2"
                  >
                    Remove Carton
                  </button>
                )}
              </div>
            </div>

            {/* Contents Table */}
            <div className="divide-y divide-gray-100">
              {carton.contents.map((content, contentIndex) => (
                <div key={contentIndex} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50">
                  {/* Item Selector */}
                  <div className="flex-1">
                    {loadingItems ? (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        Loading items...
                      </div>
                    ) : (
                      <select
                        value={content.itemId || ''}
                        onChange={(e) => updateContent(cartonIndex, contentIndex, 'itemId', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select item to ship...</option>

                        {/* Job Option */}
                        {shipment.job && (
                          <option value={`job:${shipment.job}`}>
                            🔹 Job #{shipment.job}
                          </option>
                        )}

                        {/* Components */}
                        {jobItems?.components && jobItems.components.length > 0 && (
                          <optgroup label="━━━ Components ━━━">
                            {jobItems.components.map((comp) => (
                              <option key={`component:${comp.id}`} value={`component:${comp.id}`}>
                                {comp.description} {comp.itemNumber ? `(${comp.itemNumber})` : ''} {comp.qtyOrdered ? `- Qty: ${comp.qtyOrdered}` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}

                        {/* Products */}
                        {jobItems?.products && jobItems.products.length > 0 && (
                          <optgroup label="━━━ Products ━━━">
                            {jobItems.products.map((prod) => (
                              <option key={`product:${prod.id}`} value={`product:${prod.id}`}>
                                {prod.description} {prod.productID ? `(${prod.productID})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}

                        {/* Parts */}
                        {jobItems?.parts && jobItems.parts.length > 0 && (
                          <optgroup label="━━━ Parts ━━━">
                            {jobItems.parts.map((part) => {
                              // part.id is in format "jobId:partNum" (e.g., "1:02")
                              const [jobId, partNum] = part.id.split(':')
                              return (
                                <option key={`part:${part.id}`} value={`part:${jobId}:${partNum}`}>
                                  Part {partNum} - {part.description} {part.partName ? `(${part.partName})` : ''}
                                </option>
                              )
                            })}
                          </optgroup>
                        )}
                      </select>
                    )}
                  </div>

                  {/* Quantity Input */}
                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      required
                      value={content.quantity}
                      onChange={(e) =>
                        updateContent(cartonIndex, contentIndex, 'quantity', parseInt(e.target.value) || 0)
                      }
                      placeholder="Qty"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Delete Button */}
                  {carton.contents.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContent(cartonIndex, contentIndex)}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Remove item"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addCarton}
          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          + Add Another Carton
        </button>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={processing}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? 'Processing...' : 'Create Cartons'}
        </button>
      </div>
    </form>
  )
}

// Process Skids Form Component
function ProcessSkidsForm({
  shipmentId,
  shipment,
  shipmentTypeDescription,
  existingCartons,
  initialMode = 'skid',
  onSuccess,
  onCancel,
}: {
  shipmentId: number
  shipment: JobShipment
  shipmentTypeDescription: string | null
  existingCartons?: Carton[]
  initialMode?: 'skid' | 'carton'
  onSuccess: () => void
  onCancel: () => void
}) {
  // Mode: 'skid' for palletized shipments, 'carton' for loose cartons
  const [mode, setMode] = useState<'skid' | 'carton'>(initialMode)

  const [skids, setSkids] = useState<Array<{
    count: number
    description: string
    weight: number
    cartons: Array<{
      count: number
      note?: string
      contents: Array<{
        itemId?: string
        quantity: number
      }>
    }>
  }>>([{
    count: 1,
    description: '',
    weight: 0,
    cartons: [{ count: 1, note: '', contents: [{ itemId: '', quantity: 0 }] }]
  }])

  // For carton-only mode
  const [cartons, setCartons] = useState<Array<{
    count: number
    note?: string
    contents: Array<{
      itemId?: string
      quantity: number
    }>
  }>>([{ count: 1, note: '', contents: [{ itemId: '', quantity: 0 }] }])

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(1)

  // Optional shipment fields (Step 2)
  const [shipmentDetails, setShipmentDetails] = useState({
    notes: '',
    trackingNumber: '',
    trackingNotes: '',
    cost: '',
  })

  const [jobItems, setJobItems] = useState<{
    components: Array<{ id: number; description: string; itemNumber?: string; qtyOrdered?: number; po?: string }>
    products: Array<{ id: number; description: string; productID?: string }>
    parts: Array<{ id: string; description: string; partName?: string }>
    materials: Array<{ id: number; description: string; materialID?: string; jobPart?: string; qtyRequired?: number; plannedQuantity?: number }>
  } | null>(null)
  const [loadingItems, setLoadingItems] = useState(false)
  const [showOtherItemTypes, setShowOtherItemTypes] = useState(false)

  // Check if this is a storefront shipment
  const isStorefrontShipment = () => {
    return shipmentTypeDescription?.split('|').some(label => label.trim().toLowerCase() === 'storefront')
  }

  // Helper to convert carton content to form format
  const convertContentToFormFormat = (content: any) => ({
    itemId: content.jobMaterial ? `material:${content.jobMaterial}`
           : content.jobComponent ? `component:${content.jobComponent}`
           : content.jobProduct ? `product:${content.jobProduct}`
           : content.jobPart ? `part:${content.job}:${content.jobPart}`
           : content.job ? `job:${content.job}`
           : '',
    quantity: content.quantity || 0
  })

  // Pre-populate skids/cartons from existing cartons when editing
  useEffect(() => {
    if (existingCartons && existingCartons.length > 0) {
      // Separate cartons with skids from loose cartons
      const skidMap = new Map<number, typeof skids[0]>()
      const looseCartons: typeof cartons = []

      existingCartons.forEach(carton => {
        if (carton.skid) {
          // Carton belongs to a skid
          if (!skidMap.has(carton.skid)) {
            skidMap.set(carton.skid, {
              count: carton.skidCount || 1,
              description: carton.skidDescription || '',
              weight: carton.skidWeight || 0,
              cartons: []
            })
          }

          const skidData = skidMap.get(carton.skid)!
          skidData.cartons.push({
            count: carton.count || 1,
            note: carton.note || '',
            contents: (carton.contents || []).map(convertContentToFormFormat)
          })
        } else {
          // Loose carton (no skid)
          looseCartons.push({
            count: carton.count || 1,
            note: carton.note || '',
            contents: (carton.contents || []).map(convertContentToFormFormat)
          })
        }
      })

      // Populate the appropriate state based on what we found
      if (skidMap.size > 0) {
        setSkids(Array.from(skidMap.values()))
      }

      if (looseCartons.length > 0) {
        setCartons(looseCartons)
      }
    }
  }, [existingCartons])

  // Pre-populate shipment details from existing shipment when editing
  useEffect(() => {
    if (shipment) {
      setShipmentDetails({
        notes: shipment.notes || '',
        trackingNumber: shipment.trackingNumber || '',
        trackingNotes: shipment.trackingNotes || '',
        cost: shipment.cost ? String(shipment.cost) : '',
      })
    }
  }, [shipment])

  // Load job items on mount
  useEffect(() => {
    if (shipment.job) {
      loadJobItems()
    }
  }, [shipment.job])

  const loadJobItems = async () => {
    if (!shipment.job) return

    setLoadingItems(true)
    try {
      const response = await fetch(`/api/pace/jobs/${encodeURIComponent(shipment.job)}/items`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          console.log('Job items loaded:', data.data)
          setJobItems(data.data)
        }
      } else {
        console.error('Failed to fetch job items:', response.status, response.statusText)
      }
    } catch (err) {
      console.error('Failed to load job items:', err)
    } finally {
      setLoadingItems(false)
    }
  }

  const addSkid = () => {
    setSkids([...skids, {
      count: 1,
      description: '',
      weight: 0,
      cartons: [{ count: 1, note: '', contents: [{ itemId: '', quantity: 0 }] }]
    }])
  }

  const removeSkid = (index: number) => {
    setSkids(skids.filter((_, i) => i !== index))
  }

  const updateSkid = (index: number, field: 'count' | 'description' | 'weight', value: any) => {
    const newSkids = [...skids]
    if (field === 'count') {
      newSkids[index].count = value
    } else if (field === 'description') {
      newSkids[index].description = value
    } else if (field === 'weight') {
      newSkids[index].weight = value
    }
    setSkids(newSkids)
  }

  const addCartonToSkid = (skidIndex: number) => {
    const newSkids = [...skids]
    newSkids[skidIndex].cartons.push({ count: 1, note: '', contents: [{ itemId: '', quantity: 0 }] })
    setSkids(newSkids)
  }

  const removeCartonFromSkid = (skidIndex: number, cartonIndex: number) => {
    const newSkids = [...skids]
    newSkids[skidIndex].cartons = newSkids[skidIndex].cartons.filter((_, i) => i !== cartonIndex)
    setSkids(newSkids)
  }

  const duplicateCarton = (skidIndex: number, cartonIndex: number) => {
    const newSkids = [...skids]
    const originalCarton = newSkids[skidIndex].cartons[cartonIndex]
    // Create a copy with count and quantity reset to 1
    const duplicatedCarton = {
      count: 1,  // Reset count to 1
      note: originalCarton.note || '',
      contents: originalCarton.contents.map(content => ({
        itemId: content.itemId,
        quantity: 1  // Reset quantity to 1
      }))
    }
    // Insert the duplicated carton right after the original
    newSkids[skidIndex].cartons.splice(cartonIndex + 1, 0, duplicatedCarton)
    setSkids(newSkids)
  }

  const updateCarton = (skidIndex: number, cartonIndex: number, field: 'count' | 'note', value: number | string) => {
    const newSkids = [...skids]
    if (field === 'count') {
      newSkids[skidIndex].cartons[cartonIndex].count = value as number
    } else if (field === 'note') {
      newSkids[skidIndex].cartons[cartonIndex].note = value as string
    }
    setSkids(newSkids)
  }

  const addContentToCarton = (skidIndex: number, cartonIndex: number) => {
    const newSkids = [...skids]
    newSkids[skidIndex].cartons[cartonIndex].contents.push({ itemId: '', quantity: 0 })
    setSkids(newSkids)
  }

  const removeContentFromCarton = (skidIndex: number, cartonIndex: number, contentIndex: number) => {
    const newSkids = [...skids]
    newSkids[skidIndex].cartons[cartonIndex].contents = newSkids[skidIndex].cartons[cartonIndex].contents.filter((_, i) => i !== contentIndex)
    setSkids(newSkids)
  }

  const updateContent = (
    skidIndex: number,
    cartonIndex: number,
    contentIndex: number,
    field: 'itemId' | 'quantity',
    value: any
  ) => {
    const newSkids = [...skids]
    const content = newSkids[skidIndex].cartons[cartonIndex].contents[contentIndex]

    if (field === 'itemId') {
      content.itemId = value
    } else if (field === 'quantity') {
      content.quantity = value
    }

    setSkids(newSkids)
  }

  // ============ Carton-Only Mode Helper Functions ============
  const addCarton = () => {
    setCartons([...cartons, { count: 1, note: '', contents: [{ itemId: '', quantity: 0 }] }])
  }

  const removeCarton = (index: number) => {
    setCartons(cartons.filter((_, i) => i !== index))
  }

  const updateCartonDirect = (index: number, field: 'count' | 'note', value: number | string) => {
    const newCartons = [...cartons]
    if (field === 'count') {
      newCartons[index].count = value as number
    } else if (field === 'note') {
      newCartons[index].note = value as string
    }
    setCartons(newCartons)
  }

  const addContentToCartonDirect = (cartonIndex: number) => {
    const newCartons = [...cartons]
    newCartons[cartonIndex].contents.push({ itemId: '', quantity: 0 })
    setCartons(newCartons)
  }

  const removeContentFromCartonDirect = (cartonIndex: number, contentIndex: number) => {
    const newCartons = [...cartons]
    newCartons[cartonIndex].contents = newCartons[cartonIndex].contents.filter((_, i) => i !== contentIndex)
    setCartons(newCartons)
  }

  const updateContentDirect = (
    cartonIndex: number,
    contentIndex: number,
    field: 'itemId' | 'quantity',
    value: any
  ) => {
    const newCartons = [...cartons]
    const content = newCartons[cartonIndex].contents[contentIndex]

    if (field === 'itemId') {
      content.itemId = value
    } else if (field === 'quantity') {
      content.quantity = value
    }

    setCartons(newCartons)
  }

  const duplicateCartonDirect = (cartonIndex: number) => {
    const newCartons = [...cartons]
    const originalCarton = newCartons[cartonIndex]
    const duplicatedCarton = {
      count: 1,  // Reset count to 1
      note: originalCarton.note || '',
      contents: originalCarton.contents.map(content => ({
        itemId: content.itemId,
        quantity: 1  // Reset quantity to 1
      }))
    }
    newCartons.splice(cartonIndex + 1, 0, duplicatedCarton)
    setCartons(newCartons)
  }

  // Build item groups with formatted labels (similar to ShipStation modal)
  const itemGroups: {
    job: Array<{ value: string; label: string; orderedQty?: number }>
    components: Array<{ value: string; label: string; orderedQty?: number }>
    products: Array<{ value: string; label: string }>
    parts: Array<{ value: string; label: string }>
    materials: Array<{ value: string; label: string; plannedQty?: number }>
  } = {
    job: [],
    components: [],
    products: [],
    parts: [],
    materials: [],
  }

  if (jobItems) {
    // Add job itself as an option
    if (shipment?.job) {
      itemGroups.job.push({
        value: `job:${shipment.job}`,
        label: `Job ${shipment.job}`,
      })
    }
    // Add components with detailed labels
    jobItems.components.forEach((comp) => {
      // Build label: ItemNumber - Description | PO: XXX | Qty: YYY
      let label = comp.itemNumber || comp.description
      if (comp.itemNumber && comp.description) {
        label += ` - ${comp.description}`
      }
      if (comp.po) {
        label += ` | PO: ${comp.po}`
      }
      if (comp.qtyOrdered) {
        label += ` | Qty: ${comp.qtyOrdered}`
      }

      itemGroups.components.push({
        value: `component:${comp.id}`,
        label,
        orderedQty: comp.qtyOrdered,
      })
    })
    // Add products
    jobItems.products.forEach((prod) => {
      itemGroups.products.push({
        value: `product:${prod.id}`,
        label: `${prod.productID || prod.description}`,
      })
    })
    // Add parts
    jobItems.parts.forEach((part) => {
      itemGroups.parts.push({
        value: part.id, // Already in format "part:jobId:partNum"
        label: `${part.partName || part.description}`,
      })
    })
    // Add materials
    jobItems.materials?.forEach((material) => {
      const qtyDisplay = material.plannedQuantity
        ? `Planned: ${material.plannedQuantity}${material.qtyRequired ? ` / Required: ${material.qtyRequired}` : ''}`
        : material.qtyRequired
        ? `Required: ${material.qtyRequired}`
        : ''

      itemGroups.materials.push({
        value: `material:${material.id}`,
        label: `${material.materialID || material.description}${material.jobPart ? ` (Part ${material.jobPart})` : ''}${qtyDisplay ? ` - ${qtyDisplay}` : ''}`,
        plannedQty: material.plannedQuantity,
      })
    })
  }

  // Helper function to get item name
  const getItemName = (itemId: string) => {
    if (itemId.startsWith('job:')) {
      return `Job #${itemId.split(':')[1]}`
    } else if (itemId.startsWith('component:')) {
      const compId = parseInt(itemId.split(':')[1])
      const comp = jobItems?.components.find((c) => c.id === compId)
      return comp ? `${comp.description}${comp.itemNumber ? ` (${comp.itemNumber})` : ''}` : itemId
    } else if (itemId.startsWith('product:')) {
      const prodId = parseInt(itemId.split(':')[1])
      const prod = jobItems?.products.find((p) => p.id === prodId)
      return prod ? `${prod.description}${prod.productID ? ` (${prod.productID})` : ''}` : itemId
    } else if (itemId.startsWith('part:')) {
      const part = jobItems?.parts.find((p) => p.id === itemId)
      return part ? `${part.description}${part.partName ? ` (${part.partName})` : ''}` : itemId
    } else if (itemId.startsWith('material:')) {
      const materialId = parseInt(itemId.split(':')[1])
      const material = jobItems?.materials?.find((m) => m.id === materialId)
      return material ? `${material.materialID || material.description}${material.jobPart ? ` (Part ${material.jobPart})` : ''}` : itemId
    }
    return itemId
  }

  // Calculate totals for preview
  const totals = useMemo(() => {
    let totalSkidCount = 0
    let totalCartonCount = 0
    let totalWeight = 0
    const itemQuantities: Record<string, { name: string; quantity: number }> = {}

    if (mode === 'skid') {
      // Skid mode calculations
      skids.forEach((skid) => {
        totalSkidCount += skid.count
        totalWeight += skid.weight * skid.count

        skid.cartons.forEach((carton) => {
          totalCartonCount += carton.count * skid.count

          carton.contents.forEach((content) => {
            if (content.itemId && content.quantity > 0) {
              const totalQty = content.quantity * carton.count * skid.count
              const itemName = getItemName(content.itemId)

              if (itemQuantities[content.itemId]) {
                itemQuantities[content.itemId].quantity += totalQty
              } else {
                itemQuantities[content.itemId] = { name: itemName, quantity: totalQty }
              }
            }
          })
        })
      })
    } else {
      // Carton-only mode calculations
      cartons.forEach((carton) => {
        totalCartonCount += carton.count

        carton.contents.forEach((content) => {
          if (content.itemId && content.quantity > 0) {
            const totalQty = content.quantity * carton.count
            const itemName = getItemName(content.itemId)

            if (itemQuantities[content.itemId]) {
              itemQuantities[content.itemId].quantity += totalQty
            } else {
              itemQuantities[content.itemId] = { name: itemName, quantity: totalQty }
            }
          }
        })
      })
    }

    return {
      totalSkidCount,
      totalCartonCount,
      totalWeight,
      itemQuantities: Object.entries(itemQuantities).map(([id, data]) => ({
        id,
        name: data.name,
        quantity: data.quantity,
      })),
    }
  }, [mode, skids, cartons, jobItems])

  // Helper function to parse itemId and return content payload
  const parseContentItemId = (content: { itemId?: string; quantity: number }) => {
    const baseContent: any = {
      quantity: content.quantity,
    }

    if (content.itemId) {
      const parts = content.itemId.split(':')
      const type = parts[0]

      if (type === 'job') {
        baseContent.job = parts[1]
      } else if (type === 'component') {
        baseContent.jobComponent = parseInt(parts[1])
      } else if (type === 'product') {
        baseContent.jobProduct = parseInt(parts[1])
      } else if (type === 'part') {
        baseContent.jobPartJob = parts[1]
        baseContent.jobPart = parts[2]
      } else if (type === 'material') {
        baseContent.jobMaterial = parseInt(parts[1])
      }
    }

    return baseContent
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProcessing(true)
    setError(null)

    try {
      const requestBody: any = {
        mode,
        shipmentDetails: {
          notes: shipmentDetails.notes || undefined,
          trackingNumber: shipmentDetails.trackingNumber || undefined,
          trackingNotes: shipmentDetails.trackingNotes || undefined,
          cost: shipmentDetails.cost ? parseFloat(shipmentDetails.cost) : undefined,
        },
        deleteExisting: existingCartons && existingCartons.length > 0,
      }

      if (mode === 'skid') {
        // Map skids with nested cartons
        requestBody.skids = skids.map((skid) => ({
          count: skid.count,
          description: skid.description,
          weight: skid.weight,
          cartons: skid.cartons.map((carton) => ({
            count: carton.count,
            note: carton.note || undefined,
            contents: carton.contents.map(parseContentItemId),
          })),
        }))
      } else {
        // Map cartons directly (carton-only mode)
        requestBody.cartons = cartons.map((carton) => ({
          count: carton.count,
          note: carton.note || undefined,
          contents: carton.contents.map(parseContentItemId),
        }))
      }

      const response = await fetch(`/api/pace/shipments/${shipmentId}/process-skids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to process ${mode === 'skid' ? 'skids' : 'cartons'}`)
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setProcessing(false)
    }
  }

  // Handle mode switching with data conversion
  const handleModeSwitch = (newMode: 'skid' | 'carton') => {
    if (newMode === mode) return

    // Check if there's data to convert
    const hasSkidData = skids.some(s => s.cartons.some(c => c.contents.some(ct => ct.itemId)))
    const hasCartonData = cartons.some(c => c.contents.some(ct => ct.itemId))

    if (newMode === 'carton' && hasSkidData) {
      // Switching from Skid Mode to Carton Mode - extract cartons from skids
      const extractedCartons = skids.flatMap(skid => skid.cartons)
      if (extractedCartons.length > 0) {
        const confirmSwitch = window.confirm(
          'Switch to Carton Mode?\n\n' +
          'Your cartons will be extracted from skids. Skid information (description, weight) will be lost.\n\n' +
          'Click OK to continue or Cancel to stay in Skid Mode.'
        )
        if (confirmSwitch) {
          setCartons(extractedCartons)
          setMode('carton')
        }
      } else {
        setMode('carton')
      }
    } else if (newMode === 'skid' && hasCartonData) {
      // Switching from Carton Mode to Skid Mode - wrap cartons in a new skid
      const confirmSwitch = window.confirm(
        'Switch to Skid Mode?\n\n' +
        'Your cartons will be placed into a new skid.\n\n' +
        'Click OK to continue or Cancel to stay in Carton Mode.'
      )
      if (confirmSwitch) {
        setSkids([{
          count: 1,
          description: '',
          weight: 0,
          cartons: cartons
        }])
        setMode('skid')
      }
    } else {
      // No data to convert, just switch modes
      setMode(newMode)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-6 p-6 h-full overflow-hidden">
      {/* Left side - Form */}
      <div className="flex-1 overflow-y-auto">
        {/* Mode Toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-center">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => handleModeSwitch('skid')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  mode === 'skid'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>🗃️</span>
                  <span>Skid Mode</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('carton')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  mode === 'carton'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>📦</span>
                  <span>Carton Mode</span>
                </span>
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-gray-500 mt-2">
            {mode === 'skid'
              ? 'Create pallets (skids) with cartons inside them'
              : 'Create cartons directly without pallets'}
          </p>
        </div>

        {/* Step Indicators */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                currentStep === 1
                  ? mode === 'skid' ? 'bg-purple-600 text-white ring-4 ring-purple-100' : 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-green-500 text-white'
              }`}>
                {currentStep > 1 ? '✓' : '1'}
              </div>
              <div className={`ml-3 text-sm font-medium ${
                currentStep === 1
                  ? mode === 'skid' ? 'text-purple-600' : 'text-blue-600'
                  : 'text-green-600'
              }`}>
                {mode === 'skid' ? 'Configure Skids' : 'Configure Cartons'}
              </div>
            </div>
            <div className={`h-1 w-24 rounded-full ${currentStep > 1 ? 'bg-green-500' : 'bg-gray-200'}`} />
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                currentStep === 2
                  ? mode === 'skid' ? 'bg-purple-600 text-white ring-4 ring-purple-100' : 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                2
              </div>
              <div className={`ml-3 text-sm font-medium ${
                currentStep === 2
                  ? mode === 'skid' ? 'text-purple-600' : 'text-blue-600'
                  : 'text-gray-500'
              }`}>
                Shipment Details
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Step 1: Configure Skids or Cartons */}
        {currentStep === 1 && (
          <>
            {/* Storefront Shipment Notice */}
        {isStorefrontShipment() && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-blue-900">Storefront Shipment Detected</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Materials are shown by default. {!showOtherItemTypes && 'Click the button to show Job, Components, Products, and Parts.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOtherItemTypes(!showOtherItemTypes)}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded transition-colors whitespace-nowrap"
              >
                {showOtherItemTypes ? 'Hide' : 'Show'} Job/Products/Parts
              </button>
            </div>
          </div>
        )}

        {/* SKID MODE UI */}
        {mode === 'skid' && (
        <div className="space-y-6">
          {skids.length === 0 && existingCartons && existingCartons.length > 0 && (
            <div className="border-2 border-orange-200 rounded-lg bg-orange-50 p-6 text-center">
              <p className="text-orange-800 font-medium mb-3">
                All skids/cartons will be removed from this shipment.
              </p>
              <button
                type="button"
                onClick={addSkid}
                className="text-purple-600 hover:text-purple-800 font-medium"
              >
                + Add Skid
              </button>
            </div>
          )}
          {skids.map((skid, skidIndex) => (
            <div key={skidIndex} className="border-2 border-purple-200 rounded-lg bg-purple-50">
            {/* Skid Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-purple-100 border-b-2 border-purple-200">
              <div className="flex items-center gap-4">
                <h3 className="text-base font-bold text-purple-900">
                  🗃️ Skid {skidIndex + 1}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addCartonToSkid(skidIndex)}
                  className="text-purple-700 hover:text-purple-900 text-xs font-medium"
                >
                  + Add Carton
                </button>
                {(skids.length > 1 || (existingCartons && existingCartons.length > 0)) && (
                  <button
                    type="button"
                    onClick={() => removeSkid(skidIndex)}
                    className="text-red-600 hover:text-red-800 text-xs font-medium ml-2"
                  >
                    Remove Skid
                  </button>
                )}
              </div>
            </div>

            {/* Skid Properties */}
            <div className="px-4 py-3 bg-purple-50 border-b border-purple-200 grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Count</label>
                <input
                  type="number"
                  min="1"
                  value={skid.count}
                  onChange={(e) => updateSkid(skidIndex, 'count', parseInt(e.target.value) || 1)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={skid.description}
                  onChange={(e) => updateSkid(skidIndex, 'description', e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Weight (lbs)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={skid.weight}
                  onChange={(e) => updateSkid(skidIndex, 'weight', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            {/* Cartons within this Skid */}
            <div className="p-4 space-y-3">
              {skid.cartons.map((carton, cartonIndex) => (
                <div key={cartonIndex} className="border border-gray-200 rounded-lg bg-white">
                  {/* Carton Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-4">
                      <h4 className="text-sm font-semibold text-gray-900">
                        📦 Carton {cartonIndex + 1}
                      </h4>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">Qty:</label>
                        <input
                          type="number"
                          min="1"
                          value={carton.count}
                          onChange={(e) => updateCarton(skidIndex, cartonIndex, 'count', parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">Note:</label>
                        <input
                          type="text"
                          value={carton.note || ''}
                          onChange={(e) => updateCarton(skidIndex, cartonIndex, 'note', e.target.value)}
                          placeholder="Optional note"
                          className="w-40 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => addContentToCarton(skidIndex, cartonIndex)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        + Add Item
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateCarton(skidIndex, cartonIndex)}
                        className="text-green-600 hover:text-green-800 text-xs font-medium flex items-center gap-1"
                        title="Duplicate this carton with quantities set to 1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Duplicate
                      </button>
                      {skid.cartons.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCartonFromSkid(skidIndex, cartonIndex)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium ml-2"
                        >
                          Remove Carton
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Contents Table */}
                  <div className="divide-y divide-gray-100">
                    {carton.contents.map((content, contentIndex) => (
                      <div key={contentIndex} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50">
                        {/* Item Selector */}
                        <div className="flex-1">
                          {loadingItems ? (
                            <div className="px-3 py-2 text-sm text-gray-500">
                              Loading items...
                            </div>
                          ) : (
                            <select
                              value={content.itemId || ''}
                              onChange={(e) => {
                                const selectedValue = e.target.value
                                updateContent(skidIndex, cartonIndex, contentIndex, 'itemId', selectedValue)

                                // Auto-populate quantity based on selected item
                                const allItemsFlat: Array<{ value: string; label: string; orderedQty?: number; plannedQty?: number }> = [
                                  ...itemGroups.job,
                                  ...itemGroups.components,
                                  ...itemGroups.products,
                                  ...itemGroups.parts,
                                  ...itemGroups.materials,
                                ]
                                const selectedItem = allItemsFlat.find(item => item.value === selectedValue)
                                const autoQty = selectedItem?.orderedQty || selectedItem?.plannedQty
                                if (autoQty && autoQty > 0) {
                                  updateContent(skidIndex, cartonIndex, contentIndex, 'quantity', autoQty)
                                }
                              }}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Select item to ship...</option>

                              {isStorefrontShipment() && !showOtherItemTypes && (
                                <option value="" disabled className="text-blue-600">
                                  ⓘ Click "Show Job/Products/Parts" above for more options
                                </option>
                              )}

                              {/* Job Option */}
                              {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.job.length > 0 && (
                                <optgroup label="━━━ JOB ━━━">
                                  {itemGroups.job.map((item) => (
                                    <option key={item.value} value={item.value}>
                                      {item.label}
                                    </option>
                                  ))}
                                </optgroup>
                              )}

                              {/* Components */}
                              {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.components.length > 0 && (
                                <optgroup label="━━━ COMPONENTS ━━━">
                                  {itemGroups.components.map((item) => (
                                    <option key={item.value} value={item.value}>
                                      {item.label}
                                    </option>
                                  ))}
                                </optgroup>
                              )}

                              {/* Products */}
                              {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.products.length > 0 && (
                                <optgroup label="━━━ PRODUCTS ━━━">
                                  {itemGroups.products.map((item) => (
                                    <option key={item.value} value={item.value}>
                                      {item.label}
                                    </option>
                                  ))}
                                </optgroup>
                              )}

                              {/* Parts */}
                              {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.parts.length > 0 && (
                                <optgroup label="━━━ PARTS ━━━">
                                  {itemGroups.parts.map((item) => (
                                    <option key={item.value} value={item.value}>
                                      {item.label}
                                    </option>
                                  ))}
                                </optgroup>
                              )}

                              {/* Materials */}
                              {itemGroups.materials.length > 0 && (
                                <optgroup label="━━━ MATERIALS ━━━">
                                  {itemGroups.materials.map((item) => (
                                    <option key={item.value} value={item.value}>
                                      {item.label}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          )}
                        </div>

                        {/* Quantity Input */}
                        <div className="w-32">
                          <input
                            type="number"
                            min="0"
                            value={content.quantity}
                            onChange={(e) => updateContent(skidIndex, cartonIndex, contentIndex, 'quantity', parseInt(e.target.value) || 0)}
                            placeholder="Qty"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        {/* Remove Button */}
                        {carton.contents.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeContentFromCarton(skidIndex, cartonIndex, contentIndex)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Remove item"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

          <button
            type="button"
            onClick={addSkid}
            className="w-full py-2 border-2 border-dashed border-purple-300 rounded-lg text-purple-600 hover:border-purple-400 hover:text-purple-700 transition-colors font-medium"
          >
            + Add Another Skid
          </button>
        </div>
        )}

        {/* CARTON MODE UI */}
        {mode === 'carton' && (
        <div className="space-y-6">
          {cartons.length === 0 && existingCartons && existingCartons.length > 0 && (
            <div className="border-2 border-orange-200 rounded-lg bg-orange-50 p-6 text-center">
              <p className="text-orange-800 font-medium mb-3">
                All cartons will be removed from this shipment.
              </p>
              <button
                type="button"
                onClick={addCarton}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add Carton
              </button>
            </div>
          )}

          {cartons.map((carton, cartonIndex) => (
            <div key={cartonIndex} className="border-2 border-blue-200 rounded-lg bg-blue-50">
              {/* Carton Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-blue-100 border-b-2 border-blue-200">
                <div className="flex items-center gap-4">
                  <h3 className="text-base font-bold text-blue-900">
                    📦 Carton {cartonIndex + 1}
                  </h3>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Qty:</label>
                    <input
                      type="number"
                      min="1"
                      value={carton.count}
                      onChange={(e) => updateCartonDirect(cartonIndex, 'count', parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Note:</label>
                    <input
                      type="text"
                      value={carton.note || ''}
                      onChange={(e) => updateCartonDirect(cartonIndex, 'note', e.target.value)}
                      placeholder="Optional note"
                      className="w-40 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addContentToCartonDirect(cartonIndex)}
                    className="text-blue-700 hover:text-blue-900 text-xs font-medium"
                  >
                    + Add Item
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateCartonDirect(cartonIndex)}
                    className="text-green-600 hover:text-green-800 text-xs font-medium flex items-center gap-1"
                    title="Duplicate this carton with quantities set to 1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Duplicate
                  </button>
                  {(cartons.length > 1 || (existingCartons && existingCartons.length > 0)) && (
                    <button
                      type="button"
                      onClick={() => removeCarton(cartonIndex)}
                      className="text-red-600 hover:text-red-800 text-xs font-medium ml-2"
                    >
                      Remove Carton
                    </button>
                  )}
                </div>
              </div>

              {/* Contents */}
              <div className="p-4">
                <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
                  {carton.contents.map((content, contentIndex) => (
                    <div key={contentIndex} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50">
                      {/* Item Selector */}
                      <div className="flex-1">
                        {loadingItems ? (
                          <div className="px-3 py-2 text-sm text-gray-500">
                            Loading items...
                          </div>
                        ) : (
                          <select
                            value={content.itemId || ''}
                            onChange={(e) => {
                              const selectedValue = e.target.value
                              updateContentDirect(cartonIndex, contentIndex, 'itemId', selectedValue)

                              // Auto-populate quantity based on selected item
                              const allItemsFlat: Array<{ value: string; label: string; orderedQty?: number; plannedQty?: number }> = [
                                ...itemGroups.job,
                                ...itemGroups.components,
                                ...itemGroups.products,
                                ...itemGroups.parts,
                                ...itemGroups.materials,
                              ]
                              const selectedItem = allItemsFlat.find(item => item.value === selectedValue)
                              const autoQty = selectedItem?.orderedQty || selectedItem?.plannedQty
                              if (autoQty && autoQty > 0) {
                                updateContentDirect(cartonIndex, contentIndex, 'quantity', autoQty)
                              }
                            }}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select item to ship...</option>

                            {isStorefrontShipment() && !showOtherItemTypes && (
                              <option value="" disabled className="text-blue-600">
                                ⓘ Click "Show Job/Products/Parts" above for more options
                              </option>
                            )}

                            {/* Job Option */}
                            {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.job.length > 0 && (
                              <optgroup label="━━━ JOB ━━━">
                                {itemGroups.job.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {/* Components */}
                            {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.components.length > 0 && (
                              <optgroup label="━━━ COMPONENTS ━━━">
                                {itemGroups.components.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {/* Products */}
                            {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.products.length > 0 && (
                              <optgroup label="━━━ PRODUCTS ━━━">
                                {itemGroups.products.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {/* Parts */}
                            {(!isStorefrontShipment() || showOtherItemTypes) && itemGroups.parts.length > 0 && (
                              <optgroup label="━━━ PARTS ━━━">
                                {itemGroups.parts.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {/* Materials */}
                            {itemGroups.materials.length > 0 && (
                              <optgroup label="━━━ MATERIALS ━━━">
                                {itemGroups.materials.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        )}
                      </div>

                      {/* Quantity Input */}
                      <div className="w-32">
                        <input
                          type="number"
                          min="0"
                          value={content.quantity}
                          onChange={(e) => updateContentDirect(cartonIndex, contentIndex, 'quantity', parseInt(e.target.value) || 0)}
                          placeholder="Qty"
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      {/* Remove Button */}
                      {carton.contents.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeContentFromCartonDirect(cartonIndex, contentIndex)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Remove item"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addCarton}
            className="w-full py-2 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:border-blue-400 hover:text-blue-700 transition-colors font-medium"
          >
            + Add Another Carton
          </button>
        </div>
        )}

            <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className={`px-6 py-2 text-white rounded-md font-medium ${
                  mode === 'skid' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Next: Shipment Details →
              </button>
            </div>
          </>
        )}

        {/* Step 2: Shipment Details */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 Optional Shipment Information</h3>
              <p className="text-xs text-blue-700">
                Add optional details for this shipment. All fields are optional and can be left blank.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={shipmentDetails.notes}
                  onChange={(e) => setShipmentDetails({ ...shipmentDetails, notes: e.target.value })}
                  rows={4}
                  placeholder="Enter any notes about this shipment..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Tracking Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tracking Number
                </label>
                <input
                  type="text"
                  value={shipmentDetails.trackingNumber}
                  onChange={(e) => setShipmentDetails({ ...shipmentDetails, trackingNumber: e.target.value })}
                  placeholder="Enter tracking number..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Tracking Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tracking Notes
                </label>
                <textarea
                  value={shipmentDetails.trackingNotes}
                  onChange={(e) => setShipmentDetails({ ...shipmentDetails, trackingNotes: e.target.value })}
                  rows={3}
                  placeholder="Enter tracking notes..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Cost */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cost
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={shipmentDetails.cost}
                    onChange={(e) => setShipmentDetails({ ...shipmentDetails, cost: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
              >
                ← Back to {mode === 'skid' ? 'Skids' : 'Cartons'}
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={processing}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className={`px-6 py-2 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                    mode === 'skid' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {processing
                    ? 'Processing...'
                    : existingCartons && existingCartons.length > 0
                    ? 'Update Configuration'
                    : mode === 'skid'
                    ? 'Create Skids with Cartons'
                    : 'Create Cartons'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right side - Preview Panel */}
      <div className="w-96 flex-shrink-0">
        <div className={`sticky top-6 bg-gradient-to-br rounded-lg p-6 shadow-lg border-2 ${
          mode === 'skid'
            ? 'from-purple-50 to-blue-50 border-purple-200'
            : 'from-blue-50 to-indigo-50 border-blue-200'
        }`}>
          <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${
            mode === 'skid' ? 'text-purple-900' : 'text-blue-900'
          }`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Summary Preview
          </h3>

          <div className="space-y-4">
            {/* Totals Section */}
            <div className={`bg-white rounded-lg p-4 shadow-sm border ${
              mode === 'skid' ? 'border-purple-100' : 'border-blue-100'
            }`}>
              <h4 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Totals</h4>
              <div className="space-y-2">
                {mode === 'skid' && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600 flex items-center gap-2">
                      <span className="text-2xl">🗃️</span>
                      <span className="font-medium">Skids</span>
                    </span>
                    <span className="font-bold text-purple-700 text-lg">{totals.totalSkidCount}</span>
                  </div>
                )}
                <div className={`flex items-center justify-between py-2 ${mode === 'skid' ? 'border-b border-gray-100' : ''}`}>
                  <span className="text-gray-600 flex items-center gap-2">
                    <span className="text-2xl">📦</span>
                    <span className="font-medium">Cartons</span>
                  </span>
                  <span className="font-bold text-blue-700 text-lg">{totals.totalCartonCount}</span>
                </div>
                {mode === 'skid' && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600 flex items-center gap-2">
                      <span className="text-2xl">⚖️</span>
                      <span className="font-medium">Weight</span>
                    </span>
                    <span className="font-bold text-gray-700 text-lg">{totals.totalWeight.toFixed(2)} lbs</span>
                  </div>
                )}
              </div>
            </div>

            {/* Items Section */}
            {totals.itemQuantities.length > 0 && (
              <div className={`bg-white rounded-lg p-4 shadow-sm border ${
                mode === 'skid' ? 'border-purple-100' : 'border-blue-100'
              }`}>
                <h4 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Items Breakdown</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {totals.itemQuantities.map((item) => (
                    <div key={item.id} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-700 flex-1 pr-2 leading-tight">
                        {item.name}
                      </span>
                      <span className={`font-semibold text-sm whitespace-nowrap ${
                        mode === 'skid' ? 'text-purple-700' : 'text-blue-700'
                      }`}>
                        {item.quantity} qty
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {totals.itemQuantities.length === 0 && (
              <div className={`bg-white rounded-lg p-6 shadow-sm border text-center ${
                mode === 'skid' ? 'border-purple-100' : 'border-blue-100'
              }`}>
                <div className="text-gray-400 text-4xl mb-2">📋</div>
                <p className="text-gray-500 text-sm">
                  Add items to cartons to see the breakdown
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}

// Edit Carton Form Component
function EditCartonForm({
  carton,
  shipment,
  onSuccess,
  onCancel,
}: {
  carton: Carton
  shipment: JobShipment | null
  onSuccess: () => void
  onCancel: () => void
}) {
  const [count, setCount] = useState(carton.count || 1)
  const [weight, setWeight] = useState(carton.weight || '')
  const [trackingNumber, setTrackingNumber] = useState(carton.trackingNumber || '')
  const [contents, setContents] = useState(carton.contents || [])
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingContentId, setDeletingContentId] = useState<number | null>(null)
  const [deletingCarton, setDeletingCarton] = useState(false)
  const [showAddContent, setShowAddContent] = useState(false)
  const [newContentType, setNewContentType] = useState<'job' | 'jobPart' | 'jobComponent' | 'jobProduct'>('jobComponent')
  const [newContentItemId, setNewContentItemId] = useState<string | number>('')
  const [newContentQuantity, setNewContentQuantity] = useState(1)
  const [addingContent, setAddingContent] = useState(false)
  const [jobItems, setJobItems] = useState<{
    components: Array<{ id: number; description: string; itemNumber?: string; qtyOrdered?: number }>
    products: Array<{ id: number; description: string; productID?: string }>
    parts: Array<{ id: string; description: string; partName?: string }>
  } | null>(null)
  const [loadingItems, setLoadingItems] = useState(false)

  // Load job items on mount
  useEffect(() => {
    if (shipment?.job) {
      loadJobItems()
    }
  }, [shipment?.job])

  const loadJobItems = async () => {
    if (!shipment?.job) return

    setLoadingItems(true)
    try {
      const response = await fetch(`/api/pace/jobs/${encodeURIComponent(shipment.job)}/items`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setJobItems(data.data)
        }
      }
    } catch (err) {
      console.error('Failed to load job items:', err)
    } finally {
      setLoadingItems(false)
    }
  }

  const handleAddContent = async () => {
    if (!newContentItemId && newContentType !== 'job') {
      setError('Please select an item')
      return
    }

    setAddingContent(true)
    setError(null)

    try {
      const contentPayload: any = {
        quantity: newContentQuantity,
      }

      // Map type and itemId to appropriate PACE API fields
      if (newContentType === 'job') {
        contentPayload.job = shipment?.job
      } else if (newContentType === 'jobComponent') {
        contentPayload.jobComponent = parseInt(newContentItemId.toString())
      } else if (newContentType === 'jobProduct') {
        contentPayload.jobProduct = parseInt(newContentItemId.toString())
      } else if (newContentType === 'jobPart') {
        // JobPart needs BOTH job (as integer) and jobPart (as string part number)
        // Extract from composite key format "job:part" (e.g., "1:02")
        const [jobId, partNum] = newContentItemId.toString().split(':')
        contentPayload.job = parseInt(jobId)
        contentPayload.jobPart = partNum
        contentPayload.isJobPart = true  // Flag to help backend distinguish
      }

      const response = await fetch(`/api/pace/cartons/${carton.id}/add-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contentPayload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add content')
      }

      // Reset form and refresh
      setShowAddContent(false)
      setNewContentType('jobComponent')
      setNewContentItemId('')
      setNewContentQuantity(1)
      onSuccess() // This will refresh the cartons
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setAddingContent(false)
    }
  }

  const handleDeleteCarton = async () => {
    if (!confirm('Are you sure you want to delete this entire carton? This action cannot be undone.')) return

    setDeletingCarton(true)
    try {
      const response = await fetch(`/api/pace/cartons/${carton.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete carton')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setDeletingCarton(false)
    }
  }

  const handleDeleteContent = async (contentId: number) => {
    if (!confirm('Are you sure you want to delete this content?')) return

    setDeletingContentId(contentId)
    try {
      const response = await fetch(`/api/pace/carton-content/${contentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete content')
      }

      // Remove from local state
      setContents(contents.filter(c => c.id !== contentId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setDeletingContentId(null)
    }
  }

  const handleUpdateContent = async (contentId: number, quantity: number) => {
    console.log('Updating carton content quantity:', { contentId, quantity })
    try {
      const response = await fetch(`/api/pace/carton-content/${contentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to update carton content:', errorData)
        throw new Error(errorData.error || 'Failed to update content')
      }

      const result = await response.json()
      console.log('Carton content quantity updated successfully:', result)

      // Update local state
      setContents(contents.map(c => c.id === contentId ? { ...c, quantity } : c))

      // Refresh the parent carton list to show updated quantities
      onSuccess()
    } catch (err) {
      console.error('Update content error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProcessing(true)
    setError(null)

    try {
      // Update carton basic info
      const response = await fetch(`/api/pace/cartons/${carton.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count,
          weight: weight || undefined,
          trackingNumber: trackingNumber || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update carton')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Carton Info */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Physical Cartons
            </label>
            <input
              type="number"
              min="1"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Weight (lbs)
            </label>
            <input
              type="number"
              step="0.01"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tracking Number
            </label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Contents */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Contents</h3>
          {contents.length > 0 ? (
            <div className="space-y-2">
              {contents.map((content) => {
                const description =
                  content.jobComponentDescription ||
                  content.jobProductDescription ||
                  content.jobMaterialDescription ||
                  content.jobDescription ||
                  content.contentDescription ||
                  'Unknown content'

                let contentType = ''
                let badgeColor = 'bg-blue-100 text-blue-700'
                if (content.jobComponent) {
                  contentType = 'Component'
                  badgeColor = 'bg-blue-100 text-blue-700'
                } else if (content.jobProduct) {
                  contentType = 'Product'
                  badgeColor = 'bg-green-100 text-green-700'
                } else if (content.jobMaterial) {
                  contentType = 'Material'
                  badgeColor = 'bg-yellow-100 text-yellow-700'
                } else if (content.job) {
                  contentType = 'Job'
                  badgeColor = 'bg-purple-100 text-purple-700'
                } else if (content.jobPart) {
                  contentType = 'Part'
                  badgeColor = 'bg-orange-100 text-orange-700'
                }

                return (
                  <div key={content.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded border border-gray-200">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeColor}`}>
                          {contentType}
                        </span>
                        <span className="text-sm text-gray-900">{description}</span>
                      </div>
                      {content.jobComponentItemNumber && (
                        <p className="text-xs text-gray-600 mt-1">
                          Item: {content.jobComponentItemNumber}
                          {content.jobComponentPO && ` | PO: ${content.jobComponentPO}`}
                        </p>
                      )}
                      {content.jobMaterialID && (
                        <p className="text-xs text-gray-600 mt-1">
                          Material ID: {content.jobMaterialID}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={content.quantity || 0}
                        onChange={(e) => {
                          const newQty = parseInt(e.target.value) || 0
                          setContents(contents.map(c => c.id === content.id ? { ...c, quantity: newQty } : c))
                        }}
                        onBlur={(e) => {
                          const newQty = parseInt(e.target.value) || 0
                          // Get the original value from the carton prop, not the current state
                          const originalContent = carton.contents?.find(c => c.id === content.id)
                          const originalQty = originalContent?.quantity || 0
                          if (newQty !== originalQty && content.id) {
                            console.log('Quantity changed, updating:', { contentId: content.id, from: originalQty, to: newQty })
                            handleUpdateContent(content.id, newQty)
                          } else {
                            console.log('Quantity unchanged, not updating:', { contentId: content.id, quantity: newQty })
                          }
                        }}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => content.id && handleDeleteContent(content.id)}
                        disabled={deletingContentId === content.id}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                        title="Delete content"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No contents in this carton</p>
          )}

          {/* Add Content Button / Form */}
          {!showAddContent ? (
            <button
              type="button"
              onClick={() => setShowAddContent(true)}
              className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Content
            </button>
          ) : (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Add New Content</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Content Type
                  </label>
                  <select
                    value={newContentType}
                    onChange={(e) => {
                      setNewContentType(e.target.value as any)
                      setNewContentItemId('')
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="jobComponent">Component</option>
                    <option value="jobProduct">Product</option>
                    <option value="jobPart">Part</option>
                    <option value="job">Job</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {newContentType === 'jobComponent' ? 'Component' :
                     newContentType === 'jobProduct' ? 'Product' :
                     newContentType === 'jobPart' ? 'Part' : 'Job'}
                  </label>
                  {loadingItems ? (
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-500">
                      Loading...
                    </div>
                  ) : newContentType === 'job' ? (
                    <input
                      type="text"
                      value={shipment?.job || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
                    />
                  ) : (
                    <select
                      value={newContentItemId}
                      onChange={(e) => setNewContentItemId(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Select...</option>
                      {newContentType === 'jobComponent' && jobItems?.components.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.description} {comp.itemNumber ? `(${comp.itemNumber})` : ''}
                        </option>
                      ))}
                      {newContentType === 'jobProduct' && jobItems?.products.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.description} {prod.productID ? `(${prod.productID})` : ''}
                        </option>
                      ))}
                      {newContentType === 'jobPart' && jobItems?.parts.map((part) => (
                        <option key={part.id} value={part.id}>
                          {part.description} {part.partName ? `(${part.partName})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newContentQuantity}
                    onChange={(e) => setNewContentQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleAddContent}
                  disabled={addingContent || (!newContentItemId && newContentType !== 'job')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingContent ? 'Adding...' : 'Add Content'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddContent(false)
                    setNewContentType('jobComponent')
                    setNewContentItemId('')
                    setNewContentQuantity(1)
                  }}
                  disabled={addingContent}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <button
          type="button"
          onClick={handleDeleteCarton}
          disabled={deletingCarton || processing}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deletingCarton ? 'Deleting...' : 'Delete Carton'}
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing || deletingCarton}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={processing || deletingCarton}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  )
}

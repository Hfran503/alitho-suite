'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { JobShipment, Carton } from '@repo/types'
import { formatDateOnlyPT } from '@/lib/dateUtils'

export default function ShipmentDetailsPage() {
  const params = useParams()
  const shipmentId = params.id as string

  const [shipment, setShipment] = useState<JobShipment | null>(null)
  const [cartons, setCartons] = useState<Carton[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCartons, setLoadingCartons] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'special' | 'other'>('details')
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [editingCarton, setEditingCarton] = useState<Carton | null>(null)

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

  useEffect(() => {
    if (shipmentId) {
      fetchShipment()
      fetchCartons()
    }
  }, [shipmentId])

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
      <div className="max-w-7xl mx-auto">
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
    <div className="max-w-7xl mx-auto">
      {/* Header with Status Badge */}
      <div className="mb-6">
        <Link href="/shipments" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to Shipments
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Shipment #{shipment.id}</h1>
          </div>
          <div className="text-right">
            {shipment.dateTime ? (
              <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-green-100 text-green-800">
                ✓ Shipped
              </span>
            ) : (
              <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-yellow-100 text-yellow-800">
                ⏳ Pending
              </span>
            )}
          </div>
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
        {/* Top Section - Job & Shipping Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Left Column - Job & Customer Info */}
        <div className="lg:col-span-2 space-y-6">

          {/* Job Information Card */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Job Information</h2>
              <div className="space-y-4">
                <div>
                  <span className="text-2xl font-bold text-blue-600">{shipment.job || 'N/A'}</span>
                  <span className="text-sm text-gray-500 ml-2">Job Number</span>
                </div>

                {jobDescription && (
                  <div>
                    <p className="text-gray-900 font-medium">{jobDescription}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {(jobCustomerName || jobCustomer) && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Customer</label>
                      <p className="text-base text-gray-900 mt-1">{jobCustomerName || jobCustomer}</p>
                    </div>
                  )}
                  {jobSalesperson && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Salesperson</label>
                      <p className="text-base text-gray-900 mt-1">{jobSalesperson}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Shipping & Destination Card */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Shipping & Destination</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Destination */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Ship To</h3>
                  <div className="space-y-2">
                    {companyName && (
                      <p className="text-lg font-semibold text-gray-900">{companyName}</p>
                    )}
                    {(shipment.contactFirstName || shipment.contactLastName) && (
                      <p className="text-base text-gray-700">
                        {[shipment.contactFirstName, shipment.contactLastName].filter(Boolean).join(' ')}
                      </p>
                    )}
                    <div className="text-gray-700 text-sm">
                      {shipment.address1 && <p>{shipment.address1}</p>}
                      {shipment.address2 && <p>{shipment.address2}</p>}
                      {shipment.address3 && <p>{shipment.address3}</p>}
                      {(shipment.city || shipment.state || shipment.zip) && (
                        <p>
                          {[shipment.city, shipment.state, shipment.zip].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                    {shipment.phone && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Phone:</span> {shipment.phone}
                      </p>
                    )}
                    {shipment.email && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Email:</span> {shipment.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Shipping Method */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Shipping Method</h3>
                  <div className="space-y-3">
                    {shipViaDescription && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Carrier</label>
                        <p className="text-base font-semibold text-gray-900 mt-1">{shipViaDescription}</p>
                        {shipViaProvider && (
                          <p className="text-sm text-gray-600 mt-1">{shipViaProvider}</p>
                        )}
                      </div>
                    )}

                    {shipment.trackingNumber && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Tracking #</label>
                        <p className="text-base font-mono text-gray-900 mt-1">{shipment.trackingNumber}</p>
                      </div>
                    )}

                    {shipment.shipViaNote && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Notes</label>
                        <p className="text-sm text-gray-700 mt-1">{shipment.shipViaNote}</p>
                      </div>
                    )}
                  </div>
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
        <div className="space-y-6">

          {/* Dates Section */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Dates</h3>
              <div className="space-y-3">
                {shipment.dateTime && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Shipment Date</label>
                    <p className="text-base text-gray-900 mt-1">
                      {formatDateOnlyPT(shipment.dateTime)}
                    </p>
                  </div>
                )}

                {shipment.u_create_date && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Created</label>
                    <p className="text-base text-gray-900 mt-1">
                      {formatDateOnlyPT(shipment.u_create_date)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quantity & Type */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Shipment Details</h3>
              <div className="space-y-4">
                {shipment.u_csr_qty && shipment.u_csr_qty !== '0' && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Planned Qty</label>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{shipment.u_csr_qty}</p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Quantity</label>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{shipment.quantity || '-'}</p>
                </div>

                {shipmentTypeDescription && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Type</label>
                    <p className="text-base text-gray-900 mt-1">{shipmentTypeDescription}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Width Cartons Section */}
      <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Cartons {!loadingCartons && cartons.length > 0 && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({cartons.length})
                  </span>
                )}
              </h2>
            </div>

            {loadingCartons ? (
              <div className="text-center py-8 text-gray-500">
                Loading cartons...
              </div>
            ) : cartons.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📦</div>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No Cartons Found</h3>
                <p className="text-gray-500 mb-6">This shipment hasn't been processed yet.</p>
                <button
                  onClick={() => setShowProcessModal(true)}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Process Shipment
                </button>
              </div>
            ) : (
              <div>
                {/* Action Buttons when cartons exist */}
                <div className="mb-4 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setShowProcessModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-blue-600 text-sm font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create More Cartons
                  </button>

                  <button
                    onClick={handleDeleteAllCartons}
                    className="inline-flex items-center px-4 py-2 border border-red-600 text-sm font-medium rounded-md text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete All Cartons
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Carton #
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
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tracking
                      </th>
                      <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {cartons.map((carton, index) => (
                      <tr key={carton.id || index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">#{carton.id}</span>
                            {carton.count && carton.count > 1 && (
                              <span className="text-xs text-gray-500">{carton.count} cartons</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {carton.contents && carton.contents.length > 0 ? (
                            <div className="space-y-1.5">
                              {carton.contents.map((content, contentIndex) => {
                                const primaryDescription =
                                  content.jobComponentDescription ||
                                  content.jobProductDescription ||
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
                                        {!content.jobComponentItemNumber && !content.jobComponentPO && (content.jobPart || content.job) && (
                                          <p className="text-xs text-gray-500 truncate">
                                            {content.jobPart ? `Part: ${content.jobPart}` : content.job ? `Job: ${content.job}` : ''}
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
                          <button
                            onClick={() => setEditingCarton(carton)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3"
                            title="Edit carton"
                          >
                            Edit
                          </button>
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
                                  return contentSum + (qty * count)
                                }, 0)
                                return sum + cartonTotal
                              }, 0)
                              return grandTotal.toLocaleString()
                            })()}
                          </span>
                        </td>
                        <td colSpan={3} className="px-4 py-4">
                          <div className="flex items-center gap-4">
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">
                                {(() => {
                                  const totalCartonCount = cartons.reduce((sum, carton) => {
                                    return sum + (carton.count || 1)
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
          </div>
        </>
      ) : activeTab === 'special' ? (
        /* Special Information Tab */
        <div className="max-w-4xl">
          {shipment.u_specialinformation ? (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg shadow-sm">
              <div className="p-8">
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-3xl">⚠️</span>
                  <h2 className="text-2xl font-bold text-amber-900">Special Information</h2>
                </div>
                <div className="bg-white rounded-md p-6 border border-amber-200">
                  <p className="text-lg text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {shipment.u_specialinformation}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">📋</div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Special Information</h3>
              <p className="text-gray-500">There is no special information recorded for this shipment.</p>
            </div>
          )}
        </div>
      ) : (
        /* Other Info Tab */
        <div className="max-w-4xl">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Additional Shipment Information</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Tracking Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase border-b pb-2">Tracking</h3>

                  {shipment.trackingNumber && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Tracking Number</label>
                      <p className="text-base text-gray-900 mt-1 font-mono">{shipment.trackingNumber}</p>
                    </div>
                  )}

                  {shipment.trackingLink && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Tracking Link</label>
                      <a
                        href={shipment.trackingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base text-blue-600 hover:text-blue-800 mt-1 block break-all underline"
                      >
                        {shipment.trackingLink}
                      </a>
                    </div>
                  )}

                  {!shipment.trackingNumber && !shipment.trackingLink && (
                    <p className="text-sm text-gray-400 italic">No tracking information available</p>
                  )}
                </div>

                {/* Cost Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase border-b pb-2">Costs</h3>

                  {shipment.cost !== undefined && shipment.cost !== null && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Shipping Cost</label>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        ${shipment.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}

                  {shipment.charges !== undefined && shipment.charges !== null && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Payment Terms</label>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {typeof shipment.charges === 'number'
                          ? `$${shipment.charges.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : shipment.charges
                        }
                      </p>
                    </div>
                  )}

                  {(shipment.cost !== undefined && shipment.cost !== null) &&
                   typeof shipment.charges === 'number' && (
                    <div className="pt-3 border-t border-gray-200">
                      <label className="text-xs font-medium text-gray-500 uppercase">Total Cost</label>
                      <p className="text-2xl font-bold text-blue-600 mt-1">
                        ${((shipment.cost || 0) + (shipment.charges || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}

                  {(shipment.cost === undefined || shipment.cost === null) &&
                   (shipment.charges === undefined || shipment.charges === null) && (
                    <p className="text-sm text-gray-400 italic">No cost information available</p>
                  )}
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
    try {
      const response = await fetch(`/api/pace/carton-content/${contentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update content')
      }

      // Update local state
      setContents(contents.map(c => c.id === contentId ? { ...c, quantity } : c))
    } catch (err) {
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
                  content.jobDescription ||
                  content.contentDescription ||
                  'Unknown content'

                let contentType = ''
                if (content.jobComponent) contentType = 'Component'
                else if (content.jobProduct) contentType = 'Product'
                else if (content.job) contentType = 'Job'
                else if (content.jobPart) contentType = 'Part'

                return (
                  <div key={content.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded border border-gray-200">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
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
                          if (newQty !== content.quantity && content.id) {
                            handleUpdateContent(content.id, newQty)
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

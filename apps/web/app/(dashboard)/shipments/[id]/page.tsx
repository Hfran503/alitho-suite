'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { JobShipment } from '@repo/types'

export default function ShipmentDetailsPage() {
  const params = useParams()
  const shipmentId = params.id as string

  const [shipment, setShipment] = useState<JobShipment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Lookup descriptions
  const [shipViaDescription, setShipViaDescription] = useState<string | null>(null)
  const [shipViaProvider, setShipViaProvider] = useState<string | null>(null)
  const [shipmentTypeDescription, setShipmentTypeDescription] = useState<string | null>(null)

  // Job details
  const [jobDescription, setJobDescription] = useState<string | null>(null)
  const [jobCustomer, setJobCustomer] = useState<string | null>(null)
  const [jobSalesperson, setJobSalesperson] = useState<string | null>(null)

  // Contact company name
  const [companyName, setCompanyName] = useState<string | null>(null)

  useEffect(() => {
    if (shipmentId) {
      fetchShipment()
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
              .then(result => {
                if (result.success) {
                  setJobDescription(result.data.description)
                  setJobCustomer(result.data.customer)

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

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

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
                  {jobCustomer && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Customer</label>
                      <p className="text-base text-gray-900 mt-1">{jobCustomer}</p>
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

          {/* Special Information (if exists) */}
          {shipment.u_specialinformation && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg">
              <div className="p-6">
                <h3 className="text-sm font-semibold text-amber-900 mb-2 uppercase">⚠️ Special Information</h3>
                <p className="text-base text-amber-900 whitespace-pre-wrap">{shipment.u_specialinformation}</p>
              </div>
            </div>
          )}

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
                      {new Date(shipment.dateTime).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                )}

                {shipment.u_create_date && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Created</label>
                    <p className="text-base text-gray-900 mt-1">
                      {new Date(shipment.u_create_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
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
    </div>
  )
}

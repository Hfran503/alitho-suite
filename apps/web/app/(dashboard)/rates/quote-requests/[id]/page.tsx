'use client'

import React, { use, Suspense, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Package {
  qty: string
  weight: string
  length: string
  width: string
  height: string
}

interface RateBreakdown {
  carrierRate: number
  markupAmount: number
  processingFee: number
  rateDetails: { type: string; description: string; amount: number }[]
}

interface RateEntry {
  carrierId: string
  serviceCode: string
  carrierName: string
  serviceName: string
  perPackageRate: number
  perAddressRate: number
  totalRate: number
  deliveryDays: number | null
  rateBreakdown: RateBreakdown | null
}

interface QuoteRequest {
  id: string
  referenceNumber: string | null
  carrierId: string
  serviceCode: string
  carrierName: string
  serviceName: string
  fromZip: string
  fromCity: string
  fromState: string
  fromCountry: string
  toZip: string
  toCity: string
  toState: string
  toCountry: string
  residential: boolean
  addressCount: number
  confirmation: string
  shipDate: string | null
  packages: Package[]
  perPackageRate: string | null
  perAddressRate: string | null
  totalRate: string | null
  deliveryDays: number | null
  rateBreakdown: RateBreakdown | null
  allRates: RateEntry[] | null
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
  createdBy: { name: string | null; email: string }
}

function QuoteRequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [request, setRequest] = useState<QuoteRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRate, setExpandedRate] = useState<number | null>(null)

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const res = await fetch(`/api/rates/quote-requests/${id}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch quote request')
        }

        setRequest(data.data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchRequest()
  }, [id])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm">Loading quote request...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => router.push('/rates/quote-requests')}
          className="text-amber-600 hover:text-amber-800 flex items-center gap-2 mb-4 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Quote Requests
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error || 'Quote request not found'}</p>
        </div>
      </div>
    )
  }

  const formatCurrency = (value: string | number | null) => {
    if (value === null || value === undefined) return '—'
    const num = typeof value === 'string' ? parseFloat(value) : value
    return `$${num.toFixed(2)}`
  }

  const totalPackages = (request.packages || []).reduce(
    (sum: number, p: Package) => sum + Math.max(1, parseInt(p.qty) || 1),
    0
  )

  const confirmationLabels: Record<string, string> = {
    none: 'None',
    delivery: 'Delivery Confirmation',
    signature: 'Signature Required',
    adult_signature: 'Adult Signature',
    direct_signature: 'Direct Signature',
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-amber-100 text-amber-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const hasMultipleRates = request.allRates && request.allRates.length > 1

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back button */}
      <button
        onClick={() => router.push('/rates/quote-requests')}
        className="text-amber-600 hover:text-amber-800 flex items-center gap-2 mb-4 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Quote Requests
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Quote Request
            {request.referenceNumber && (
              <span className="text-gray-500 ml-2">— {request.referenceNumber}</span>
            )}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Created {new Date(request.createdAt).toLocaleString()} by{' '}
            {request.createdBy?.name || request.createdBy?.email}
          </p>
        </div>
        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}>
          {request.status}
        </span>
      </div>

      <div className="space-y-4">
        {/* Rate Result Banner */}
        {request.totalRate && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-5 mb-4 text-center">
              <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide mb-1">
                {hasMultipleRates ? 'Lowest Rate — ' : ''}Shipping Cost Will Not Exceed
              </p>
              <p className="text-4xl font-bold text-amber-800">
                {formatCurrency(request.totalRate)}
              </p>
              <p className="text-sm text-amber-600 mt-1">
                {request.carrierName} — {request.serviceName}
                {' · '}for {request.addressCount.toLocaleString()} address{request.addressCount !== 1 ? 'es' : ''}
              </p>
            </div>

            {/* Multi-rate comparison table */}
            {hasMultipleRates && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Rate Comparison ({request.allRates!.length} services)
                </p>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs text-gray-500">
                        <th className="px-3 py-2 font-medium">Carrier</th>
                        <th className="px-3 py-2 font-medium">Service</th>
                        <th className="px-3 py-2 font-medium text-right">Per Address</th>
                        <th className="px-3 py-2 font-medium text-right">Total</th>
                        <th className="px-3 py-2 font-medium text-right">Delivery</th>
                        <th className="px-3 py-2 font-medium w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {request.allRates!.map((r, i) => (
                        <React.Fragment key={`rate-${i}`}>
                          <tr
                            className={`${i === 0 ? 'bg-amber-50' : 'hover:bg-gray-50'} cursor-pointer transition-colors`}
                            onClick={() => setExpandedRate(expandedRate === i ? null : i)}
                          >
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                {i === 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-800">
                                    BEST
                                  </span>
                                )}
                                <span className="font-medium text-gray-900">{r.carrierName}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-gray-700">{r.serviceName}</td>
                            <td className="px-3 py-2.5 text-right font-medium text-gray-900">
                              {formatCurrency(r.perAddressRate)}
                            </td>
                            <td className={`px-3 py-2.5 text-right font-bold ${i === 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                              {formatCurrency(r.totalRate)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-600">
                              {r.deliveryDays ? `${r.deliveryDays}d` : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <svg
                                className={`w-4 h-4 text-gray-400 transition-transform ${expandedRate === i ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </td>
                          </tr>
                          {expandedRate === i && r.rateBreakdown && (
                            <tr>
                              <td colSpan={6} className="px-3 py-3 bg-gray-50">
                                <div className="space-y-1.5 text-sm max-w-md">
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Per Address Breakdown</p>
                                  {r.rateBreakdown.rateDetails && r.rateBreakdown.rateDetails.length > 0 ? (
                                    r.rateBreakdown.rateDetails.map((detail, di) => (
                                      <div key={di} className="flex justify-between text-gray-600">
                                        <span>{detail.description || detail.type}</span>
                                        <span className="font-medium text-gray-900">${detail.amount.toFixed(2)}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="flex justify-between text-gray-600">
                                      <span>Carrier Rate</span>
                                      <span className="font-medium text-gray-900">${r.rateBreakdown.carrierRate.toFixed(2)}</span>
                                    </div>
                                  )}
                                  {r.rateBreakdown.markupAmount > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                      <span>Markup</span>
                                      <span className="font-medium text-gray-900">${r.rateBreakdown.markupAmount.toFixed(2)}</span>
                                    </div>
                                  )}
                                  {r.rateBreakdown.processingFee > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                      <span>Processing Fee</span>
                                      <span className="font-medium text-gray-900">${r.rateBreakdown.processingFee.toFixed(2)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-gray-800 font-semibold border-t border-gray-200 pt-1">
                                    <span>Per Address ({totalPackages} pkg{totalPackages !== 1 ? 's' : ''})</span>
                                    <span>{formatCurrency(r.perAddressRate)}</span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Single-rate breakdown (no allRates or only 1 rate) */}
            {!hasMultipleRates && (
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Carrier / Service</span>
                  <span className="font-medium text-gray-900">
                    {request.carrierName} — {request.serviceName}
                  </span>
                </div>
                {request.deliveryDays && (
                  <div className="flex justify-between text-gray-600">
                    <span>Est. Delivery</span>
                    <span className="font-medium text-gray-900">
                      {request.deliveryDays} business day{request.deliveryDays !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {/* Per-address breakdown */}
                <hr className="border-gray-200" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Per Address Breakdown</p>
                {request.rateBreakdown ? (
                  <>
                    {request.rateBreakdown.rateDetails && request.rateBreakdown.rateDetails.length > 0 ? (
                      request.rateBreakdown.rateDetails.map((detail, i) => (
                        <div key={i} className="flex justify-between text-gray-600">
                          <span>{detail.description || detail.type}</span>
                          <span className="font-medium text-gray-900">${detail.amount.toFixed(2)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between text-gray-600">
                        <span>Carrier Rate</span>
                        <span className="font-medium text-gray-900">${request.rateBreakdown.carrierRate.toFixed(2)}</span>
                      </div>
                    )}
                    {request.rateBreakdown.markupAmount > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Markup</span>
                        <span className="font-medium text-gray-900">${request.rateBreakdown.markupAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {request.rateBreakdown.processingFee > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Processing Fee</span>
                        <span className="font-medium text-gray-900">${request.rateBreakdown.processingFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-800 font-semibold border-t border-gray-100 pt-1">
                      <span>Per Address ({totalPackages} pkg{totalPackages !== 1 ? 's' : ''})</span>
                      <span>{formatCurrency(request.perAddressRate)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Per Package</span>
                      <span className="font-medium text-gray-900">{formatCurrency(request.perPackageRate)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Per Address ({totalPackages} pkg{totalPackages !== 1 ? 's' : ''})</span>
                      <span className="font-medium text-gray-900">{formatCurrency(request.perAddressRate)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Total */}
            <div className="space-y-2 text-sm border-t border-gray-200 pt-3 mt-3">
              <div className="flex justify-between text-gray-600">
                <span># of Addresses</span>
                <span className="font-medium text-gray-900">&times; {request.addressCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 text-base">
                <span>{hasMultipleRates ? 'Best Total' : 'Total'} (Not to Exceed)</span>
                <span className="text-amber-700">{formatCurrency(request.totalRate)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Carrier & Service (best rate) */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3">
            {hasMultipleRates ? 'Best Rate — ' : ''}Carrier / Service
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-gray-500">Carrier</span>
              <p className="font-medium text-gray-900">{request.carrierName}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Service</span>
              <p className="font-medium text-gray-900">{request.serviceName}</p>
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3">From Address</h2>
            <p className="text-sm text-gray-900">
              {request.fromCity}, {request.fromState} {request.fromZip}
            </p>
            <p className="text-xs text-gray-500">{request.fromCountry}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Furthest Zone Destination</h2>
            <p className="text-sm text-gray-900">
              {request.toCity}, {request.toState} {request.toZip}
            </p>
            <p className="text-xs text-gray-500">{request.toCountry}</p>
          </div>
        </div>

        {/* Shipping Details */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Shipping Details</h2>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs text-gray-500">Address Type</span>
              <p className="font-medium text-gray-900">{request.residential ? 'Residential' : 'Commercial'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500"># of Addresses</span>
              <p className="font-medium text-gray-900">{request.addressCount.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Ship Date</span>
              <p className="font-medium text-gray-900">{request.shipDate || '—'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Confirmation</span>
              <p className="font-medium text-gray-900">{confirmationLabels[request.confirmation] || request.confirmation}</p>
            </div>
          </div>
        </div>

        {/* Packages */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3">
            Packages
            <span className="text-xs font-normal text-gray-500 ml-2">
              ({totalPackages} total)
            </span>
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="pb-2 pr-3 font-medium">#</th>
                <th className="pb-2 pr-3 font-medium">Qty</th>
                <th className="pb-2 pr-3 font-medium">Weight (lb)</th>
                <th className="pb-2 pr-3 font-medium">L (in)</th>
                <th className="pb-2 pr-3 font-medium">W (in)</th>
                <th className="pb-2 font-medium">H (in)</th>
              </tr>
            </thead>
            <tbody>
              {(request.packages || []).map((pkg: Package, index: number) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-2 pr-3 text-gray-500">{index + 1}</td>
                  <td className="py-2 pr-3 text-gray-900">{pkg.qty || 1}</td>
                  <td className="py-2 pr-3 text-gray-900">{pkg.weight}</td>
                  <td className="py-2 pr-3 text-gray-900">{pkg.length || '—'}</td>
                  <td className="py-2 pr-3 text-gray-900">{pkg.width || '—'}</td>
                  <td className="py-2 text-gray-900">{pkg.height || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {request.notes && (
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-sm font-bold text-gray-900 mb-2">Notes</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function QuoteRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-sm">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <QuoteRequestDetail params={params} />
    </Suspense>
  )
}

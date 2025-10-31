'use client'

import { useState } from 'react'

interface Step4ReviewProps {
  fileName: string
  sheetName: string | null
  data: any[]
  columnMapping: Record<string, string>
  shippingConfig: any
  onStartProcessing: (batchId: string) => void
  onBack: () => void
}

export function Step4Review({
  fileName,
  sheetName,
  data,
  columnMapping,
  shippingConfig,
  onStartProcessing,
  onBack,
}: Step4ReviewProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  // Calculate summary statistics
  const uniqueJobs = new Set(
    data.map((row) => row[columnMapping.jobNumber]).filter(Boolean)
  ).size

  const uniqueAddresses = new Set(
    data.map((row) => {
      const addr = [
        row[columnMapping.shipToAddress1],
        row[columnMapping.shipToCity],
        row[columnMapping.shipToState],
        row[columnMapping.shipToZip],
      ]
        .filter(Boolean)
        .join('|')
      return addr
    })
  ).size

  const handleCreateBatch = async () => {
    setError('')
    setIsCreating(true)

    try {
      // Map the parsed data to our schema format
      const mappedRows = data.map((row, index) => {
        const mappedRow: any = {
          rowNumber: index + 2, // +2 for header row and 0-index
        }

        // Map each field from CSV to our schema
        Object.entries(columnMapping).forEach(([systemField, csvColumn]) => {
          const value = row[csvColumn]

          // Parse dates
          if (systemField === 'shipDate' && value) {
            console.log(`[Batch Import] 🔍 Parsing shipDate - Raw value:`, value, `Type: ${typeof value}`)
            // Handle Excel serial date numbers (days since 1900-01-01)
            // Excel serial dates are typically between 1 and 60000
            if (typeof value === 'number' || (!isNaN(Number(value)) && Number(value) > 0 && Number(value) < 100000)) {
              const excelSerialDate = Number(value)
              console.log(`[Batch Import] 📊 Detected Excel serial date: ${excelSerialDate}`)
              // Excel serial date: days since 1900-01-01 (with 1900 leap year bug)
              // JavaScript: milliseconds since 1970-01-01
              const excelEpoch = new Date(1899, 11, 30) // Dec 30, 1899 (accounting for Excel bug)
              const parsedDate = new Date(excelEpoch.getTime() + excelSerialDate * 24 * 60 * 60 * 1000)
              mappedRow.shipDate = parsedDate.toISOString()
              console.log(`[Batch Import] ✅ Converted to: ${mappedRow.shipDate} (${parsedDate.toLocaleDateString()})`)
            } else {
              // Regular date string
              console.log(`[Batch Import] 📅 Parsing as date string: ${value}`)
              const parsedDate = new Date(value)
              mappedRow.shipDate = parsedDate.toISOString()
              console.log(`[Batch Import] ✅ Converted to: ${mappedRow.shipDate} (${parsedDate.toLocaleDateString()})`)
            }
          }
          // Parse numbers
          else if (
            ['totalPackages', 'packageNumber', 'itemQuantity'].includes(systemField) &&
            value
          ) {
            mappedRow[systemField] = parseInt(value, 10)
          }
          // Parse floats
          else if (['weight', 'length', 'width', 'height'].includes(systemField) && value) {
            mappedRow[systemField] = parseFloat(value)
          }
          // ZIP code - pad with leading zeros for US addresses
          else if (systemField === 'shipToZip' && value) {
            const zipString = String(value).trim()
            // If it's a US address and ZIP is 4 digits, pad with leading zero
            // US ZIP codes are either 5 digits or 9 digits (ZIP+4 format: 12345-6789)
            const countryValue = row[columnMapping.shipToCountry]
            const country = countryValue ? String(countryValue).trim().toUpperCase() : 'US'

            if ((country === 'US' || country === 'USA' || !countryValue) && /^\d{4}$/.test(zipString)) {
              // Pad 4-digit ZIP to 5 digits
              mappedRow[systemField] = zipString.padStart(5, '0')
              console.log(`[Batch Import] ⚠️ Padded ZIP code: ${zipString} → ${mappedRow[systemField]}`)
            } else {
              mappedRow[systemField] = zipString
            }
          }
          // String fields - ensure they're actually strings
          else {
            mappedRow[systemField] = value != null ? String(value) : null
          }
        })

        return mappedRow
      })

      // Create batch import record
      const response = await fetch('/api/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          sheetName,
          rows: mappedRows,
          shippingConfig,
          columnMapping,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create batch import')
      }

      const result = await response.json()
      onStartProcessing(result.data.batchId)
    } catch (err: any) {
      setError(err.message || 'Failed to create batch import')
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Review & Start Processing</h2>
        <p className="text-gray-600">
          Review your import configuration before processing. Once started, labels will be created
          and shipments will be added to PACE.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
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

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-blue-600">{data.length}</div>
          <div className="text-sm text-blue-900 font-medium mt-1">Total Rows</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-600">{uniqueJobs}</div>
          <div className="text-sm text-green-900 font-medium mt-1">Unique Jobs</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-purple-600">{uniqueAddresses}</div>
          <div className="text-sm text-purple-900 font-medium mt-1">Shipments</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-amber-600">{data.length}</div>
          <div className="text-sm text-amber-900 font-medium mt-1">Labels</div>
        </div>
      </div>

      {/* File Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">File Information</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-600">File Name:</span>
            <span className="ml-2 font-medium text-gray-900">{fileName}</span>
          </div>
          {sheetName && (
            <div>
              <span className="text-gray-600">Sheet:</span>
              <span className="ml-2 font-medium text-gray-900">{sheetName}</span>
            </div>
          )}
          <div>
            <span className="text-gray-600">Total Rows:</span>
            <span className="ml-2 font-medium text-gray-900">{data.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Columns Mapped:</span>
            <span className="ml-2 font-medium text-gray-900">
              {Object.keys(columnMapping).length}
            </span>
          </div>
        </div>
      </div>

      {/* Shipping Config */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Shipping Configuration</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Carrier:</span>
            <span className="font-medium text-gray-900">{shippingConfig.carrier}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Service:</span>
            <span className="font-medium text-gray-900">{shippingConfig.service}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Billing:</span>
            <span className="font-medium text-gray-900">
              {shippingConfig.billToParty === 'sender' ? 'Sender' : 'Third Party'}
              {shippingConfig.billToParty === 'third_party' &&
                shippingConfig.billToAccount &&
                ` (${shippingConfig.billToAccount})`}
            </span>
          </div>
          {shippingConfig.containsAlcohol && (
            <div className="flex justify-between">
              <span className="text-gray-600">Special:</span>
              <span className="font-medium text-amber-700">Contains Alcohol</span>
            </div>
          )}
          {shippingConfig.saturdayDelivery && (
            <div className="flex justify-between">
              <span className="text-gray-600">Delivery:</span>
              <span className="font-medium text-blue-700">Saturday Delivery</span>
            </div>
          )}
          {shippingConfig.confirmation !== 'none' && (
            <div className="flex justify-between">
              <span className="text-gray-600">Confirmation:</span>
              <span className="font-medium text-gray-900">
                {shippingConfig.confirmation.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Sample Data Preview */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Sample Data (First 3 Rows)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="px-2 py-2 text-left font-semibold text-gray-700">Job#</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700">Ship To</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700">City, State</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700">Pkgs</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700">Item</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.slice(0, 3).map((row, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-2 text-gray-900 font-medium">
                    {row[columnMapping.jobNumber]}
                  </td>
                  <td className="px-2 py-2 text-gray-600">
                    {row[columnMapping.shipToName] || row[columnMapping.shipToCompany]}
                  </td>
                  <td className="px-2 py-2 text-gray-600">
                    {row[columnMapping.shipToCity]}, {row[columnMapping.shipToState]}
                  </td>
                  <td className="px-2 py-2 text-gray-600">
                    {row[columnMapping.packageNumber]}/{row[columnMapping.totalPackages]}
                  </td>
                  <td className="px-2 py-2 text-gray-600">{row[columnMapping.itemNumber]}</td>
                  <td className="px-2 py-2 text-gray-600">{row[columnMapping.itemQuantity]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warning Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h4 className="font-semibold text-amber-900 mb-1">Important</h4>
            <p className="text-sm text-amber-800">
              Once processing starts, shipping labels will be created via ShipStation and you will
              be charged for each label. JobShipments and Cartons will be created in PACE. Make
              sure all information is correct before proceeding.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          disabled={isCreating}
          className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium transition-colors"
        >
          Back
        </button>

        <button
          onClick={handleCreateBatch}
          disabled={isCreating}
          className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-colors shadow-lg flex items-center gap-2"
        >
          {isCreating ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Creating Batch...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
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
              Start Processing ({data.length} labels)
            </>
          )}
        </button>
      </div>
    </div>
  )
}

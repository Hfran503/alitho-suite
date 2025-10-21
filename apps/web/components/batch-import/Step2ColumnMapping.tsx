'use client'

import { useState, useEffect } from 'react'

interface Step2ColumnMappingProps {
  data: any[]
  onComplete: (mapping: Record<string, string>) => void
  onBack: () => void
}

// System fields that we need to map to
const SYSTEM_FIELDS = [
  { key: 'shipDate', label: 'Ship Date', required: true },
  { key: 'jobNumber', label: 'Job Number', required: true },
  { key: 'shipToName', label: 'Ship To Name', required: false },
  { key: 'shipToCompany', label: 'Ship To Company', required: false },
  { key: 'shipToAddress1', label: 'Ship To Address Line 1', required: true },
  { key: 'shipToAddress2', label: 'Ship To Address Line 2', required: false },
  { key: 'shipToCity', label: 'Ship To City', required: true },
  { key: 'shipToState', label: 'Ship To State', required: true },
  { key: 'shipToZip', label: 'Ship To ZIP Code', required: true },
  { key: 'shipToCountry', label: 'Ship To Country', required: false },
  { key: 'shipToPhone', label: 'Ship To Phone', required: false },
  { key: 'totalPackages', label: 'Total Packages', required: true },
  { key: 'packageNumber', label: 'Package Number', required: true },
  { key: 'weight', label: 'Package Weight (lbs)', required: true },
  { key: 'length', label: 'Dimensions - Length (in)', required: true },
  { key: 'width', label: 'Dimensions - Width (in)', required: true },
  { key: 'height', label: 'Dimensions - Height (in)', required: true },
  { key: 'reference1', label: 'Reference 1', required: false },
  { key: 'reference2', label: 'Reference 2', required: false },
  { key: 'reference3', label: 'Reference 3', required: false },
  { key: 'itemNumber', label: 'Item Number (JobProduct)', required: true },
  { key: 'itemQuantity', label: 'Item Quantity', required: true },
]

export function Step2ColumnMapping({ data, onComplete, onBack }: Step2ColumnMappingProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<string[]>([])
  const [csvColumns, setCsvColumns] = useState<string[]>([])

  useEffect(() => {
    if (data.length > 0) {
      // Get column names from first row
      const columns = Object.keys(data[0])
      setCsvColumns(columns)

      // Auto-map columns based on name similarity
      const autoMapping = autoMapColumns(columns)
      setMapping(autoMapping)
    }
  }, [data])

  // Auto-mapping logic based on column name similarity
  const autoMapColumns = (columns: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {}

    const fieldPatterns: Record<string, string[]> = {
      shipDate: ['shipdate', 'ship date', 'date'],
      jobNumber: ['job#', 'job number', 'job', 'jobnumber'],
      shipToName: ['shiptoname', 'ship to name', 'name', 'recipient name'],
      shipToCompany: ['shiptocompany', 'ship to company', 'company', 'companyname'],
      shipToAddress1: ['shiptoaddressline1', 'ship to address', 'address1', 'address', 'street1'],
      shipToAddress2: ['shiptoaddressline2', 'address2', 'street2'],
      shipToCity: ['shiptocity', 'ship to city', 'city'],
      shipToState: ['shiptostate', 'ship to state', 'state'],
      shipToZip: ['shiptozipcode', 'ship to zip', 'zip', 'zipcode', 'postal code'],
      shipToCountry: ['shiptocountry', 'ship to country', 'country'],
      shipToPhone: ['shiptophoneno', 'ship to phone', 'phone', 'phonenumber'],
      totalPackages: ['totalpackages', 'total packages', 'total pkgs'],
      packageNumber: ['packagenumber', 'package number', 'pkg number', 'carton number'],
      weight: ['packageweight', 'package weight', 'weight'],
      length: ['dimensionsl', 'dimensions l', 'length', 'l'],
      width: ['dimensionsw', 'dimensions w', 'width', 'w'],
      height: ['dimensionsh', 'dimensions h', 'height', 'h'],
      reference1: ['reference1', 'ref1', 'reference 1'],
      reference2: ['reference2', 'ref2', 'reference 2'],
      reference3: ['reference3', 'ref3', 'reference 3'],
      itemQuantity: ['itemquantity', 'item quantity', 'quantity', 'qty'],
      itemNumber: ['itemnumber', 'item number', 'itemno', 'item#', 'itemnbr', 'product', 'sku', 'productid', 'jobproduct'],
    }

    columns.forEach((column) => {
      const normalized = column.toLowerCase().trim().replace(/[_\s-]/g, '')

      let bestMatch: { field: string; score: number } | null = null
      let foundExactMatch = false

      // First pass: Look for exact matches (highest priority)
      for (const [systemField, patterns] of Object.entries(fieldPatterns)) {
        for (const pattern of patterns) {
          const patternNormalized = pattern.replace(/[_\s-]/g, '')

          if (normalized === patternNormalized) {
            // Exact match - immediately assign and stop searching
            mapping[systemField] = column
            foundExactMatch = true
            break
          }
        }
        if (foundExactMatch) break
      }

      // If no exact match found, look for partial matches
      if (!foundExactMatch) {
        for (const [systemField, patterns] of Object.entries(fieldPatterns)) {
          for (const pattern of patterns) {
            const patternNormalized = pattern.replace(/[_\s-]/g, '')

            if (normalized.includes(patternNormalized)) {
              // Score by pattern length (longer patterns are more specific)
              const score = patternNormalized.length
              if (!bestMatch || score > bestMatch.score) {
                bestMatch = { field: systemField, score }
              }
            }
          }
        }

        if (bestMatch) {
          mapping[bestMatch.field] = column
        }
      }
    })

    return mapping
  }

  const handleMappingChange = (systemField: string, csvColumn: string) => {
    setMapping((prev) => ({
      ...prev,
      [systemField]: csvColumn,
    }))
    setErrors([])
  }

  const validateMapping = (): boolean => {
    const newErrors: string[] = []

    // Check all required fields are mapped
    const requiredFields = SYSTEM_FIELDS.filter((f) => f.required)
    for (const field of requiredFields) {
      if (!mapping[field.key] || mapping[field.key] === '') {
        newErrors.push(`${field.label} is required but not mapped`)
      }
    }

    // Check for duplicate mappings
    const mappedValues = Object.values(mapping).filter((v) => v !== '')
    const duplicates = mappedValues.filter(
      (value, index) => mappedValues.indexOf(value) !== index
    )
    if (duplicates.length > 0) {
      newErrors.push(`Duplicate mappings found: ${duplicates.join(', ')}`)
    }

    setErrors(newErrors)
    return newErrors.length === 0
  }

  const handleContinue = () => {
    if (validateMapping()) {
      // Filter out empty mappings
      const cleanMapping = Object.entries(mapping)
        .filter(([_, value]) => value !== '')
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})

      onComplete(cleanMapping)
    }
  }

  const handleSaveMapping = async () => {
    // TODO: Implement save mapping template
    alert('Save mapping template feature coming soon!')
  }

  // Preview mapped data
  const previewData = data.slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Map Columns</h2>
        <p className="text-gray-600">
          Match your file columns to the system fields. Auto-mapping has been applied based on
          column names.
        </p>
      </div>

      {errors.length > 0 && (
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
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800 mb-1">
                Please fix the following errors:
              </p>
              <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                {errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Mapping Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  System Field
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Your Column
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Sample Data
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {SYSTEM_FIELDS.map((field) => (
                <tr key={field.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{field.label}</span>
                      {field.required && (
                        <span className="text-xs text-red-600 font-semibold">*</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={mapping[field.key] || ''}
                      onChange={(e) => handleMappingChange(field.key, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        field.required && !mapping[field.key]
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    >
                      <option value="">-- Not Mapped --</option>
                      {csvColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {mapping[field.key] && previewData.length > 0 ? (
                      <div className="text-xs text-gray-600 max-w-xs truncate">
                        {previewData[0][mapping[field.key]]}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          Data Preview (First 5 rows)
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-gray-300">
                {SYSTEM_FIELDS.filter((f) => mapping[f.key]).map((field) => (
                  <th key={field.key} className="px-2 py-2 text-left font-semibold text-gray-700">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {previewData.map((row, idx) => (
                <tr key={idx}>
                  {SYSTEM_FIELDS.filter((f) => mapping[f.key]).map((field) => (
                    <td key={field.key} className="px-2 py-2 text-gray-600">
                      {row[mapping[field.key]] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
        >
          Back
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveMapping}
            className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Save Mapping Template
          </button>
          <button
            onClick={handleContinue}
            className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

interface Step1UploadProps {
  onComplete: (fileName: string, sheetName: string | null, data: any[]) => void
}

// Helper function to convert Excel serial date to JavaScript Date
function excelSerialToDate(serial: number): Date {
  // Excel dates are days since 1900-01-01 (with a leap year bug for 1900)
  // JavaScript dates are milliseconds since 1970-01-01
  const excelEpoch = new Date(1899, 11, 30) // December 30, 1899
  const daysOffset = serial
  const date = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000)
  return date
}

// Helper function to detect if a value looks like an Excel date serial number
function isExcelDateSerial(value: any): boolean {
  // Excel date serials are typically numbers between 1 (1900-01-01) and ~50000 (2036+)
  return typeof value === 'number' && value > 1 && value < 100000 && Number.isInteger(value)
}

// Helper function to format date as MM/DD/YY
function formatDate(date: Date): string {
  const year = String(date.getFullYear()).slice(-2) // Get last 2 digits of year
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}/${day}/${year}`
}

// Convert Excel date serials in parsed data
function convertExcelDates(data: any[]): any[] {
  return data.map(row => {
    const newRow: any = {}
    for (const [key, value] of Object.entries(row)) {
      // Check if this looks like a date field and has a serial number
      const isDateField = key.toLowerCase().includes('date') || key.toLowerCase().includes('ship')
      if (isDateField && isExcelDateSerial(value)) {
        const date = excelSerialToDate(value as number)
        newRow[key] = formatDate(date)
      } else {
        newRow[key] = value
      }
    }
    return newRow
  })
}

export function Step1Upload({ onComplete }: Step1UploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [selectedSheet, setSelectedSheet] = useState('')
  const [availableSheets, setAvailableSheets] = useState<string[]>([])
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleFile = async (file: File) => {
    setError('')
    setIsProcessing(true)

    try {
      const extension = file.name.split('.').pop()?.toLowerCase()

      if (extension === 'csv') {
        // Parse CSV
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              setError(`CSV parsing errors: ${results.errors[0].message}`)
              setIsProcessing(false)
              return
            }

            if (results.data.length === 0) {
              setError('CSV file is empty')
              setIsProcessing(false)
              return
            }

            if (results.data.length > 2000) {
              setError('CSV file has more than 2000 rows. Please split into smaller batches.')
              setIsProcessing(false)
              return
            }

            onComplete(file.name, null, results.data as any[])
            setIsProcessing(false)
          },
          error: (error) => {
            setError(`Failed to parse CSV: ${error.message}`)
            setIsProcessing(false)
          },
        })
      } else if (extension === 'xlsx' || extension === 'xls') {
        // Parse Excel
        const reader = new FileReader()

        reader.onload = (e) => {
          try {
            const data = e.target?.result
            const workbook = XLSX.read(data, { type: 'binary' })

            // If multiple sheets, let user select
            if (workbook.SheetNames.length > 1) {
              setAvailableSheets(workbook.SheetNames)
              setExcelFile(file)
              setIsProcessing(false)
              return
            }

            // Single sheet - process immediately
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet)

            if (jsonData.length === 0) {
              setError('Excel sheet is empty')
              setIsProcessing(false)
              return
            }

            if (jsonData.length > 2000) {
              setError('Excel file has more than 2000 rows. Please split into smaller batches.')
              setIsProcessing(false)
              return
            }

            // Convert Excel date serial numbers to proper dates
            const convertedData = convertExcelDates(jsonData)

            onComplete(file.name, sheetName, convertedData)
            setIsProcessing(false)
          } catch (err: any) {
            setError(`Failed to parse Excel: ${err.message}`)
            setIsProcessing(false)
          }
        }

        reader.onerror = () => {
          setError('Failed to read Excel file')
          setIsProcessing(false)
        }

        reader.readAsBinaryString(file)
      } else {
        setError('Please upload a CSV or Excel file (.csv, .xlsx, .xls)')
        setIsProcessing(false)
      }
    } catch (err: any) {
      setError(`Error processing file: ${err.message}`)
      setIsProcessing(false)
    }
  }

  const handleSheetSelection = () => {
    if (!excelFile || !selectedSheet) return

    setIsProcessing(true)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const worksheet = workbook.Sheets[selectedSheet]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        if (jsonData.length === 0) {
          setError('Selected sheet is empty')
          setIsProcessing(false)
          return
        }

        if (jsonData.length > 2000) {
          setError('Selected sheet has more than 2000 rows. Please split into smaller batches.')
          setIsProcessing(false)
          return
        }

        // Convert Excel date serial numbers to proper dates
        const convertedData = convertExcelDates(jsonData)

        onComplete(excelFile.name, selectedSheet, convertedData)
        setIsProcessing(false)
      } catch (err: any) {
        setError(`Failed to parse sheet: ${err.message}`)
        setIsProcessing(false)
      }
    }

    reader.readAsBinaryString(excelFile)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Upload Your File</h2>
        <p className="text-gray-600">
          Upload a CSV or Excel file containing your shipment data (max 2000 rows per batch)
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

      {/* Sheet Selection (for multi-sheet Excel files) */}
      {availableSheets.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Select Sheet to Import
          </h3>
          <div className="space-y-3">
            {availableSheets.map((sheet) => (
              <label
                key={sheet}
                className="flex items-center gap-3 p-3 bg-white border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors"
              >
                <input
                  type="radio"
                  name="sheet"
                  value={sheet}
                  checked={selectedSheet === sheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="font-medium text-gray-900">{sheet}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleSheetSelection}
            disabled={!selectedSheet || isProcessing}
            className="mt-4 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isProcessing ? 'Processing...' : 'Continue with Selected Sheet'}
          </button>
        </div>
      )}

      {/* File Upload Area */}
      {availableSheets.length === 0 && (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />

          {isProcessing ? (
            <div className="space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600">Processing file...</p>
            </div>
          ) : (
            <>
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Drop your file here or click to browse
              </h3>
              <p className="text-gray-600 mb-2">
                Supported formats: CSV, Excel (.xlsx, .xls)
              </p>
              <p className="text-sm text-gray-500">Maximum 2000 rows per batch</p>
            </>
          )}
        </div>
      )}

      {/* File Format Help */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
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
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Expected File Format
        </h4>
        <p className="text-sm text-gray-600 mb-2">
          Your file should include these columns (in any order):
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 mb-3">
          <div>• Position (optional)</div>
          <div>• ShipDate</div>
          <div>• Job#</div>
          <div>• ShipToName</div>
          <div>• ShipToAddressline1</div>
          <div>• ShipToCity</div>
          <div>• ShipToState</div>
          <div>• ShipToZipCode</div>
          <div>• ShipToCountry</div>
          <div>• TotalPackages</div>
          <div>• PackageNumber</div>
          <div>• PackageWeight</div>
          <div>• DimensionsL/W/H</div>
          <div>• ItemNumber</div>
          <div>• ItemQuantity</div>
          <div>• Reference1/2/3 (optional)</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2">
          <p className="text-xs text-blue-800">
            <strong>💡 Tip:</strong> Use the <strong>Position</strong> column to control grouping.
            Rows with the same Position + Name + Address will be grouped as one multi-package shipment.
            Different people at the same address should have different Positions.
          </p>
        </div>
      </div>
    </div>
  )
}

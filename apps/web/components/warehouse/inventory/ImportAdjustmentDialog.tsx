'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

interface ImportResult {
  row: number
  sku: string
  status: 'success' | 'error'
  message?: string
  adjustment?: { previous: number; new: number }
}

interface ImportSummary {
  total: number
  success: number
  errors: number
}

interface ImportAdjustmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete: () => void
}

export function ImportAdjustmentDialog({ open, onOpenChange, onImportComplete }: ImportAdjustmentDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [results, setResults] = useState<ImportResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setError(null)
      setSummary(null)
      setResults([])
    }
  }

  const handleDownloadTemplate = () => {
    window.location.href = '/api/warehouse/inventory/import'
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/warehouse/inventory/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setSummary(data.summary)
      setResults(data.results || [])

      if (data.summary.success > 0) {
        onImportComplete()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setSummary(null)
    setResults([])
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onOpenChange(false)
  }

  const errorResults = results.filter((r) => r.status === 'error')
  const successResults = results.filter((r) => r.status === 'success')

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Stock Adjustments from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk adjust inventory quantities. Use this for stock corrections or initial setup.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Template Download */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">CSV Template</p>
                <p className="text-sm text-gray-600">Download a template with the correct columns</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Template
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm font-medium text-blue-900 mb-1">CSV Columns</p>
            <p className="text-xs text-blue-700">
              SKU, Location Barcode, Quantity, Type, Lot Number, <strong>Reference Number (PO#)</strong>, Notes
            </p>
            <div className="mt-2 text-xs text-blue-700">
              <p className="font-medium">Type options:</p>
              <ul className="list-disc list-inside ml-2">
                <li><strong>SET</strong> - Set stock to this exact quantity</li>
                <li><strong>ADD</strong> - Add quantity to current stock</li>
                <li><strong>REMOVE</strong> - Subtract quantity from current stock</li>
              </ul>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Note: Reference Number is required for items with "Track by Reference" enabled
            </p>
          </div>

          {/* File Upload */}
          <div>
            <Label htmlFor="file">Select CSV File</Label>
            <div className="mt-1">
              <input
                ref={fileInputRef}
                type="file"
                id="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded file:border-0
                  file:text-sm file:font-medium
                  file:bg-emerald-50 file:text-emerald-700
                  hover:file:bg-emerald-100
                  cursor-pointer"
              />
            </div>
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Warning:</strong> Stock adjustments are immediate and cannot be undone.
              Please verify your CSV data before importing.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Results Summary */}
          {summary && (
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3">Import Results</h4>
              <div className="grid grid-cols-3 gap-4 text-center mb-4">
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
                  <div className="text-xs text-gray-600">Total Rows</div>
                </div>
                <div className="bg-emerald-50 rounded p-2">
                  <div className="text-2xl font-bold text-emerald-600">{summary.success}</div>
                  <div className="text-xs text-gray-600">Success</div>
                </div>
                <div className="bg-red-50 rounded p-2">
                  <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
                  <div className="text-xs text-gray-600">Errors</div>
                </div>
              </div>

              {/* Success Details */}
              {successResults.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-emerald-700 mb-2">Adjustments Applied ({successResults.length})</h5>
                  <div className="max-h-32 overflow-y-auto border border-emerald-200 rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-emerald-50">
                        <tr>
                          <th className="px-2 py-1 text-left">Row</th>
                          <th className="px-2 py-1 text-left">SKU</th>
                          <th className="px-2 py-1 text-right">Previous</th>
                          <th className="px-2 py-1 text-right">New</th>
                        </tr>
                      </thead>
                      <tbody>
                        {successResults.slice(0, 20).map((r, i) => (
                          <tr key={i} className="border-t border-emerald-100">
                            <td className="px-2 py-1">{r.row}</td>
                            <td className="px-2 py-1 font-mono">{r.sku}</td>
                            <td className="px-2 py-1 text-right text-gray-500">{r.adjustment?.previous}</td>
                            <td className="px-2 py-1 text-right font-medium text-emerald-600">{r.adjustment?.new}</td>
                          </tr>
                        ))}
                        {successResults.length > 20 && (
                          <tr className="border-t border-emerald-100">
                            <td colSpan={4} className="px-2 py-1 text-center text-gray-500">
                              ... and {successResults.length - 20} more
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Error Details */}
              {errorResults.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-red-700 mb-2">Errors ({errorResults.length})</h5>
                  <div className="max-h-40 overflow-y-auto border border-red-200 rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-red-50">
                        <tr>
                          <th className="px-2 py-1 text-left">Row</th>
                          <th className="px-2 py-1 text-left">SKU</th>
                          <th className="px-2 py-1 text-left">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errorResults.map((r, i) => (
                          <tr key={i} className="border-t border-red-100">
                            <td className="px-2 py-1">{r.row}</td>
                            <td className="px-2 py-1 font-mono">{r.sku}</td>
                            <td className="px-2 py-1 text-red-600">{r.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            {summary ? 'Close' : 'Cancel'}
          </Button>
          {!summary && (
            <Button
              onClick={handleImport}
              disabled={!file || importing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {importing ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Importing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import Adjustments
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

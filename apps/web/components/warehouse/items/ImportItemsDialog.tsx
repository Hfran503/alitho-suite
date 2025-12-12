'use client'

import { useState, useRef, useEffect } from 'react'
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
import { DEFAULT_ITEM_CATEGORIES } from '@/lib/warehouse/constants'

interface ImportResult {
  row: number
  sku: string
  status: 'created' | 'updated' | 'error'
  message?: string
}

interface ImportSummary {
  total: number
  created: number
  updated: number
  errors: number
}

interface ImportItemsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete: () => void
}

export function ImportItemsDialog({ open, onOpenChange, onImportComplete }: ImportItemsDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [updateExisting, setUpdateExisting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [results, setResults] = useState<ImportResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[]>([])

  // Fetch available categories when dialog opens
  // Merge default categories with any existing ones from the database
  useEffect(() => {
    if (open) {
      fetch('/api/warehouse/items?limit=1')
        .then((res) => res.json())
        .then((data) => {
          const existingCategories = data.filters?.categories || []
          // Merge defaults with existing, remove duplicates
          const allCategories = [...new Set([...DEFAULT_ITEM_CATEGORIES, ...existingCategories])]
          setCategories(allCategories)
        })
        .catch(() => {
          // On error, just show defaults
          setCategories(DEFAULT_ITEM_CATEGORIES)
        })
    }
  }, [open])

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
    window.location.href = '/api/warehouse/items/import'
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('updateExisting', updateExisting.toString())

      const response = await fetch('/api/warehouse/items/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setSummary(data.summary)
      setResults(data.results || [])

      if (data.summary.created > 0 || data.summary.updated > 0) {
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
    setUpdateExisting(false)
    setSummary(null)
    setResults([])
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onOpenChange(false)
  }

  const errorResults = results.filter((r) => r.status === 'error')

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Items from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import inventory items. Download the template to see the expected format.
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

          {/* Update Option */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="updateExisting"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <Label htmlFor="updateExisting" className="text-sm font-normal">
              Update existing items if SKU already exists
            </Label>
          </div>

          {/* Available Categories */}
          {categories.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-900 mb-1">Available Categories</p>
              <p className="text-xs text-blue-700">
                Use these values in the Category column: {categories.join(', ')}
              </p>
            </div>
          )}

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
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
                  <div className="text-xs text-gray-600">Total Rows</div>
                </div>
                <div className="bg-emerald-50 rounded p-2">
                  <div className="text-2xl font-bold text-emerald-600">{summary.created}</div>
                  <div className="text-xs text-gray-600">Created</div>
                </div>
                <div className="bg-blue-50 rounded p-2">
                  <div className="text-2xl font-bold text-blue-600">{summary.updated}</div>
                  <div className="text-xs text-gray-600">Updated</div>
                </div>
                <div className="bg-red-50 rounded p-2">
                  <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
                  <div className="text-xs text-gray-600">Errors</div>
                </div>
              </div>

              {/* Error Details */}
              {errorResults.length > 0 && (
                <div className="mt-4">
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
                  Import Items
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

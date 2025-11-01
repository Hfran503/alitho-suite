'use client'

import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'

interface Upload {
  id: string
  filename: string
  originalFilename: string
  fileSize: number
  status: string
  errorMessage?: string
  metadata?: any
  createdAt: string
  sentToSwitchAt?: string
}

export default function SwitchUploadPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [jobNumber, setJobNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch upload history
  const fetchUploads = async () => {
    try {
      const response = await fetch('/api/switch/uploads')
      const data = await response.json()
      if (data.success) {
        setUploads(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch uploads:', err)
    }
  }

  useEffect(() => {
    fetchUploads()
  }, [])

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
    setSuccess('')

    // Validate file type
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed')
      return
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Add metadata if provided
      const metadata: any = {}
      if (jobNumber) metadata.jobNumber = jobNumber
      if (customerName) metadata.customerName = customerName
      if (Object.keys(metadata).length > 0) {
        formData.append('metadata', JSON.stringify(metadata))
      }

      const response = await fetch('/api/switch/upload-pdf', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Upload failed')
      }

      setSuccess(`File "${file.name}" uploaded successfully!`)
      setJobNumber('')
      setCustomerName('')

      // Refresh uploads list
      await fetchUploads()

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRetry = async (uploadId: string) => {
    try {
      const response = await fetch(`/api/switch/uploads/${uploadId}/retry`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Retry failed')
      }

      setSuccess('File resent to Switch successfully!')
      await fetchUploads()
    } catch (err: any) {
      setError(err.message || 'Failed to retry upload')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-gray-100 text-gray-800',
      uploading: 'bg-blue-100 text-blue-800',
      sent: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    }
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <div className="w-full px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Upload PDFs to Enfocus Switch
        </h1>
        <p className="text-gray-600">
          Upload PDF files to be automatically processed by Enfocus Switch workflow
        </p>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
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

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-green-800">{success}</p>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        {/* Optional Metadata Fields */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Number (Optional)
            </label>
            <input
              type="text"
              value={jobNumber}
              onChange={(e) => setJobNumber(e.target.value)}
              placeholder="Enter job number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Name (Optional)
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* File Upload Area */}
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
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          {isUploading ? (
            <div className="space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600">Uploading and sending to Switch...</p>
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
                Drop your PDF here or click to browse
              </h3>
              <p className="text-gray-600 mb-2">PDF files only</p>
              <p className="text-sm text-gray-500">Maximum file size: 50MB</p>
            </>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-blue-600"
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
            How it works
          </h4>
          <ul className="text-sm text-gray-700 space-y-1 ml-7">
            <li>• Upload a PDF file using drag & drop or file browser</li>
            <li>• File is automatically stored in S3 for backup</li>
            <li>• File is immediately sent to Enfocus Switch for processing</li>
            <li>• View upload history and status below</li>
          </ul>
        </div>
      </div>

      {/* Upload History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Upload History</h2>

        {uploads.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No uploads yet. Upload your first PDF above!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Filename
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Size
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Uploaded
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Sent to Switch
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((upload) => (
                  <tr key={upload.id} className="border-b border-gray-100">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">
                        {upload.originalFilename}
                      </div>
                      {upload.metadata && (
                        <div className="text-xs text-gray-500 mt-1">
                          {upload.metadata.jobNumber && (
                            <span>Job: {upload.metadata.jobNumber} </span>
                          )}
                          {upload.metadata.customerName && (
                            <span>Customer: {upload.metadata.customerName}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {formatFileSize(upload.fileSize)}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(upload.status)}</td>
                    <td className="py-3 px-4 text-gray-600 text-sm">
                      {format(new Date(upload.createdAt), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm">
                      {upload.sentToSwitchAt
                        ? format(new Date(upload.sentToSwitchAt), 'MMM d, yyyy HH:mm')
                        : '-'}
                    </td>
                    <td className="py-3 px-4">
                      {upload.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(upload.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Retry
                        </button>
                      )}
                      {upload.errorMessage && (
                        <div className="text-xs text-red-600 mt-1">
                          {upload.errorMessage}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

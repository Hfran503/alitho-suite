'use client'

import { useState } from 'react'

/**
 * Component to generate Atlassian welcome PDFs
 * Replaces {name} in the template with an actual name
 */
export function AtlassianWelcome() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleGenerate = async () => {
    if (!name.trim()) {
      setError('Please enter a name')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Use overlay method directly since the PDF doesn't have form fields
      await generateWithOverlay(name)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate PDF'
      )
    } finally {
      setLoading(false)
    }
  }

  const generateWithOverlay = async (personName: string) => {
    // Calculate font size (simple auto-scaling)
    const baseSize = 45
    const maxWidth = 456 * 0.95 // 95% of rectangle width (456 pts from calibration)
    const estimatedWidth = personName.length * (baseSize * 0.6) // Rough estimate
    const fontSize = estimatedWidth > maxWidth ? Math.floor((maxWidth / estimatedWidth) * baseSize) : baseSize

    // Use calibrated position from adjust-pdf tool
    // Rectangle: X=6, Y=120, Width=456, Height=83
    const response = await fetch('/api/pdf/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateUrl: '/templates/Atlassian_Welcome_Kit.pdf',
        method: 'overlay',
        fontUrl: '/fonts/CharlieDisplay-Regular.otf',
        data: {},
        overlays: [
          {
            text: personName,
            x: 234, // Center X from calibration
            y: 162, // Center Y from calibration
            fontSize: fontSize,
            color: { c: 0, m: 0, y: 0, k: 1 }, // CMYK black
            align: 'center',
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to generate PDF')
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `atlassian-welcome-${personName.toLowerCase().replace(/\s+/g, '-')}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handlePreview = async () => {
    if (!name.trim()) {
      setError('Please enter a name')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Calculate font size (simple auto-scaling)
      const baseSize = 45
      const maxWidth = 456 * 0.95 // 95% of rectangle width (456 pts from calibration)
      const estimatedWidth = name.length * (baseSize * 0.6)
      const fontSize = estimatedWidth > maxWidth ? Math.floor((maxWidth / estimatedWidth) * baseSize) : baseSize

      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateUrl: '/templates/Atlassian_Welcome_Kit.pdf',
          method: 'overlay',
          fontUrl: '/fonts/CharlieDisplay-Regular.otf',
          data: {},
          overlays: [
            {
              text: name,
              x: 234, // Center X from calibration
              y: 162, // Center Y from calibration
              fontSize: fontSize,
              color: { c: 0, m: 0, y: 0, k: 1 }, // CMYK black
              align: 'center',
            },
          ],
        }),
      })

      if (!response.ok) throw new Error('Failed to generate preview')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Atlassian Welcome Generator</h2>
      <p className="text-gray-600 mb-6">
        Generate a personalized welcome PDF with the name centered on the certificate
        using CharlieDisplay font (auto-scaled to fit).
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Enter Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="e.g., Alex"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            Name will be centered at (234, 162) with 45px CharlieDisplay font
            (auto-scales if too long)
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            PDF generated successfully!
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading || !name.trim()}
            className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Generating...' : 'Download PDF'}
          </button>

          <button
            onClick={handlePreview}
            disabled={loading || !name.trim()}
            className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Preview
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
          <p className="font-semibold mb-1">Settings:</p>
          <ul className="text-gray-700 space-y-1 text-xs">
            <li>• Font: CharlieDisplay Regular (45px base)</li>
            <li>• Position: Centered at (234, 162)</li>
            <li>• Rectangle: 456 × 83 pts</li>
            <li>• Auto-scales for longer names</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

/**
 * Simple inline version for quick use
 */
export function QuickAtlassianWelcome() {
  const [name, setName] = useState('')

  const generate = async () => {
    if (!name) return

    // Calculate font size (simple auto-scaling)
    const baseSize = 45
    const maxWidth = 456 * 0.95 // 95% of rectangle width (456 pts from calibration)
    const estimatedWidth = name.length * (baseSize * 0.6)
    const fontSize = estimatedWidth > maxWidth ? Math.floor((maxWidth / estimatedWidth) * baseSize) : baseSize

    const response = await fetch('/api/pdf/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateUrl: '/templates/Atlassian_Welcome_Kit.pdf',
        method: 'overlay',
        fontUrl: '/fonts/CharlieDisplay-Regular.otf',
        data: {},
        overlays: [
          {
            text: name,
            x: 234, // Center X from calibration
            y: 162, // Center Y from calibration
            fontSize: fontSize,
            color: { c: 0, m: 0, y: 0, k: 1 }, // CMYK black
            align: 'center',
          },
        ],
      }),
    })

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `welcome-${name}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter name"
        className="px-3 py-2 border rounded"
      />
      <button
        onClick={generate}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Generate
      </button>
    </div>
  )
}

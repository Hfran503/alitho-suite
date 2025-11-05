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
    // Use the PDF with form field
    const response = await fetch('/api/pdf/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateUrl: '/templates/Atlassian_Template_WithFormField.pdf',
        method: 'form',
        data: {
          name: personName,
        },
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
      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateUrl: '/templates/Atlassian_Template_WithFormField.pdf',
          method: 'form',
          data: { name },
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
        Generate a personalized welcome PDF. The template will replace {'{name}'}{' '}
        with the actual name.
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
            This will replace {'{name}'} in &quot;Welcome to the team, {'{name}'}
            !&quot;
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
          <p className="font-semibold mb-1">Example:</p>
          <p className="text-gray-700">
            Input: &quot;Alex&quot; → Output: &quot;Welcome to the team, Alex!&quot;
          </p>
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

    const response = await fetch('/api/pdf/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateUrl: '/templates/Atlassian_Template_WithFormField.pdf',
        method: 'form',
        data: { name },
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

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SearchBar() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) return

    setSearching(true)
    setError('')

    try {
      // Check if query is a number (CL# / PACE Shipment ID)
      const shipmentId = parseInt(query.trim())

      if (!isNaN(shipmentId)) {
        // Search for shipment by CL#
        const response = await fetch(`/api/pace/shipments/${shipmentId}`)

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            // Navigate to shipment detail page
            router.push(`/shipments/${shipmentId}`)
            setQuery('')
            setIsOpen(false)
            return
          }
        } else if (response.status === 404) {
          setError(`Shipment CL# ${shipmentId} not found`)
        } else {
          setError('Error searching for shipment')
        }
      } else {
        // In the future, add more search types here
        setError('Please enter a valid CL# (shipment number)')
      }
    } catch (err) {
      console.error('Search error:', err)
      setError('Search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="relative">
      {/* Search Button (Mobile) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      {/* Search Input (Desktop) */}
      <form onSubmit={handleSubmit} className="hidden md:block">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {searching ? (
              <svg className="animate-spin w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setError('')
            }}
            placeholder="Search by CL#..."
            disabled={searching}
            className="block w-80 pl-10 pr-3 py-2 border border-gray-700 rounded-lg leading-5 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
          />
          {query && !searching && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setError('')
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <svg className="w-4 h-4 text-gray-500 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {error && (
          <div className="absolute top-full mt-2 w-80 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}
      </form>

      {/* Mobile Search Overlay */}
      {isOpen && (
        <div className="md:hidden absolute top-12 right-0 w-screen max-w-sm bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setError('')
                }}
                placeholder="Search by CL#..."
                disabled={searching}
                className="block w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  setQuery('')
                  setError('')
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {error && (
              <div className="mt-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  )
}

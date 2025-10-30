'use client'

import { use, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Step5Processing } from '@/components/batch-import/Step5Processing'

function BatchContent({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => router.push('/batch-import/batches')}
          className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-4"
        >
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to All Batches
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Batch Import Details</h1>
        <p className="text-gray-600 mt-1">Monitor progress and manage this batch</p>
      </div>

      <Step5Processing batchId={id} />
    </div>
  )
}

export default function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <BatchContent params={params} />
    </Suspense>
  )
}

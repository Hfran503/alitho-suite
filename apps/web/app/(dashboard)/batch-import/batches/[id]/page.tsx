'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { Step5Processing } from '@/components/batch-import/Step5Processing'

export default function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
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

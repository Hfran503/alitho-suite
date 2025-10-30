'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertCircle } from 'lucide-react'

export default function CreateEstimateDebugPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugData, setDebugData] = useState<any>(null)

  const createEstimate = async () => {
    setLoading(true)
    setError(null)
    setDebugData(null)

    try {
      const response = await fetch('/api/pace/estimates/create-debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer: '00001005',
          salesPerson: 19,
          estimator: 5043,
          description: 'Calitho Suite Estimate Test',
          parts: [
            {
              jobProductTypeId: 'C2',
              description: 'EQ - Carton | Diecut/Score/Glue',
              quantity: 10000,
            }
          ],
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to get debug data')
      }

      setDebugData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Estimate Creation - Debug View</h1>
        <p className="text-muted-foreground mt-1">
          View all data being sent to PACE API
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-900">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Estimate Creation</CardTitle>
          <CardDescription>
            Click the button to simulate estimate creation and view all API payloads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={createEstimate} disabled={loading}>
            {loading ? 'Generating Debug Data...' : 'Generate Debug Data'}
          </Button>
        </CardContent>
      </Card>

      {debugData && (
        <div className="space-y-6">
          {/* Step 1: Estimate Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Step 1: Create Estimate
              </CardTitle>
              <CardDescription>
                POST /CreateObject/createEstimate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(debugData.step1_estimateData, null, 2)}
              </pre>
            </CardContent>
          </Card>

          {/* Step 2: Estimate Part Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Step 2: Create Estimate Part
              </CardTitle>
              <CardDescription>
                POST /CreateObject/createEstimatePart
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(debugData.step2_estimatePartData, null, 2)}
              </pre>
            </CardContent>
          </Card>

          {/* Step 3: Estimate Quantity Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Step 3: Create Estimate Quantity
              </CardTitle>
              <CardDescription>
                POST /CreateObject/createEstimateQuantity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(debugData.step3_estimateQuantityData, null, 2)}
              </pre>
            </CardContent>
          </Card>

          {/* Step 4: Estimate Paper Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Step 4: Create Estimate Paper
              </CardTitle>
              <CardDescription>
                POST /CreateObject/createEstimatePaper
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(debugData.step4_estimatePaperData, null, 2)}
              </pre>
            </CardContent>
          </Card>

          {/* Step 5: Estimate Press Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Step 5: Create Estimate Press
              </CardTitle>
              <CardDescription>
                POST /CreateObject/createEstimatePress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(debugData.step5_estimatePressData, null, 2)}
              </pre>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-blue-700">Customer:</span>
                  <span className="ml-2 text-blue-900">{debugData.step1_estimateData.customer}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Estimate Number:</span>
                  <span className="ml-2 text-blue-900">{debugData.step1_estimateData.estimateNumber}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Sales Person:</span>
                  <span className="ml-2 text-blue-900">{debugData.step1_estimateData.salesPerson}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Estimator:</span>
                  <span className="ml-2 text-blue-900">{debugData.step1_estimateData.estimator}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Job Product Type:</span>
                  <span className="ml-2 text-blue-900">{debugData.step2_estimatePartData.jobProductType}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Quantity:</span>
                  <span className="ml-2 text-blue-900">{debugData.step3_estimateQuantityData.quantityOrdered?.toLocaleString()}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Paper Inventory Item:</span>
                  <span className="ml-2 text-blue-900">{debugData.step4_estimatePaperData.inventoryItem}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Press:</span>
                  <span className="ml-2 text-blue-900">{debugData.step5_estimatePressData.press}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Press Forced:</span>
                  <span className="ml-2 text-blue-900">{debugData.step5_estimatePressData.pressForced ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

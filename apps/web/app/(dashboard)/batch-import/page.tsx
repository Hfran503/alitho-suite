'use client'

import { useState } from 'react'
import { Step1Upload } from '@/components/batch-import/Step1Upload'
import { Step2ColumnMapping } from '@/components/batch-import/Step2ColumnMapping'
import { Step3ShippingConfig } from '@/components/batch-import/Step3ShippingConfig'
import { Step4Review } from '@/components/batch-import/Step4Review'
import { Step5Processing } from '@/components/batch-import/Step5Processing'

type Step = 1 | 2 | 3 | 4 | 5

export default function BatchImportPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [fileName, setFileName] = useState('')
  const [sheetName, setSheetName] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<any[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [shippingConfig, setShippingConfig] = useState<any>(null)
  const [batchId, setBatchId] = useState<string | null>(null)

  const handleFileUpload = (name: string, sheet: string | null, data: any[]) => {
    setFileName(name)
    setSheetName(sheet)
    setParsedData(data)
    setCurrentStep(2)
  }

  const handleMappingComplete = (mapping: Record<string, string>) => {
    setColumnMapping(mapping)
    setCurrentStep(3)
  }

  const handleShippingConfigComplete = (config: any) => {
    setShippingConfig(config)
    setCurrentStep(4)
  }

  const handleStartProcessing = (id: string) => {
    setBatchId(id)
    setCurrentStep(5)
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step)
    }
  }

  const handleReset = () => {
    setCurrentStep(1)
    setFileName('')
    setSheetName(null)
    setParsedData([])
    setColumnMapping({})
    setShippingConfig(null)
    setBatchId(null)
  }

  return (
    <div className="w-full px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Batch Shipment Import</h1>
        <p className="text-gray-600">
          Import CSV/Excel files to create shipment labels and PACE records in bulk
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-4xl">
          {[
            { num: 1, label: 'Upload File' },
            { num: 2, label: 'Map Columns' },
            { num: 3, label: 'Configure Shipping' },
            { num: 4, label: 'Review' },
            { num: 5, label: 'Process' },
          ].map((step, idx) => (
            <div key={step.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    step.num < currentStep
                      ? 'bg-green-500 text-white ring-4 ring-green-100'
                      : step.num === currentStep
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'bg-gray-200 text-gray-500 border-2 border-gray-300'
                  }`}
                >
                  {step.num < currentStep ? (
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    step.num
                  )}
                </div>
                <div
                  className={`mt-2 text-xs text-center font-medium ${
                    step.num === currentStep
                      ? 'text-blue-600'
                      : step.num < currentStep
                      ? 'text-green-600'
                      : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </div>
              </div>
              {idx < 4 && (
                <div
                  className={`h-1 flex-1 mx-2 rounded-full transition-all ${
                    step.num < currentStep ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[500px]">
        {currentStep === 1 && <Step1Upload onComplete={handleFileUpload} />}
        {currentStep === 2 && (
          <Step2ColumnMapping
            data={parsedData}
            onComplete={handleMappingComplete}
            onBack={handleBack}
          />
        )}
        {currentStep === 3 && (
          <Step3ShippingConfig
            onComplete={handleShippingConfigComplete}
            onBack={handleBack}
          />
        )}
        {currentStep === 4 && (
          <Step4Review
            fileName={fileName}
            sheetName={sheetName}
            data={parsedData}
            columnMapping={columnMapping}
            shippingConfig={shippingConfig}
            onStartProcessing={handleStartProcessing}
            onBack={handleBack}
          />
        )}
        {currentStep === 5 && batchId && (
          <Step5Processing
            batchId={batchId}
            onReset={handleReset}
            originalData={parsedData}
            columnMapping={columnMapping}
          />
        )}
      </div>
    </div>
  )
}

import { ManualLabelForm } from '@/components/shipments/ManualLabelForm'

export default function ManualLabelPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create Manual Shipping Label</h1>
        <p className="text-gray-600 mt-2">
          Generate shipping labels without connecting to PACE
        </p>
      </div>
      <ManualLabelForm />
    </div>
  )
}

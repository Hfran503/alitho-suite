import { PdfGeneratorForm } from '@/components/portal/PdfGeneratorForm'

export default function GcuCustomEnvelopeOrderPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Place Custom Envelope Order</h1>
        <p className="text-gray-600 mt-2">
          Create and submit custom envelope orders with personalized addresses
        </p>
      </div>
      <PdfGeneratorForm />
    </div>
  )
}

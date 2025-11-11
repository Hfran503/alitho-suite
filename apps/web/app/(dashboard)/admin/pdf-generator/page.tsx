import { PdfGeneratorForm } from '@/components/admin/PdfGeneratorForm'

export default function PdfGeneratorPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">PDF Address Generator</h1>
        <p className="text-gray-600 mt-2">
          Generate print-ready PDFs with addresses and crop marks
        </p>
      </div>
      <PdfGeneratorForm />
    </div>
  )
}

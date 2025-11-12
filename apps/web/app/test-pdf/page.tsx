/**
 * Test page for Atlassian PDF generation
 *
 * Visit: http://localhost:3000/test-pdf
 *
 * This page allows you to test the PDF generation with your Atlassian template.
 * You can remove this file once you've integrated the component into your actual pages.
 */

import { AtlassianWelcome, QuickAtlassianWelcome } from '@/components/pdf/AtlassianWelcome'

export default function TestPdfPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Atlassian PDF Generator Test
          </h1>
          <p className="text-gray-600">
            Test replacing {'{name}'} in your Atlassian template with actual names
          </p>
        </div>

        {/* Main Component */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <AtlassianWelcome />
        </div>

        {/* Quick Version */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Quick Version</h3>
          <p className="text-gray-600 mb-4">
            Simple inline component without all the features:
          </p>
          <QuickAtlassianWelcome />
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">How It Works</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Enter a name (e.g., &quot;Alex&quot;) in the input field above</li>
            <li>Click &quot;Download PDF&quot; to generate and download</li>
            <li>Or click &quot;Preview&quot; to open in a new tab</li>
            <li>The name will be centered on the certificate using CharlieDisplay font at 45px</li>
            <li>Font size automatically reduces for longer names to fit the rectangle</li>
          </ol>
        </div>

        {/* Code Example */}
        <div className="bg-gray-900 text-gray-100 rounded-lg p-6 overflow-x-auto">
          <h3 className="text-lg font-semibold mb-3 text-white">
            Code Example
          </h3>
          <pre className="text-sm">
            <code>{`// Generate PDF with calibrated settings
const response = await fetch('/api/pdf/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    templateUrl: '/templates/Atlassian_Welcome_Kit.pdf',
    method: 'overlay',
    fontUrl: '/fonts/CharlieDisplay-Regular.otf',
    overlays: [{
      text: 'Alex',
      x: 470,        // Center X
      y: 325,        // Center Y
      fontSize: 45,  // Auto-scaled
      color: { r: 0, g: 0, b: 0 },
      align: 'center'
    }]
  })
})`}</code>
          </pre>
        </div>

        {/* Documentation Links */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">Documentation</h3>
          <ul className="space-y-2">
            <li>
              <a
                href="/docs/ATLASSIAN_TEMPLATE_USAGE.md"
                className="text-blue-600 hover:underline"
              >
                📄 Atlassian Template Usage Guide
              </a>
            </li>
            <li>
              <a
                href="/docs/PDF_GENERATION_GUIDE.md"
                className="text-blue-600 hover:underline"
              >
                📘 Complete PDF Generation Guide
              </a>
            </li>
          </ul>
        </div>

        {/* Remove This Page */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Note</h3>
          <p className="text-gray-700">
            This is a test page. Once you&apos;ve verified everything works, you can:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
            <li>
              Delete this file:{' '}
              <code className="bg-gray-200 px-2 py-1 rounded text-sm">
                apps/web/app/test-pdf/page.tsx
              </code>
            </li>
            <li>
              Use the <code className="bg-gray-200 px-2 py-1 rounded text-sm">AtlassianWelcome</code> component in your actual pages
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

# PDF Generation Guide

This guide explains how to generate PDFs from templates in your React frontend, with variables like `{name}` being replaced with actual values (e.g., "Alex").

## Quick Start

### 1. Prepare Your PDF Template

Create a PDF template with form fields or placeholders. For example:
- Create a PDF with text like: "Hello {name}!"
- Or create a PDF with interactive form fields named "name", "email", etc.

Place your template in the `public/templates/` folder:
```
public/
  templates/
    certificate.pdf
    invoice-template.pdf
```

### 2. Use in Your React Component

```typescript
import { generatePdf } from '@/lib/client/pdf-api'

// Simple usage - replace {name} with "Alex"
await generatePdf({
  templateUrl: '/templates/certificate.pdf',
  data: {
    name: 'Alex',  // Replaces {name} with "Alex"
  }
})
```

## Methods Available

### Method 1: Form Fields (Recommended)

If your PDF has **form fields**, this is the easiest method:

```typescript
await generatePdf({
  templateUrl: '/templates/invoice.pdf',
  method: 'form',  // This is the default
  data: {
    name: 'Alex',
    email: 'alex@example.com',
    invoiceNumber: '12345',
    date: new Date().toLocaleDateString(),
  },
  filename: 'invoice-alex.pdf',
})
```

**How to create form fields in a PDF:**
- Use Adobe Acrobat or other PDF editors
- Add form fields with names matching your data keys
- The field name should match the key (e.g., field named "name" for `data.name`)

### Method 2: Text Overlays

If you know the exact coordinates where text should appear:

```typescript
await generatePdf({
  templateUrl: '/templates/certificate.pdf',
  method: 'overlay',
  data: {},
  overlays: [
    {
      text: 'Alex',
      x: 300,      // Pixels from left
      y: 400,      // Pixels from bottom
      fontSize: 24,
      color: { r: 0, g: 0, b: 0 }  // RGB (black)
    }
  ],
  filename: 'certificate-alex.pdf',
})
```

**Finding coordinates:**
- Open your PDF in Adobe Acrobat
- Enable "Show Coordinates" in the cursor info
- Note the X and Y positions where you want text
- Y-axis starts from the bottom of the page

### Method 3: Upload Custom Template

Allow users to upload their own templates:

```typescript
import { fileToBase64, generatePdf } from '@/lib/client/pdf-api'

const handleFileUpload = async (file: File) => {
  const base64 = await fileToBase64(file)

  await generatePdf({
    templateFile: base64,
    data: {
      name: 'Alex',
    }
  })
}
```

## Complete Examples

### Example 1: Certificate Generator

```typescript
'use client'

import { useState } from 'react'
import { generatePdf } from '@/lib/client/pdf-api'

export function CertificateGenerator() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      await generatePdf({
        templateUrl: '/templates/certificate.pdf',
        data: {
          name: name,  // Replaces {name} with user input
          date: new Date().toLocaleDateString(),
        },
        filename: `certificate-${name}.pdf`,
      })
    } catch (error) {
      console.error('Error generating PDF:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter name (e.g., Alex)"
      />
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Certificate'}
      </button>
    </div>
  )
}
```

### Example 2: Invoice Generator with Multiple Fields

```typescript
const generateInvoice = async (customerData) => {
  await generatePdf({
    templateUrl: '/templates/invoice-template.pdf',
    data: {
      customerName: 'Alex',
      invoiceNumber: 'INV-12345',
      date: '2025-11-05',
      amount: '$1,234.56',
      items: '5',
    },
    filename: `invoice-INV-12345.pdf`,
  })
}
```

### Example 3: Preview Instead of Download

```typescript
import { generateAndViewPdf } from '@/lib/client/pdf-api'

// Opens PDF in new tab instead of downloading
await generateAndViewPdf({
  templateUrl: '/templates/certificate.pdf',
  data: {
    name: 'Alex',
  }
})
```

## API Endpoint

The backend API is available at:

```
POST /api/pdf/generate
```

**Request Body:**
```json
{
  "templateUrl": "/templates/certificate.pdf",
  "method": "form",
  "data": {
    "name": "Alex",
    "date": "2025-11-05"
  }
}
```

**Response:**
- Content-Type: `application/pdf`
- Returns the generated PDF file

## Files Structure

```
apps/web/
├── lib/
│   ├── pdf-template.ts           # PDF manipulation utilities
│   └── client/
│       └── pdf-api.ts            # Client-side API helpers
├── app/
│   └── api/
│       └── pdf/
│           └── generate/
│               └── route.ts      # API endpoint
├── components/
│   └── pdf/
│       └── PdfGenerator.tsx      # Example component
├── examples/
│   └── pdf-usage-examples.tsx    # Usage examples
└── public/
    └── templates/
        ├── certificate.pdf
        └── invoice-template.pdf
```

## Troubleshooting

### Issue: "Field not found in PDF form"

**Solution:** Your PDF doesn't have form fields. Either:
1. Add form fields to your PDF using Adobe Acrobat
2. Use the `overlay` method with coordinates instead

### Issue: Text appears in wrong position with overlays

**Solution:** PDF coordinates start from bottom-left:
- X increases from left to right
- Y increases from bottom to top
- Use a PDF viewer with coordinate display to find exact positions

### Issue: Variables like {name} not being replaced

**Solution:** The simple text replacement method is complex. Instead:
1. Create form fields in your PDF with the same names
2. Or use the overlay method with specific coordinates

## Advanced: Creating Better PDF Templates

### Using Adobe Acrobat

1. Open your PDF in Adobe Acrobat
2. Go to Tools → Prepare Form
3. Add text fields where you want dynamic content
4. Name each field to match your data keys (e.g., "name", "email")
5. Save the PDF

### Using LibreOffice

1. Create your document in LibreOffice Writer
2. Insert form controls (View → Toolbars → Form Controls)
3. Export as PDF
4. Enable "Create PDF form" in export options

## Performance Considerations

- For batch generation, generate PDFs sequentially to avoid memory issues
- Store templates in a CDN or S3 for faster loading
- Consider caching generated PDFs if they're frequently requested

## Security Notes

- The API endpoint can be protected with authentication (commented out in the code)
- Validate all input data before generating PDFs
- Limit file sizes for uploaded templates
- Consider rate limiting for the API endpoint

## Next Steps

1. Create your PDF template and place it in `public/templates/`
2. Copy one of the examples from `examples/pdf-usage-examples.tsx`
3. Modify the data object to match your needs
4. Test with your template

For more examples, see [examples/pdf-usage-examples.tsx](../examples/pdf-usage-examples.tsx)

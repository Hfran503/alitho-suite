# Atlassian Template Usage Guide

Your Atlassian template has `{name}` on page 1 that needs to be replaced with actual names like "Alex".

## Quick Start

### Method 1: Use the Pre-built Component

```tsx
import { AtlassianWelcome } from '@/components/pdf/AtlassianWelcome'

export default function WelcomePage() {
  return <AtlassianWelcome />
}
```

That's it! This gives you a complete form with:
- Name input field
- Download button
- Preview button
- Error handling
- Success messages

### Method 2: Simple Function Call

```typescript
import { generatePdf } from '@/lib/client/pdf-api'

// One line to generate the PDF
await generatePdf({
  templateUrl: '/templates/Atlassian_Template.pdf',
  data: {
    name: 'Alex',  // Replaces {name} with "Alex"
  },
  filename: 'welcome-alex.pdf',
})
```

### Method 3: Quick Inline Component

```tsx
import { QuickAtlassianWelcome } from '@/components/pdf/AtlassianWelcome'

// Just drop this anywhere in your JSX
<QuickAtlassianWelcome />
```

## How It Works

Your PDF has:
```
Page 1: "Welcome to the team, {name}!"
Page 2: Atlassian logo
```

When you pass `name: "Alex"`, it becomes:
```
Page 1: "Welcome to the team, Alex!"
Page 2: Atlassian logo (unchanged)
```

## Complete Example

```tsx
'use client'

import { useState } from 'react'
import { generatePdf } from '@/lib/client/pdf-api'

export default function WelcomeGenerator() {
  const [name, setName] = useState('')

  const handleGenerate = async () => {
    await generatePdf({
      templateUrl: '/templates/Atlassian_Template.pdf',
      data: { name },
      filename: `welcome-${name}.pdf`,
    })
  }

  return (
    <div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter name (e.g., Alex)"
      />
      <button onClick={handleGenerate}>
        Generate Welcome PDF
      </button>
    </div>
  )
}
```

## Two Methods Available

### A. Form Fields Method (Easier)

If your PDF has a **form field** named "name":

```typescript
await generatePdf({
  templateUrl: '/templates/Atlassian_Template.pdf',
  method: 'form',  // Default
  data: {
    name: 'Alex',
  }
})
```

**To add a form field to your PDF:**
1. Open the PDF in Adobe Acrobat
2. Tools → Prepare Form
3. Add a text field where `{name}` is
4. Name the field "name"
5. Save the PDF

### B. Overlay Method (More Control)

If you want to place text at exact coordinates:

```typescript
await generatePdf({
  templateUrl: '/templates/Atlassian_Template.pdf',
  method: 'overlay',
  data: {},
  overlays: [
    {
      text: 'Alex',
      x: 400,      // Adjust to match {name} position
      y: 350,      // Adjust to match {name} position
      page: 0,     // First page
      fontSize: 72,
    }
  ]
})
```

**Finding the right coordinates:**

1. Open your PDF in a viewer that shows coordinates
2. Hover over where `{name}` appears
3. Note the X and Y position
4. PDF coordinates start from **bottom-left**
   - X increases left to right
   - Y increases bottom to top

## API Usage

The backend API endpoint is available at `/api/pdf/generate`:

```typescript
const response = await fetch('/api/pdf/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    templateUrl: '/templates/Atlassian_Template.pdf',
    method: 'form',
    data: {
      name: 'Alex',
    }
  })
})

const blob = await response.blob()
// Download or display the PDF
```

## Batch Generation

Generate multiple PDFs for different people:

```typescript
const names = ['Alex', 'Jordan', 'Taylor', 'Morgan']

for (const name of names) {
  await generatePdf({
    templateUrl: '/templates/Atlassian_Template.pdf',
    data: { name },
    filename: `welcome-${name}.pdf`,
  })

  // Optional: Add delay between generations
  await new Promise(resolve => setTimeout(resolve, 500))
}
```

## Testing

### Test in Browser Console

1. Open your app in the browser
2. Open DevTools Console (F12)
3. Run:

```javascript
const response = await fetch('/api/pdf/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    templateUrl: '/templates/Atlassian_Template.pdf',
    data: { name: 'Alex' }
  })
})

const blob = await response.blob()
const url = URL.createObjectURL(blob)
window.open(url)
```

## Troubleshooting

### Issue: Name doesn't appear in PDF

**Solution 1:** Your PDF might not have form fields. Try the overlay method:
```typescript
method: 'overlay',
overlays: [{ text: 'Alex', x: 400, y: 350, page: 0, fontSize: 72 }]
```

**Solution 2:** Check if the form field name matches:
- Field in PDF must be named exactly "name" (lowercase)
- Or use a different key in your data object

### Issue: Name appears in wrong position

**Solution:** Adjust the coordinates in the overlay method. The coordinate system:
- (0, 0) is at the **bottom-left** corner
- X increases to the right
- Y increases upward

### Issue: Font looks different

**Solution:** The overlay method uses Helvetica Bold by default. To match your original font, you may need to adjust the font in [lib/atlassian-template.ts](../lib/atlassian-template.ts#L1).

## Next Steps

1. **Test with form fields first** - Try generating a PDF with the default method
2. **If that doesn't work** - Use the overlay method with coordinates
3. **Adjust coordinates** - Fine-tune the X and Y positions if needed
4. **Customize the component** - Modify [AtlassianWelcome.tsx](../components/pdf/AtlassianWelcome.tsx) for your UI

## Files Created

- [components/pdf/AtlassianWelcome.tsx](../components/pdf/AtlassianWelcome.tsx) - React component
- [lib/atlassian-template.ts](../lib/atlassian-template.ts) - Utility functions
- [lib/client/pdf-api.ts](../lib/client/pdf-api.ts) - API helpers
- [app/api/pdf/generate/route.ts](../app/api/pdf/generate/route.ts) - Backend endpoint

## Support

For more general PDF generation info, see [PDF_GENERATION_GUIDE.md](./PDF_GENERATION_GUIDE.md)

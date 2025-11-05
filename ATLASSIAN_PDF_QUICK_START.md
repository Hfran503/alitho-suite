# Atlassian PDF Quick Start

Replace `{name}` in your Atlassian template with actual names like "Alex".

## 🚀 Try It Now

1. **Start your dev server:**
   ```bash
   cd apps/web
   pnpm dev
   ```

2. **Visit the test page:**
   ```
   http://localhost:3000/test-pdf
   ```

3. **Enter a name and click "Download PDF"**
   - Input: "Alex"
   - Output: PDF with "Welcome to the team, Alex!"

## 📝 Basic Usage

### Option 1: Use the Component (Easiest)

```tsx
import { AtlassianWelcome } from '@/components/pdf/AtlassianWelcome'

export default function MyPage() {
  return <AtlassianWelcome />
}
```

### Option 2: Simple Function Call

```typescript
import { generatePdf } from '@/lib/client/pdf-api'

await generatePdf({
  templateUrl: '/templates/Atlassian_Template.pdf',
  data: {
    name: 'Alex',
  }
})
```

### Option 3: Inline Component

```tsx
import { QuickAtlassianWelcome } from '@/components/pdf/AtlassianWelcome'

<QuickAtlassianWelcome />
```

## 📁 Your Files

### Template Location
```
apps/web/public/templates/Atlassian_Template.pdf ✅
```

### Components Created
```
apps/web/components/pdf/AtlassianWelcome.tsx    - React component
apps/web/lib/client/pdf-api.ts                  - Helper functions
apps/web/app/api/pdf/generate/route.ts          - Backend API
apps/web/app/test-pdf/page.tsx                  - Test page
```

### Documentation
```
apps/web/docs/ATLASSIAN_TEMPLATE_USAGE.md       - Atlassian specific guide
apps/web/docs/PDF_GENERATION_GUIDE.md           - Complete PDF guide
```

## 🎯 What Gets Replaced

**Your Template (Page 1):**
```
Welcome to the team, {name}!
```

**After Generation with name="Alex":**
```
Welcome to the team, Alex!
```

## 🔧 Two Methods Available

### Method A: Form Fields (Recommended)

Your PDF needs form fields. To add them:
1. Open PDF in Adobe Acrobat
2. Tools → Prepare Form
3. Add text field named "name" where {name} appears
4. Save

Then use:
```typescript
await generatePdf({
  templateUrl: '/templates/Atlassian_Template.pdf',
  method: 'form',
  data: { name: 'Alex' }
})
```

### Method B: Text Overlay

Place text at specific coordinates:
```typescript
await generatePdf({
  templateUrl: '/templates/Atlassian_Template.pdf',
  method: 'overlay',
  overlays: [{
    text: 'Alex',
    x: 400,      // Adjust to match {name} position
    y: 350,      // Adjust to match {name} position
    page: 0,
    fontSize: 72
  }]
})
```

## 📋 Complete Example

```tsx
'use client'

import { useState } from 'react'
import { generatePdf } from '@/lib/client/pdf-api'

export default function WelcomePage() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      await generatePdf({
        templateUrl: '/templates/Atlassian_Template.pdf',
        data: { name },
        filename: `welcome-${name}.pdf`
      })
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter name"
      />
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating...' : 'Generate PDF'}
      </button>
    </div>
  )
}
```

## 🔍 Testing

### Test in Browser Console (Quick Test)

```javascript
// Open DevTools (F12) and run:
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

## ❓ Troubleshooting

### Name doesn't appear?
→ Try the overlay method with coordinates

### Wrong position?
→ Adjust X and Y coordinates (PDF uses bottom-left as origin)

### Form field not found?
→ PDF doesn't have form fields, use overlay method

## 🎓 Next Steps

1. ✅ Test at http://localhost:3000/test-pdf
2. ✅ Use `<AtlassianWelcome />` in your pages
3. ✅ Customize for your needs
4. ✅ Read full docs in `apps/web/docs/ATLASSIAN_TEMPLATE_USAGE.md`

## 📞 API Endpoint

```
POST /api/pdf/generate

Body:
{
  "templateUrl": "/templates/Atlassian_Template.pdf",
  "data": { "name": "Alex" }
}

Response: PDF file (application/pdf)
```

---

**Ready to test?** Run `pnpm dev` and visit http://localhost:3000/test-pdf

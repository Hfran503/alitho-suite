/**
 * Script to convert PDF pages to PNG images
 * Run with: node scripts/convert-pdf-to-images.js
 */

const { pdfToPng } = require('pdf-to-png-converter')
const { writeFile, mkdir } = require('fs/promises')
const { join } = require('path')
const { existsSync } = require('fs')

async function convertPdfToImages() {
  const templateName = 'Atlassian_Welcome_Kit.pdf'
  const inputPath = join(__dirname, '..', 'public', 'templates', templateName)
  const outputDir = join(__dirname, '..', 'public', 'templates', 'pages')

  console.log(`Converting ${templateName} to PNG images...`)
  console.log(`Input: ${inputPath}`)
  console.log(`Output: ${outputDir}`)

  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
  }

  // Convert PDF to PNG
  const pngPages = await pdfToPng(inputPath, {
    outputType: 'buffer',
    viewportScale: 2.0, // 2x scale for better quality
  })

  console.log(`Generated ${pngPages.length} pages`)

  // Save each page
  for (let i = 0; i < pngPages.length; i++) {
    const page = pngPages[i]
    const outputPath = join(outputDir, `Atlassian_Welcome_Kit_page_${i + 1}.png`)

    await writeFile(outputPath, page.content)
    console.log(`✓ Saved page ${i + 1} to: ${outputPath}`)
  }

  console.log('\n✅ Conversion complete!')
  console.log(`Images saved to: ${outputDir}`)
}

convertPdfToImages().catch(console.error)

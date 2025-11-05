/**
 * Script to add a form field to the Atlassian PDF template
 * This will add a text field where {name} should be
 *
 * Run with: npx tsx scripts/add-form-field.ts
 */

import { PDFDocument, rgb } from 'pdf-lib'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

async function addFormField() {
  console.log('📄 Loading Atlassian_Template.pdf...')

  const templatePath = join(process.cwd(), 'public', 'templates', 'Atlassian_Template.pdf')
  const buffer = await readFile(templatePath)
  const pdfDoc = await PDFDocument.load(buffer)

  console.log('✏️ Adding form field...')

  const form = pdfDoc.getForm()
  const pages = pdfDoc.getPages()
  const firstPage = pages[0]
  const { width, height } = firstPage.getSize()

  // Calculate position for the name field
  // Centered on the page, roughly where {name} appears
  const fontSize = 72

  // Create a text field
  const nameField = form.createTextField('name')
  nameField.setText('')

  // Position it where {name} should be (centered)
  const fieldWidth = 400
  const fieldHeight = 90
  const fieldX = (width - fieldWidth) / 2
  const fieldY = height / 2 - 40

  nameField.addToPage(firstPage, {
    x: fieldX,
    y: fieldY,
    width: fieldWidth,
    height: fieldHeight,
    textColor: rgb(0, 0, 0),
    backgroundColor: rgb(1, 1, 1),
    borderWidth: 0,
  })

  nameField.setFontSize(fontSize)
  nameField.enableMultiline()
  nameField.setAlignment(1) // Center aligned

  console.log('💾 Saving modified PDF...')

  // Save to a new file
  const pdfBytes = await pdfDoc.save()
  const outputPath = join(process.cwd(), 'public', 'templates', 'Atlassian_Template_WithFormField.pdf')
  await writeFile(outputPath, pdfBytes)

  console.log('✅ Done! New PDF saved to:')
  console.log('   public/templates/Atlassian_Template_WithFormField.pdf')
  console.log('')
  console.log('📝 Now you can use this template with form fields!')
}

addFormField().catch(console.error)

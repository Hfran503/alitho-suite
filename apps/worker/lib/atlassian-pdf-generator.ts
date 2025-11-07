import { PDFDocument, cmyk } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Map country category to a shorter type name for filename
 */
function getCountryType(countryCategory: string): string {
  const typeMap: Record<string, string> = {
    'United States of America': 'USA',
    'International US': 'International',
    'Philippines': 'Philippines',
    'Australia': 'Australia',
    'India': 'India',
  };

  return typeMap[countryCategory] || countryCategory;
}

/**
 * Generate an Atlassian welcome PDF with the employee's print name
 * @param printName - The print name to display (e.g., "Alex")
 * @param orderNumber - The order number (e.g., "CS501")
 * @param countryCategory - The country category (e.g., "United States of America", "Philippines")
 * @returns Path to the generated PDF relative to public directory
 */
export async function generateAtlassianWelcomePDF(
  printName: string,
  orderNumber: string,
  countryCategory: string
): Promise<string> {
  try {
    console.log(`📄 Generating PDF for ${printName}...`);

    // Paths
    const publicDir = join(process.cwd(), '../../apps/web/public');
    const templatePath = join(publicDir, 'templates', 'Atlassian_Template_v1.pdf');
    const fontPath = join(publicDir, 'fonts', 'CharlieDisplay-Regular.otf');
    const outputDir = join(publicDir, 'atlassian-pdfs');

    // Create output directory if it doesn't exist
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    // Load template and font
    const [templateBuffer, fontBuffer] = await Promise.all([
      readFile(templatePath),
      readFile(fontPath),
    ]);

    // Load PDF document
    const pdfDoc = await PDFDocument.load(templateBuffer);
    pdfDoc.registerFontkit(fontkit);

    // Embed custom font
    const font = await pdfDoc.embedFont(fontBuffer);

    // Get first page
    const pages = pdfDoc.getPages();
    const page = pages[0];

    if (!page) {
      throw new Error('PDF template has no pages');
    }

    // Format text: Add "!" after the print name
    const text = `${printName} !`;

    // Calculate font size (auto-scale for longer names)
    const baseSize = 45;
    const maxWidth = 468 * 0.95; // 95% of rectangle width
    const estimatedWidth = text.length * (baseSize * 0.6);
    const fontSize = estimatedWidth > maxWidth
      ? Math.floor((maxWidth / estimatedWidth) * baseSize)
      : baseSize;

    // Position (center of the rectangle)
    const centerX = 470;
    const centerY = 325;

    // CMYK black color
    const color = cmyk(0, 0, 0, 1);

    // Calculate text dimensions
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);
    const ascent = font.heightAtSize(fontSize, { descender: false });
    const descent = textHeight - ascent;

    // Calculate centered position
    const xPosition = centerX - textWidth / 2;
    const yPosition = centerY - (textHeight / 2) + descent;

    console.log('📝 PDF Text Rendering:', {
      text,
      requestedCenter: { x: centerX, y: centerY },
      actualPosition: { x: xPosition, y: yPosition },
      fontSize,
      textWidth,
      textHeight,
    });

    // Draw text
    page.drawText(text, {
      x: xPosition,
      y: yPosition,
      size: fontSize,
      font,
      color,
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();

    // Generate filename in format: name - order# - type.pdf
    // Example: "Alex - CS501 - USA.pdf"
    const countryType = getCountryType(countryCategory);
    const filename = `${printName} - ${orderNumber} - ${countryType}.pdf`;
    const outputPath = join(outputDir, filename);

    await writeFile(outputPath, pdfBytes);

    // Return path relative to public directory
    const relativePath = `/atlassian-pdfs/${filename}`;

    console.log(`✓ PDF generated: ${relativePath}`);

    return relativePath;
  } catch (error) {
    console.error('Error generating Atlassian PDF:', error);
    throw new Error(
      `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

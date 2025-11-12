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
    const templatePath = join(publicDir, 'templates', 'Atlassian_Welcome_Kit.pdf');
    const fontPath = join(publicDir, 'fonts', 'CharlieDisplay-Bold.otf');
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

    // Format text: Add "!" after the print name (no space)
    const text = `${printName}!`;

    // Calculate font size (auto-scale for longer names)
    const baseSize = 40;
    const maxWidth = 456 * 0.95; // 95% of rectangle width (456 pts from calibration)
    const estimatedWidth = text.length * (baseSize * 0.6);
    const fontSize = estimatedWidth > maxWidth
      ? Math.floor((maxWidth / estimatedWidth) * baseSize)
      : baseSize;

    // Position (center of the rectangle) - calibrated from adjust-pdf tool
    // Rectangle: X=6, Y=120, Width=456, Height=83
    const centerX = 234; // Center X from calibration
    const centerY = 162; // Center Y from calibration

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

    // Return API path for serving the PDF
    // This works reliably in Docker/standalone builds
    const apiPath = `/api/atlassian-pdfs/${encodeURIComponent(filename)}`;

    console.log(`✓ PDF generated: ${filename}`);
    console.log(`   Accessible at: ${apiPath}`);

    return apiPath;
  } catch (error) {
    console.error('Error generating Atlassian PDF:', error);
    throw new Error(
      `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

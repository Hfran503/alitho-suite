const { generateGcuEnvelopePdf } = require('./lib/pdf-generator.ts');
const { writeFile, mkdir } = require('fs/promises');
const { join } = require('path');

async function testRegeneration() {
  const orderId = '12345';
  const quantity = 500;
  const position = 'center back flap';
  const address = `The American Legion National Headquarters
PO Box 1055
Indianapolis, IN 46206`;

  try {
    console.log('Generating PDFs...');

    // Generate both PDFs
    const printPdf = await generateGcuEnvelopePdf(orderId, position, address, 'print');
    const proofPdf = await generateGcuEnvelopePdf(orderId, position, address, 'proof');

    // Ensure directory exists
    const uploadsDir = join(process.cwd(), 'public', 'gcu-envelope-pdfs');
    await mkdir(uploadsDir, { recursive: true });

    // Save PDFs
    const printFilename = `${orderId} - ${quantity} - print.pdf`;
    const proofFilename = `${orderId} - ${quantity} - proof.pdf`;

    const printPath = join(uploadsDir, printFilename);
    const proofPath = join(uploadsDir, proofFilename);

    await writeFile(printPath, printPdf);
    await writeFile(proofPath, proofPdf);

    console.log(`✓ Regenerated PDFs:`);
    console.log(`  - Print: ${printPath} (${printPdf.length} bytes)`);
    console.log(`  - Proof: ${proofPath} (${proofPdf.length} bytes)`);
  } catch (error) {
    console.error('Error:', error);
  }
}

testRegeneration();

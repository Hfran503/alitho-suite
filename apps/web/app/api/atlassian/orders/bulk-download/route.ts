import { NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/database';
import * as XLSX from 'xlsx';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

type AtlassianOrder = {
  id: string;
  orderNumber: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  personalEmail: string | null;
  workEmail: string | null;
  phoneNumber: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  startDate: string | null;
  status: string;
  paceJobNumber: string | null;
  pdfPath: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderIds } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Order IDs are required' },
        { status: 400 }
      );
    }

    // Fetch orders from database
    const orders = await db.atlassianOrder.findMany({
      where: {
        id: {
          in: orderIds,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }) as AtlassianOrder[];

    if (orders.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No orders found' },
        { status: 404 }
      );
    }

    // Prepare XLSX data
    const excelData = orders.map((order) => ({
      'Order #': order.orderNumber || 'N/A',
      'Name': order.fullName || `${order.firstName} ${order.lastName}`,
      'Email': order.personalEmail || order.workEmail || 'N/A',
      'Phone': order.phoneNumber || 'N/A',
      'Address': [
        order.address1,
        order.address2,
        order.address3,
        order.city,
        order.state,
        order.zipCode,
      ]
        .filter(Boolean)
        .join(', ') || 'N/A',
      'Country': order.country || 'N/A',
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Auto-size columns
    const columnWidths = [
      { wch: 12 }, // Order #
      { wch: 25 }, // Name
      { wch: 30 }, // Email
      { wch: 18 }, // Phone
      { wch: 50 }, // Address
      { wch: 25 }, // Country
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

    // Generate XLSX buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    // Array to collect chunks
    const chunks: Buffer[] = [];

    // Listen for data event
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    // Wait for archive to finish
    const archivePromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      archive.on('error', (err: Error) => {
        reject(err);
      });
    });

    // Add Excel file to archive
    archive.append(excelBuffer, { name: `orders_${new Date().toISOString().slice(0, 10)}.xlsx` });

    // Add PDF files to archive
    const pdfDirectory = path.join(process.cwd(), 'public', 'atlassian-pdfs');
    let pdfCount = 0;
    const pdfErrors: string[] = [];

    for (const order of orders) {
      if (order.pdfPath) {
        try {
          // Extract filename from pdfPath
          // pdfPath might be like "/api/atlassian-pdfs/Pooja%20-%20CS523%20-%20Australia.pdf"
          // or "/atlassian-pdfs/Pooja - CS523 - Australia.pdf"
          // We need to decode the URL-encoded filename
          const encodedFilename = path.basename(order.pdfPath);
          const filename = decodeURIComponent(encodedFilename);
          const fullPath = path.join(pdfDirectory, filename);

          console.log(`Checking PDF for order ${order.orderNumber}:`, {
            pdfPath: order.pdfPath,
            filename,
            fullPath,
            exists: fs.existsSync(fullPath)
          });

          // Check if file exists
          if (fs.existsSync(fullPath)) {
            const fileBuffer = fs.readFileSync(fullPath);
            const fileName = `${order.orderNumber || order.id}_${filename}`;
            archive.append(fileBuffer, { name: `pdfs/${fileName}` });
            pdfCount++;
            console.log(`Added PDF: ${fileName}`);
          } else {
            pdfErrors.push(`PDF not found for order ${order.orderNumber}: ${fullPath}`);
          }
        } catch (error) {
          const errorMsg = `Error adding PDF for order ${order.orderNumber}: ${error}`;
          console.error(errorMsg);
          pdfErrors.push(errorMsg);
          // Continue with other files even if one fails
        }
      }
    }

    console.log(`Total PDFs added to archive: ${pdfCount}`);
    if (pdfErrors.length > 0) {
      console.error('PDF errors:', pdfErrors);
    }

    // Finalize the archive (this must be called after all append operations)
    archive.finalize();

    // Wait for archive to complete
    const zipBuffer = await archivePromise;

    // Convert Buffer to Uint8Array for Response
    const uint8Array = new Uint8Array(zipBuffer);

    // Return ZIP file
    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="atlassian_orders_${new Date().toISOString().slice(0, 10)}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Bulk download error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create download package',
      },
      { status: 500 }
    );
  }
}

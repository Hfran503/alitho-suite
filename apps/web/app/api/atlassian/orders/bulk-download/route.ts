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
      'Start Date': order.startDate || 'N/A',
      'Status': order.status,
      'PACE Job #': order.paceJobNumber || 'N/A',
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
      { wch: 15 }, // Start Date
      { wch: 15 }, // Status
      { wch: 15 }, // PACE Job #
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
    const publicPath = path.join(process.cwd(), 'public');
    let pdfCount = 0;

    for (const order of orders) {
      if (order.pdfPath) {
        try {
          // Remove leading slash and 'public' from path if present
          const relativePath = order.pdfPath.replace(/^\//, '');
          const fullPath = path.join(publicPath, relativePath);

          // Check if file exists
          if (fs.existsSync(fullPath)) {
            const fileBuffer = fs.readFileSync(fullPath);
            const fileName = `${order.orderNumber || order.id}_${path.basename(order.pdfPath)}`;
            archive.append(fileBuffer, { name: `pdfs/${fileName}` });
            pdfCount++;
          }
        } catch (error) {
          console.error(`Error adding PDF for order ${order.orderNumber}:`, error);
          // Continue with other files even if one fails
        }
      }
    }

    // Finalize the archive
    await archive.finalize();

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

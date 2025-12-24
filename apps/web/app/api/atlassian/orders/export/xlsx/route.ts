import { NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/database';
import * as XLSX from 'xlsx';

/**
 * GET /api/atlassian/orders/export/xlsx?paceJobNumber=XXX
 * Export all order information for orders with the given PACE job number to XLSX
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paceJobNumber = searchParams.get('paceJobNumber');

    if (!paceJobNumber) {
      return NextResponse.json(
        { success: false, error: 'paceJobNumber is required' },
        { status: 400 }
      );
    }

    // Fetch orders with the given PACE job number
    const orders = await db.atlassianOrder.findMany({
      where: {
        paceJobNumber,
        status: 'sent_to_pace',
      },
      orderBy: {
        orderNumber: 'asc',
      },
    });

    if (orders.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No orders found for this PACE job number' },
        { status: 404 }
      );
    }

    // Transform orders to a flat structure for Excel
    const excelData = orders.map((order: (typeof orders)[number]) => ({
      'Order Number': order.orderNumber || '',
      'PACE Job Number': order.paceJobNumber || '',
      'Status': order.status || '',
      'First Name': order.firstName || '',
      'Last Name': order.lastName || '',
      'Full Name': order.fullName || '',
      'Print Name': order.printName || '',
      'Personal Email': order.personalEmail || '',
      'Work Email': order.workEmail || '',
      'Phone Number': order.phoneNumber || '',
      'Address Line 1': order.address1 || '',
      'Address Line 2': order.address2 || '',
      'Address Line 3': order.address3 || '',
      'City': order.city || '',
      'State': order.state || '',
      'Zip Code': order.zipCode || '',
      'Country': order.country || '',
      'Country Category': order.countryCategory || '',
      'Start Date': order.startDate || '',
      'Manager': order.manager || '',
      'Department': order.department || '',
      'Location': order.location || '',
      'Email Subject': order.emailSubject || '',
      'Email From': order.emailFrom || '',
      'Email Date': order.emailDate ? new Date(order.emailDate).toLocaleString() : '',
      'PDF Path': order.pdfPath || '',
      'SFTP URL': order.sftpUrl || '',
      'Created At': order.createdAt ? new Date(order.createdAt).toLocaleString() : '',
      'Processed At': order.processedAt ? new Date(order.processedAt).toLocaleString() : '',
      'Updated At': order.updatedAt ? new Date(order.updatedAt).toLocaleString() : '',
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Auto-size columns
    const columnWidths = Object.keys(excelData[0] || {}).map((key) => ({
      wch: Math.max(
        key.length,
        ...excelData.map((row: (typeof excelData)[number]) => String(row[key as keyof typeof row] || '').length)
      ),
    }));
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Return the Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="PACE_Job_${paceJobNumber}_Orders.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error exporting to XLSX:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

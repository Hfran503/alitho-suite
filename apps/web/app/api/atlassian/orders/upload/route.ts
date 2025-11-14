import { NextRequest, NextResponse } from 'next/server';
import { createAtlassianOrder, generatePDFForOrder } from '@/lib/atlassian-orders';
import { db } from '@repo/database';

interface UploadResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  fullName?: string;
  status?: string;
  error?: string;
  isDuplicate?: boolean;
  duplicateOfOrderNumber?: string;
}

/**
 * POST /api/atlassian/orders/upload
 * Upload one or more HTML files to create Atlassian orders
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const tenantId = formData.get('tenantId') as string;

    // Get tenant ID (use provided or get first tenant)
    let targetTenantId = tenantId;

    if (!targetTenantId) {
      const tenant = await db.tenant.findFirst();
      if (!tenant) {
        return NextResponse.json(
          { error: 'No tenant found' },
          { status: 404 }
        );
      }
      targetTenantId = tenant.id;
    }

    // Get all files from form data
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file') && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    console.log(`Processing ${files.length} HTML file(s) for tenant ${targetTenantId}`);

    const results: UploadResult[] = [];

    // Process each file
    for (const file of files) {
      try {
        // Validate file type
        if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
          results.push({
            success: false,
            error: `Invalid file type: ${file.name}. Only HTML files are supported.`,
          });
          continue;
        }

        // Read file content
        const htmlContent = await file.text();

        // Extract subject from filename (e.g., "Atlassian Welcome Packet For _ Anna Xia.html")
        const subject = file.name.replace(/\.html?$/i, '');

        // Import the parser from shared package
        const { parseAtlassianEmail } = await import('@repo/shared');

        // Parse HTML content
        const parsed = parseAtlassianEmail(htmlContent, subject);

        if (!parsed.employeeData.fullName) {
          results.push({
            success: false,
            error: `Could not extract employee name from ${file.name}`,
          });
          continue;
        }

        // Create the order
        const order = await createAtlassianOrder({
          tenantId: targetTenantId,
          ...parsed.employeeData,
          parsedData: parsed.rawFields,
        });

        // Generate PDF if we have printName
        if (order.printName) {
          try {
            await generatePDFForOrder(order.id);
          } catch (pdfError) {
            console.error(`Failed to generate PDF for order ${order.id}:`, pdfError);
            // Don't fail the entire request if PDF generation fails
          }
        }

        // Get duplicate info if applicable
        let isDuplicate = false;
        let duplicateOfOrderNumber: string | undefined;

        if (order.duplicateOfOrderId) {
          isDuplicate = true;
          const duplicateOrder = await db.atlassianOrder.findUnique({
            where: { id: order.duplicateOfOrderId },
            select: { orderNumber: true },
          });
          if (duplicateOrder?.orderNumber) {
            duplicateOfOrderNumber = duplicateOrder.orderNumber;
          }
        }

        results.push({
          success: true,
          orderId: order.id,
          orderNumber: order.orderNumber || undefined,
          fullName: order.fullName || undefined,
          status: order.status,
          isDuplicate,
          duplicateOfOrderNumber,
        });

        console.log(`✓ Created order from ${file.name}: ${order.orderNumber} - ${order.fullName}`);
      } catch (fileError) {
        console.error(`Error processing file ${file.name}:`, fileError);
        results.push({
          success: false,
          error: `Failed to process ${file.name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`,
        });
      }
    }

    // Calculate summary
    const summary = {
      total: files.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      duplicates: results.filter((r) => r.success && r.isDuplicate).length,
    };

    return NextResponse.json({
      success: summary.failed === 0,
      summary,
      results,
    });
  } catch (error) {
    console.error('Error uploading HTML files:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload files',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

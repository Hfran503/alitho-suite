import { NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/database';
import { queueAtlassianOrdersCheck } from '@/lib/queue/atlassian-orders-queue';

/**
 * GET /api/atlassian/orders
 * Fetch all Atlassian order records with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const country = searchParams.get('country');
    const countryCategory = searchParams.get('countryCategory');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search'); // Search by name or email

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (country) {
      where.country = country;
    }

    if (countryCategory) {
      where.countryCategory = countryCategory;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { personalEmail: { contains: search, mode: 'insensitive' } },
        { workEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const totalCount = await db.atlassianOrder.count({ where });

    // Fetch orders
    const orders = await db.atlassianOrder.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        orderNumber: true,
        emailMessageId: true,
        emailSubject: true,
        emailFrom: true,
        emailDate: true,
        status: true,
        duplicateOfOrderId: true,
        duplicateOfOrder: {
          select: {
            id: true,
            orderNumber: true,
            fullName: true,
            createdAt: true,
          },
        },
        firstName: true,
        lastName: true,
        fullName: true,
        printName: true,
        pdfPath: true,
        sftpUrl: true,
        personalEmail: true,
        workEmail: true,
        phoneNumber: true,
        address1: true,
        address2: true,
        address3: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        countryCategory: true,
        startDate: true,
        manager: true,
        department: true,
        location: true,
        paceJobNumber: true,
        errorMessage: true,
        retryCount: true,
        createdAt: true,
        updatedAt: true,
        processedAt: true,
      },
    });

    // Get summary by country category
    const summary = await db.atlassianOrder.groupBy({
      by: ['countryCategory', 'status'],
      _count: {
        id: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: orders,
      totalCount,
      limit,
      offset,
      summary,
    });
  } catch (error) {
    console.error('Error fetching Atlassian orders:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/atlassian/orders
 * Trigger manual check for new emails
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, folderPath = 'AtlassianOrders', deleteAfterProcessing = true } = body;

    // If tenantId not provided, get the first tenant (single-tenant deployments)
    let targetTenantId = tenantId;

    if (!targetTenantId) {
      const tenant = await db.tenant.findFirst();
      if (!tenant) {
        return NextResponse.json(
          {
            success: false,
            error: 'No tenant found',
          },
          { status: 404 }
        );
      }
      targetTenantId = tenant.id;
    }

    // Queue the job
    const job = await queueAtlassianOrdersCheck(targetTenantId, folderPath, deleteAfterProcessing);

    console.log(`✓ Queued Atlassian orders check for tenant ${targetTenantId}`);

    return NextResponse.json({
      success: true,
      message: 'Atlassian orders check queued',
      jobId: job.id,
      tenantId: targetTenantId,
    });
  } catch (error) {
    console.error('Error queueing Atlassian orders check:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

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
      const searchField = searchParams.get('searchField') || 'all';

      const searchConditions: Record<string, any[]> = {
        all: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { fullName: { contains: search, mode: 'insensitive' } },
          { printName: { contains: search, mode: 'insensitive' } },
          { personalEmail: { contains: search, mode: 'insensitive' } },
          { workEmail: { contains: search, mode: 'insensitive' } },
          { paceJobNumber: { contains: search, mode: 'insensitive' } },
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { address1: { contains: search, mode: 'insensitive' } },
          { address2: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
          { state: { contains: search, mode: 'insensitive' } },
          { zipCode: { contains: search, mode: 'insensitive' } },
        ],
        name: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { fullName: { contains: search, mode: 'insensitive' } },
          { printName: { contains: search, mode: 'insensitive' } },
        ],
        email: [
          { personalEmail: { contains: search, mode: 'insensitive' } },
          { workEmail: { contains: search, mode: 'insensitive' } },
        ],
        paceJob: [
          { paceJobNumber: { contains: search, mode: 'insensitive' } },
        ],
        orderNumber: [
          { orderNumber: { contains: search, mode: 'insensitive' } },
        ],
        address: [
          { address1: { contains: search, mode: 'insensitive' } },
          { address2: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
          { state: { contains: search, mode: 'insensitive' } },
          { zipCode: { contains: search, mode: 'insensitive' } },
        ],
      };

      where.OR = searchConditions[searchField] || searchConditions.all;
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
            emailSubject: true,
            emailFrom: true,
            emailDate: true,
            status: true,
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
            createdAt: true,
            processedAt: true,
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

    // Get counts for each category (across ALL orders, not just paginated)
    const [
      readyToSendCount,
      sentToPaceCount,
      duplicatesCount,
      archivedCount,
      philippinesCount,
      australiaCount,
      indiaCount,
      usaCount,
      internationalCount,
      missingCount,
      // Sent to PACE by country
      sentPhilippinesCount,
      sentAustraliaCount,
      sentIndiaCount,
      sentUsaCount,
      sentInternationalCount,
    ] = await Promise.all([
      // Ready to send: completed or pending, NOT duplicates
      db.atlassianOrder.count({
        where: {
          OR: [{ status: 'completed' }, { status: 'pending' }],
          duplicateOfOrderId: null,
        },
      }),
      // Sent to PACE
      db.atlassianOrder.count({
        where: { status: 'sent_to_pace' },
      }),
      // Duplicates
      db.atlassianOrder.count({
        where: {
          OR: [{ status: 'potential_duplicate' }, { duplicateOfOrderId: { not: null } }],
        },
      }),
      // Archived
      db.atlassianOrder.count({
        where: { status: 'archived' },
      }),
      // Philippines (only ready to process: completed or pending, not duplicates)
      db.atlassianOrder.count({
        where: { countryCategory: 'Philippines', status: { in: ['completed', 'pending'] }, duplicateOfOrderId: null },
      }),
      // Australia (only ready to process: completed or pending, not duplicates)
      db.atlassianOrder.count({
        where: { countryCategory: 'Australia', status: { in: ['completed', 'pending'] }, duplicateOfOrderId: null },
      }),
      // India (only ready to process: completed or pending, not duplicates)
      db.atlassianOrder.count({
        where: { countryCategory: 'India', status: { in: ['completed', 'pending'] }, duplicateOfOrderId: null },
      }),
      // USA (only ready to process: completed or pending, not duplicates)
      db.atlassianOrder.count({
        where: { countryCategory: 'United States of America', status: { in: ['completed', 'pending'] }, duplicateOfOrderId: null },
      }),
      // International (only ready to process: completed or pending, not duplicates)
      db.atlassianOrder.count({
        where: { countryCategory: 'International US', status: { in: ['completed', 'pending'] }, duplicateOfOrderId: null },
      }),
      // Missing address
      db.atlassianOrder.count({
        where: { status: 'missing_address' },
      }),
      // Sent to PACE - Philippines
      db.atlassianOrder.count({
        where: { countryCategory: 'Philippines', status: 'sent_to_pace' },
      }),
      // Sent to PACE - Australia
      db.atlassianOrder.count({
        where: { countryCategory: 'Australia', status: 'sent_to_pace' },
      }),
      // Sent to PACE - India
      db.atlassianOrder.count({
        where: { countryCategory: 'India', status: 'sent_to_pace' },
      }),
      // Sent to PACE - USA
      db.atlassianOrder.count({
        where: { countryCategory: 'United States of America', status: 'sent_to_pace' },
      }),
      // Sent to PACE - International
      db.atlassianOrder.count({
        where: { countryCategory: 'International US', status: 'sent_to_pace' },
      }),
    ]);

    const counts = {
      all: totalCount,
      readyToSend: readyToSendCount,
      sentToPace: sentToPaceCount,
      duplicates: duplicatesCount,
      archived: archivedCount,
      philippines: philippinesCount,
      australia: australiaCount,
      india: indiaCount,
      usa: usaCount,
      international: internationalCount,
      missing: missingCount,
      // Sent to PACE by country
      sentPhilippines: sentPhilippinesCount,
      sentAustralia: sentAustraliaCount,
      sentIndia: sentIndiaCount,
      sentUsa: sentUsaCount,
      sentInternational: sentInternationalCount,
    };

    return NextResponse.json({
      success: true,
      data: orders,
      totalCount,
      limit,
      offset,
      counts,
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

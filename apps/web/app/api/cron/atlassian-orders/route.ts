import { NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/database';
import { queueAtlassianOrdersCheck } from '@/lib/queue/atlassian-orders-queue';
import { getCronSecret } from '@repo/shared';

/**
 * Cron endpoint to automatically check for new Atlassian orders
 *
 * This endpoint should be called periodically (e.g., every 15 minutes) by a cron service
 * such as Dokploy Schedule Jobs, GitHub Actions, or external services like cron-job.org
 *
 * Example cron schedule: 'star/15 * * * *' (every 15 minutes) - replace 'star' with *
 *
 * For Dokploy Schedule Jobs:
 * - Type: "Dokploy Server Jobs"
 * - Schedule: 'star/15 * * * *' (replace 'star' with *)
 * - Script: curl -X GET -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/atlassian-orders
 *
 * Authorization: Uses CRON_SECRET from AWS Secrets Manager (calitho-suite/cron)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret from AWS Secrets Manager
    const authHeader = request.headers.get('authorization');

    let cronSecret: string | undefined;
    try {
      cronSecret = await getCronSecret();
    } catch (error) {
      console.error('Failed to fetch CRON_SECRET from AWS Secrets Manager:', error);
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (cronSecret) {
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        console.warn('Atlassian orders cron called with invalid/missing authorization');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Get all active tenants
    const tenants = await db.tenant.findMany({
      where: {
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (tenants.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active tenants found',
        queued: 0,
      });
    }

    const results = [];

    // Queue a check for each tenant
    for (const tenant of tenants) {
      try {
        const job = await queueAtlassianOrdersCheck(
          tenant.id,
          'AtlassianOrders', // Default folder
          true // Delete after processing
        );

        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          jobId: job.id,
          status: 'queued',
        });

        console.log(`✓ Queued Atlassian orders check for tenant ${tenant.name} (${tenant.id})`);
      } catch (error) {
        console.error(`Failed to queue check for tenant ${tenant.name}:`, error);
        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'queued').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      message: `Queued Atlassian orders check for ${successCount} tenant(s)`,
      queued: successCount,
      failed: failedCount,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in Atlassian orders cron:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Handle POST for manual triggers (useful for testing)
export async function POST(request: NextRequest) {
  return GET(request);
}

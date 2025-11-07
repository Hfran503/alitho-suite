import { NextRequest, NextResponse } from 'next/server';
import { getCronSecret, saveCronSecret } from '@repo/shared';
import { getServerSession } from 'next-auth';

/**
 * GET /api/settings/cron-secret
 * Get the cron secret (masked for security)
 */
export async function GET() {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let cronSecret: string | undefined;
    let configured = false;

    try {
      cronSecret = await getCronSecret();
      configured = true;
    } catch (error) {
      // Secret not configured yet
      configured = false;
    }

    // Return masked secret for security (only show last 4 characters)
    const maskedSecret = cronSecret
      ? `${'*'.repeat(cronSecret.length - 4)}${cronSecret.slice(-4)}`
      : undefined;

    return NextResponse.json({
      success: true,
      data: {
        configured,
        maskedSecret,
        secretName: 'calitho-suite/cron',
      },
    });
  } catch (error) {
    console.error('Error fetching cron secret:', error);

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
 * POST /api/settings/cron-secret
 * Save the cron secret to AWS Secrets Manager
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { cronSecret } = body;

    if (!cronSecret || typeof cronSecret !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'cronSecret is required and must be a string',
        },
        { status: 400 }
      );
    }

    // Validate minimum length
    if (cronSecret.length < 32) {
      return NextResponse.json(
        {
          success: false,
          error: 'CRON_SECRET must be at least 32 characters long for security',
        },
        { status: 400 }
      );
    }

    // Save to AWS Secrets Manager
    await saveCronSecret(cronSecret);

    console.log('✓ CRON_SECRET saved to AWS Secrets Manager');

    return NextResponse.json({
      success: true,
      message: 'CRON_SECRET saved successfully to AWS Secrets Manager',
      secretName: 'calitho-suite/cron',
    });
  } catch (error) {
    console.error('Error saving cron secret:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

# EasyPost Integration Guide

This document explains how to configure and use the EasyPost shipping integration in the Calitho CRM/ERP system.

## Overview

The EasyPost integration allows you to:
- Create shipping labels
- Track packages
- Get shipping rates from multiple carriers
- Manage shipments across different carriers

All EasyPost credentials are securely stored in **AWS Secrets Manager** (not in the database) and are tenant-scoped.

## Configuration

### 1. Get Your EasyPost API Key

1. Sign up for an account at [https://easypost.com](https://easypost.com)
2. Navigate to your API keys section in the EasyPost dashboard
3. Copy your API key (starts with `EZAK` for production or `EZTK` for test mode)

### 2. Configure in the Application

1. Navigate to **Settings → Integrations** in your application
2. Find the **EasyPost** card and click **Connect**
3. Paste your API key in the modal
4. Click **Test Connection** to verify the API key is valid
5. Click **Save** to store the credentials securely in AWS Secrets Manager

### 3. Security

- API keys are stored in AWS Secrets Manager at: `calitho-suite/integrations/easypost/{tenantId}`
- Credentials are **never** stored in the database
- Credentials are **never** exposed in API responses
- Each tenant has their own isolated credentials
- API keys are cached in memory to reduce AWS API calls

## Using the Integration

### In Your Code

#### Option 1: Use the Helper Function (Recommended)

```typescript
import { getEasyPostClient } from '@/lib/easypost'

// In your API route or server component
const client = await getEasyPostClient(tenantId)

// Now use the EasyPost client
const shipment = await client.Shipment.create({
  from_address: {
    street1: '417 MONTGOMERY ST',
    street2: 'FLOOR 5',
    city: 'SAN FRANCISCO',
    state: 'CA',
    zip: '94104',
    country: 'US',
  },
  to_address: {
    name: 'Dr. Steve Brule',
    street1: '179 N Harbor Dr',
    city: 'Redondo Beach',
    state: 'CA',
    zip: '90277',
    country: 'US',
  },
  parcel: {
    length: 8,
    width: 5,
    height: 5,
    weight: 5,
  },
})

// Buy the shipment with the lowest rate
const boughtShipment = await client.Shipment.buy(
  shipment.id,
  shipment.lowestRate()
)
```

#### Option 2: Direct Access

```typescript
import { getEasyPostApiKey } from '@/lib/secrets'
import EasyPost from '@easypost/api'

const apiKey = await getEasyPostApiKey(tenantId)
const client = new EasyPost(apiKey)
```

### Check if Configured

```typescript
import { isEasyPostConfigured } from '@/lib/easypost'

const configured = await isEasyPostConfigured(tenantId)
if (!configured) {
  // Show message to configure integration
}
```

### Database Integration Status

```typescript
import { db } from '@repo/database'

const integration = await db.integration.findUnique({
  where: {
    tenantId_provider: {
      tenantId: tenantId,
      provider: 'easypost',
    },
  },
})

if (integration?.enabled) {
  // Integration is configured and enabled
}
```

## API Endpoints

### GET /api/integrations/easypost

Check if EasyPost is configured for the current user's tenant.

**Response:**
```json
{
  "success": true,
  "data": {
    "configured": true,
    "enabled": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### POST /api/integrations/easypost

Save or update EasyPost credentials.

**Request:**
```json
{
  "apiKey": "EZAK...",
  "config": {
    "mode": "test"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "EasyPost integration configured successfully",
  "data": {
    "configured": true,
    "enabled": true
  }
}
```

### POST /api/integrations/easypost/test

Test an EasyPost API key without saving it.

**Request:**
```json
{
  "apiKey": "EZAK..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "API key is valid",
  "data": {
    "valid": true,
    "accountName": "My Company",
    "accountEmail": "api@example.com"
  }
}
```

### DELETE /api/integrations/easypost

Remove EasyPost integration (soft delete - disables the integration and schedules API key deletion).

**Response:**
```json
{
  "success": true,
  "message": "EasyPost integration removed successfully"
}
```

## Database Schema

### Integration Model

```prisma
model Integration {
  id          String   @id @default(cuid())
  provider    String   // "easypost"
  enabled     Boolean  @default(true)
  config      Json?    // Non-sensitive config (e.g., mode, webhooks)
  secretName  String?  // AWS Secrets Manager reference
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, provider])
}
```

## AWS Secrets Manager

### Secret Format

- **Name:** `calitho-suite/integrations/easypost/{tenantId}`
- **Type:** Plain text (not JSON)
- **Value:** The EasyPost API key string
- **Tags:**
  - `Application: calitho-suite`
  - `Integration: easypost`
  - `TenantId: {tenantId}`

### IAM Permissions Required

Your application needs the following IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:CreateSecret",
        "secretsmanager:UpdateSecret",
        "secretsmanager:DeleteSecret",
        "secretsmanager:TagResource"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:calitho-suite/integrations/*"
    }
  ]
}
```

## Example: Creating a Shipment

Here's a complete example of creating and buying a shipment in an API route:

```typescript
// app/api/shipments/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getEasyPostClient } from '@/lib/easypost'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Get EasyPost client for this tenant
    const easypost = await getEasyPostClient(membership.tenantId)

    // Parse request body
    const { fromAddress, toAddress, parcel } = await req.json()

    // Create shipment
    const shipment = await easypost.Shipment.create({
      from_address: fromAddress,
      to_address: toAddress,
      parcel: parcel,
    })

    // Buy with lowest rate
    const boughtShipment = await easypost.Shipment.buy(
      shipment.id,
      shipment.lowestRate()
    )

    return NextResponse.json({
      success: true,
      data: {
        id: boughtShipment.id,
        trackingCode: boughtShipment.tracking_code,
        labelUrl: boughtShipment.postage_label?.label_url,
        rate: boughtShipment.selected_rate,
      },
    })
  } catch (error: any) {
    console.error('Create shipment error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create shipment' },
      { status: 500 }
    )
  }
}
```

## Troubleshooting

### "EasyPost API key not found for tenant"

This means the integration hasn't been configured yet. Direct the user to Settings → Integrations to configure EasyPost.

### "Invalid API key"

The API key stored in AWS Secrets Manager is invalid. Have the user reconfigure the integration with a valid key.

### AWS Secrets Manager Access Denied

Check that your application's IAM role has the correct permissions to access secrets at `calitho-suite/integrations/easypost/*`.

### Test vs Production Mode

- Test API keys start with `EZTK`
- Production API keys start with `EZAK`
- Make sure you're using the correct mode for your environment

## Additional Resources

- [EasyPost API Documentation](https://www.easypost.com/docs/api)
- [EasyPost Node.js Client Library](https://github.com/EasyPost/easypost-node)
- [EasyPost Rate Limiting](https://www.easypost.com/docs/api#rate-limiting)
- [EasyPost Error Codes](https://www.easypost.com/docs/api#errors)

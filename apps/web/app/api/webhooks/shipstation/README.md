# ShipStation Webhook Setup Guide

This directory contains webhook endpoints for receiving real-time tracking updates from ShipStation/ShipEngine.

## Webhook Endpoint

**URL**: `https://your-domain.com/api/webhooks/shipstation/track`
**Method**: `POST`
**Event Type**: `track`

## What It Does

When you register this webhook with ShipStation, you'll automatically receive tracking updates for all your shipments, including:

- ✅ Package accepted by carrier
- 📦 In transit updates
- 📬 Delivery confirmation
- ⚠️ Exceptions (delays, failed delivery attempts, etc.)
- 📍 Location updates with timestamp

The webhook will:
1. Find the shipping label by tracking number
2. Update the `trackingStatus` and `lastTrackedAt` fields
3. Store detailed tracking info in the `metadata` field
4. Mark label as `delivered` when package is delivered
5. Create audit log entry for tracking changes

## Setting Up the Webhook

### Step 1: Register the Webhook with ShipStation

You can register webhooks via the ShipStation API:

```bash
curl -X POST https://api.shipengine.com/v1/environment/webhooks \
  -H "API-Key: YOUR_SHIPSTATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/api/webhooks/shipstation/track",
    "event": "track"
  }'
```

### Step 2: Verify the Webhook

Test the webhook by visiting:
```
GET https://your-domain.com/api/webhooks/shipstation/track
```

You should see a JSON response confirming the endpoint is active.

### Step 3: Test with Sample Payload

Use a tool like Postman or curl to send a test webhook:

```bash
curl -X POST https://your-domain.com/api/webhooks/shipstation/track \
  -H "Content-Type: application/json" \
  -H "User-Agent: ShipEngine/v1" \
  -d @test-payload.json
```

### Sample Test Payload

Create a `test-payload.json` file:

```json
{
  "resource_url": "https://api.shipengine.com/v1/tracking?carrier_code=ups&tracking_number=1Z9634841399247181",
  "resource_type": "API_TRACK",
  "data": {
    "label_url": null,
    "tracking_number": "1Z9634841399247181",
    "status_code": "IT",
    "carrier_detail_code": null,
    "status_description": "In Transit",
    "carrier_status_code": "NT",
    "carrier_status_description": "Your package is moving within the UPS network",
    "ship_date": "2025-10-22T16:09:00",
    "estimated_delivery_date": "2025-10-23T00:00:00",
    "actual_delivery_date": null,
    "exception_description": null,
    "events": [
      {
        "occurred_at": "2025-10-22T20:00:00Z",
        "carrier_occurred_at": "2025-10-22T16:00:00",
        "description": "In Transit",
        "city_locality": "Oakland",
        "state_province": "CA",
        "postal_code": "94602",
        "country_code": "US",
        "company_name": "",
        "signer": "",
        "event_code": "IT",
        "event_description": "In Transit",
        "carrier_detail_code": null,
        "status_code": null,
        "latitude": 37.8044,
        "longitude": -122.2712
      }
    ]
  }
}
```

## Tracking Status Codes

The webhook maps ShipEngine status codes to our internal tracking statuses:

| ShipEngine Code | Internal Status | Description |
|-----------------|-----------------|-------------|
| `UN` | `unknown` | Carrier has not yet provided status |
| `AC` | `accepted` | Package accepted by carrier |
| `IT` | `in_transit` | Package is in transit |
| `DE` | `delivered` | Package has been delivered |
| `EX` | `exception` | Exception occurred (delay, weather, etc.) |
| `AT` | `attempted_delivery` | Delivery attempted but unsuccessful |
| `NY` | `not_yet_in_system` | Tracking info not yet available |

## Database Fields Updated

When a webhook is received, the following fields are updated in the `ShippingLabel` table:

- `trackingStatus` - The mapped internal status
- `lastTrackedAt` - Timestamp of the last tracking update
- `status` - Set to `"delivered"` when status_code is `"DE"`
- `metadata.tracking` - Full tracking details including:
  - Status codes and descriptions
  - Delivery dates
  - Latest tracking event
  - Location information

## Custom Business Logic

You can add custom logic in the webhook handler for specific events:

### Example: Send Email on Delivery

```typescript
if (payload.data.status_code === 'DE') {
  // Package was delivered
  const shipTo = updatedLabel.shipTo as any
  await sendDeliveryNotificationEmail(shipTo.email, {
    trackingNumber: updatedLabel.trackingNumber,
    deliveredAt: payload.data.actual_delivery_date,
  })
}
```

### Example: Alert on Exceptions

```typescript
if (payload.data.status_code === 'EX') {
  // Exception occurred
  await sendExceptionAlert({
    trackingNumber: updatedLabel.trackingNumber,
    exception: payload.data.exception_description,
    customer: shipTo,
  })
}
```

## Security

The webhook handler checks for:
1. **User-Agent validation**: Confirms requests come from `ShipEngine`
2. **Graceful error handling**: Returns 200 even on errors to prevent retries
3. **Audit logging**: All updates are logged to the `AuditLog` table

### Optional: Add Basic Authentication

For additional security, you can add HTTP Basic Auth to your webhook URL:

```
https://username:password@your-domain.com/api/webhooks/shipstation/track
```

Register this URL with ShipStation, and only requests with the correct credentials will be processed.

## Monitoring

### View Recent Webhooks

Check the `AuditLog` table for recent webhook activity:

```sql
SELECT * FROM "AuditLog"
WHERE action = 'tracking_update'
ORDER BY "createdAt" DESC
LIMIT 10;
```

### Check Tracking Status

View all labels with their tracking status:

```sql
SELECT
  "trackingNumber",
  "trackingStatus",
  "lastTrackedAt",
  status,
  carrier
FROM "ShippingLabel"
WHERE "trackingStatus" IS NOT NULL
ORDER BY "lastTrackedAt" DESC;
```

## Troubleshooting

### Webhook Not Receiving Events

1. Verify webhook is registered:
   ```bash
   curl https://api.shipengine.com/v1/environment/webhooks \
     -H "API-Key: YOUR_API_KEY"
   ```

2. Check webhook logs in ShipStation dashboard
3. Verify your URL is publicly accessible (not localhost)
4. Check firewall/security group settings

### Testing Locally with ngrok

For local development, use ngrok to expose your local server:

```bash
# Start your local dev server
npm run dev

# In another terminal, start ngrok
ngrok http 3000

# Use the ngrok URL for your webhook
https://your-ngrok-url.ngrok.io/api/webhooks/shipstation/track
```

## Support

For issues with:
- ShipStation API: https://www.shipengine.com/docs/
- Webhook setup: Contact your development team
- Production issues: Check application logs and AuditLog table

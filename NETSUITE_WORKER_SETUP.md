# NetSuite Invoice Background Worker Setup

This document explains how the automatic NetSuite invoice processing works and how to run the background worker.

## Overview

When PACE sends invoice data to the webhook (`/api/webhooks/pace/invoice`), the system:

1. **Stores** the invoice data in the database
2. **Queues** the invoice for processing using BullMQ
3. **Background worker** picks up the job and sends it to NetSuite
4. **Automatic retries** on failure (up to 3 attempts with exponential backoff)
5. **One invoice at a time** to avoid rate limits and ensure proper processing

## Architecture

```
PACE Webhook → Database → BullMQ Queue → Worker → NetSuite
                           (Redis)
```

### Components:

1. **Webhook** (`apps/web/app/api/webhooks/pace/invoice/route.ts`)
   - Receives invoices from PACE
   - Stores in database
   - Enqueues job to Redis

2. **Queue** (`apps/web/lib/queue/netsuite-invoice-queue.ts`)
   - Manages job queue using BullMQ
   - Handles job creation and status tracking

3. **Worker** (`apps/web/lib/queue/netsuite-invoice-worker.ts`)
   - Processes jobs from the queue
   - Sends invoices to NetSuite
   - Updates database with results

## Prerequisites

### 1. Redis Server

The queue system requires Redis. Make sure Redis is running:

**Local Development:**
```bash
# Install Redis (macOS)
brew install redis

# Start Redis
brew services start redis

# Or run manually
redis-server
```

**Production:**
- Use a managed Redis service (AWS ElastiCache, Redis Cloud, etc.)
- Set `REDIS_HOST` and `REDIS_PORT` in environment variables

### 2. Environment Variables

Add to your `.env` file:

```bash
# Redis Configuration
REDIS_HOST=localhost  # Or your Redis host
REDIS_PORT=6379       # Default Redis port

# NetSuite Configuration (already configured)
NETSUITE_RESTLET_URL=https://...
AWS_REGION=us-west-2

# PACE Webhook Authentication
PACE_WEBHOOK_USERNAME=your_username
PACE_WEBHOOK_PASSWORD=your_password
```

## Running the Worker

### Development

Run the worker in a **separate terminal** from your Next.js dev server:

```bash
# Terminal 1: Next.js dev server
pnpm dev

# Terminal 2: Background worker
cd apps/web
pnpm worker
```

You should see:
```
🚀 Background Workers started
📦 Redis: localhost
📋 Workers:
   - Batch Import Worker
   - NetSuite Invoice Worker
🚀 NetSuite Invoice Worker started
⏳ Waiting for invoice jobs...
```

### Production

Use a process manager like PM2 or run as a system service:

```bash
# Using PM2
pm2 start "pnpm worker" --name netsuite-worker

# Or as a systemd service
sudo systemctl start netsuite-worker
```

## How It Works

### 1. Invoice Arrives from PACE

```
POST /api/webhooks/pace/invoice
{
  "invoice": { ... },
  "salesDistributions": [ ... ],
  "invoiceExtras": [ ... ]
}
```

### 2. Webhook Processes Request

```typescript
// Store in database
const invoice = await db.invoiceIntegration.create({
  data: {
    invoiceNumber: "55686",
    status: "pending",
    payload: webhookData
  }
})

// Queue for processing
await queueNetsuiteInvoice(invoice.id, invoice.invoiceNumber)
```

### 3. Worker Picks Up Job

The worker:
1. ✅ Retrieves invoice from database
2. ✅ Gets NetSuite credentials
3. ✅ Generates OAuth signature
4. ✅ Sends to NetSuite RESTlet
5. ✅ Updates database with result

### 4. Automatic Retries

If sending fails, BullMQ automatically retries:
- **Attempt 1**: Immediate
- **Attempt 2**: After 5 seconds
- **Attempt 3**: After 25 seconds (exponential backoff)

After 3 failures, the job is marked as failed and kept for debugging.

## Queue Configuration

### Concurrency

The worker processes **1 invoice at a time** (`concurrency: 1`) to:
- Avoid overwhelming NetSuite
- Prevent rate limit issues
- Ensure proper error handling

### Rate Limiting

Maximum of **10 jobs per 60 seconds** to comply with NetSuite API limits.

### Job Retention

- **Completed jobs**: Keep last 500 for 7 days
- **Failed jobs**: Keep last 1000 for debugging

## Monitoring

### Check Queue Status

Add an API endpoint to check queue health:

```typescript
// apps/web/app/api/queue/status/route.ts
import { netsuiteInvoiceQueue } from '@/lib/queue/netsuite-invoice-queue'

export async function GET() {
  const counts = await netsuiteInvoiceQueue.getJobCounts()
  return Response.json(counts)
}
```

Returns:
```json
{
  "waiting": 5,
  "active": 1,
  "completed": 123,
  "failed": 2,
  "delayed": 0
}
```

### Check Individual Job Status

```typescript
import { getNetsuiteInvoiceJobStatus } from '@/lib/queue/netsuite-invoice-queue'

const status = await getNetsuiteInvoiceJobStatus(invoiceIntegrationId)
console.log(status)
// {
//   id: "invoice-xyz123",
//   state: "completed",
//   progress: 100,
//   attempts: 1,
//   returnValue: { success: true, netsuiteInvoiceId: "333931" }
// }
```

### Worker Logs

The worker logs all activity:

```
🔄 [Job invoice-xyz123] Processing invoice 55686 (attempt 1)
📤 [Job invoice-xyz123] Sending invoice 55686 to NetSuite...
📥 NetSuite response: { status: 200, success: true }
✅ [Job invoice-xyz123] Invoice 55686 sent successfully! NetSuite ID: 333931
```

## Troubleshooting

### Worker Not Processing Jobs

**Check if worker is running:**
```bash
ps aux | grep worker
```

**Check Redis connection:**
```bash
redis-cli ping
# Should return: PONG
```

**Check worker logs:**
```bash
# If using PM2
pm2 logs netsuite-worker
```

### Jobs Stuck in Queue

**Clear stuck jobs:**
```typescript
// In a script or API endpoint
import { netsuiteInvoiceQueue } from '@/lib/queue/netsuite-invoice-queue'

// Clean failed jobs older than 1 hour
await netsuiteInvoiceQueue.clean(3600000, 0, 'failed')

// Clean completed jobs older than 1 day
await netsuiteInvoiceQueue.clean(86400000, 0, 'completed')
```

### Invoice Failed to Send

1. Check the `InvoiceIntegration` record in database:
   - `status`: Should be "failed"
   - `errorMessage`: Contains the error details
   - `retryCount`: Number of attempts made

2. Check NetSuite RESTlet logs in NetSuite

3. Manually retry from UI (existing "Send to NetSuite" button)

### Redis Connection Issues

**Error: "ECONNREFUSED"**
- Redis is not running
- Wrong `REDIS_HOST` or `REDIS_PORT`

**Solution:**
```bash
# Start Redis
brew services start redis

# Or check if it's running
redis-cli ping
```

## Testing

### Manual Testing

1. **Start the worker:**
   ```bash
   cd apps/web
   pnpm worker
   ```

2. **Send a test webhook:**
   ```bash
   curl -X POST http://localhost:3000/api/webhooks/pace/invoice \
     -H "Content-Type: application/json" \
     -H "Authorization: Basic $(echo -n 'username:password' | base64)" \
     -d @test-invoice.json
   ```

3. **Watch the logs:**
   - Worker terminal shows processing
   - Invoice should appear in NetSuite within seconds

### Check Database

```sql
-- View pending invoices
SELECT * FROM "InvoiceIntegration"
WHERE status = 'pending'
ORDER BY "createdAt" DESC;

-- View processing/completed invoices
SELECT * FROM "InvoiceIntegration"
WHERE status IN ('processing', 'completed')
ORDER BY "updatedAt" DESC
LIMIT 10;

-- View failed invoices
SELECT * FROM "InvoiceIntegration"
WHERE status = 'failed'
ORDER BY "updatedAt" DESC;
```

## Deployment

### Docker

Add to your `docker-compose.yml`:

```yaml
services:
  web:
    # Your Next.js app
    ...

  worker:
    build: .
    command: pnpm worker
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - DATABASE_URL=${DATABASE_URL}
      - NETSUITE_RESTLET_URL=${NETSUITE_RESTLET_URL}
      - AWS_REGION=${AWS_REGION}
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### Systemd Service

Create `/etc/systemd/system/netsuite-worker.service`:

```ini
[Unit]
Description=NetSuite Invoice Worker
After=network.target redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/calitho-suite
ExecStart=/usr/bin/pnpm worker
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable netsuite-worker
sudo systemctl start netsuite-worker
sudo systemctl status netsuite-worker
```

## Benefits

✅ **Automatic Processing** - No manual intervention needed
✅ **Resilient** - Automatic retries on failure
✅ **Sequential** - Processes one invoice at a time
✅ **Observable** - Full logging and monitoring
✅ **Scalable** - Can run multiple workers if needed
✅ **Reliable** - Jobs are persisted in Redis

## Next Steps

1. ✅ Start the worker process
2. ✅ Configure PACE to send webhooks
3. ✅ Monitor the logs
4. ✅ Set up alerts for failed jobs (optional)
5. ✅ Create a dashboard to view queue status (optional)

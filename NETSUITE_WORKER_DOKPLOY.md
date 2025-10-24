# NetSuite Worker Deployment on Dokploy

## Overview

The NetSuite invoice worker is now integrated into the main worker service. When you deploy your application on Dokploy, the worker container will automatically start processing NetSuite invoice jobs.

## What Changed

Previously, the NetSuite worker was a separate script in `apps/web/scripts/start-worker.ts`. It has now been **integrated into the main worker service** at `apps/worker/jobs/netsuite-invoice.ts`.

## Deployment Steps for Dokploy

### 1. Add Required Environment Variables

In Dokploy, make sure BOTH the **web** and **worker** services have these environment variables:

**Required for NetSuite:**
```bash
NETSUITE_RESTLET_URL=https://your-account.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=xxx&deploy=1
AWS_REGION=us-west-2
```

**Required for Queue:**
```bash
REDIS_URL=redis://your-redis-host:6379
# OR for Upstash Redis:
REDIS_URL=rediss://default:your-password@your-host.upstash.io:6379
```

**Required for Database:**
```bash
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
```

### 2. Configure in Dokploy

#### Option A: Using Dokploy Compose File
If using docker-compose in Dokploy, the worker service is already configured in `docker-compose.yml`:

```yaml
worker:
  build:
    context: .
    dockerfile: ./apps/worker/Dockerfile
  restart: unless-stopped
  environment:
    NODE_ENV: production
    DATABASE_URL: ${DATABASE_URL}
    REDIS_URL: ${REDIS_URL}
    NETSUITE_RESTLET_URL: ${NETSUITE_RESTLET_URL}
    AWS_REGION: ${AWS_REGION}
    # ... other vars
```

#### Option B: Separate Service in Dokploy
If managing services separately:

1. Create a new **Application** in Dokploy for the worker
2. Use the same repository and branch as your web app
3. Set the **Dockerfile path** to: `./apps/worker/Dockerfile`
4. Add all required environment variables
5. Deploy

### 3. Verify Worker is Running

After deployment, check the worker logs in Dokploy:

**Expected output:**
```
🔍 Environment check:
   NODE_ENV: production
   REDIS_URL: redis://...
🚀 Worker started successfully
📋 Running 6 workers:
   - export-queue
   - pdf-queue
   - email-queue
   - webhook-queue
   - batch-import
   - netsuite-invoice
🚀 NetSuite Invoice Worker started
⏳ Waiting for NetSuite invoice jobs...
```

### 4. Test Invoice Processing

1. Send a test invoice via the PACE webhook:
   ```bash
   curl -X POST https://your-domain.com/api/webhooks/pace/invoice \
     -H "Content-Type: application/json" \
     -H "Authorization: Basic base64(username:password)" \
     -d @test-invoice.json
   ```

2. Check the web app logs for:
   ```
   🔄 Queueing NetSuite invoice 55849-1 for processing...
   🔄 Queued invoice 55849-1 for NetSuite processing
   ```

3. Check the worker logs for:
   ```
   🔄 [Job invoice-xyz] Processing invoice 55849-1 (attempt 1)
   📤 [Job invoice-xyz] Sending invoice 55849-1 to NetSuite...
   ✅ [Job invoice-xyz] Invoice 55849-1 sent successfully! NetSuite ID: 333931
   ```

## Troubleshooting

### Issue: Worker Not Processing Jobs

**Symptoms:**
- Web logs show "Queueing NetSuite invoice..." but no processing happens
- No worker logs appearing

**Solution:**
1. Verify worker service is running:
   - In Dokploy, check the worker service status
   - Should show "Running" or "Healthy"

2. Check worker logs for errors:
   - Look for Redis connection errors
   - Look for "NetSuite Invoice Worker started" message

3. Verify environment variables:
   - `REDIS_URL` must be set
   - `NETSUITE_RESTLET_URL` must be set
   - `DATABASE_URL` must be set

### Issue: "NetSuite integration not configured"

**Solution:**
1. Log into your app
2. Go to Settings > Integrations > NetSuite
3. Configure NetSuite credentials
4. Enable sandbox or production mode

### Issue: "Missing credentials for sandbox/production mode"

**Solution:**
- Verify AWS Secrets Manager has the NetSuite credentials
- Check `AWS_REGION` is correct
- Verify IAM permissions for Secrets Manager access

### Issue: Worker Keeps Restarting

**Solution:**
1. Check worker logs for crash errors
2. Verify all environment variables are set
3. Check Redis is accessible from worker
4. Verify database migrations are complete

## Environment Variables Reference

### Web Service
```bash
# Same as before, plus:
NETSUITE_RESTLET_URL=https://...
AWS_REGION=us-west-2
REDIS_URL=redis://...
```

### Worker Service
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
NETSUITE_RESTLET_URL=https://...
AWS_REGION=us-west-2
S3_BUCKET=your-bucket
S3_REGION=us-west-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

## Monitoring

### Check Queue Status
Add this endpoint to monitor queue health:

**GET /api/queue/status**
```json
{
  "waiting": 5,
  "active": 1,
  "completed": 123,
  "failed": 2,
  "delayed": 0
}
```

### Check Worker Health
Monitor worker logs for:
- ✅ Successful processing: `✅ Invoice X sent successfully`
- ❌ Failed attempts: `❌ Job X failed:`
- 🔄 Retries: `Processing invoice X (attempt 2)`

## Benefits of Integrated Worker

✅ **Simpler Deployment** - One worker service handles all jobs
✅ **Shared Configuration** - Same Redis and database connections
✅ **Better Monitoring** - All workers in one place
✅ **Automatic Scaling** - Scale worker service as needed
✅ **Unified Logging** - All job logs in one stream

## Next Steps

1. ✅ Deploy updated code to Dokploy
2. ✅ Verify worker service is running
3. ✅ Test invoice webhook
4. ✅ Monitor worker logs
5. ✅ Set up alerts for failed jobs (optional)

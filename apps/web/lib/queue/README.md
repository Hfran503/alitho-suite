# Batch Import Worker

This directory contains the BullMQ queue and worker for processing batch shipment imports.

## Architecture

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Web App       │─────>│    Redis     │<─────│   Worker        │
│   (API Routes)  │      │   (Queue)    │      │   (Background)  │
└─────────────────┘      └──────────────┘      └─────────────────┘
         │                                               │
         │                                               │
         ▼                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Neon)                            │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │BatchImport │─>│BatchImportRow│  │ JobShipment / Carton   │ │
│  └────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Files

- **batch-import-queue.ts** - Queue configuration and helper functions
- **batch-import-worker.ts** - Worker that processes batch jobs
- **README.md** - This file

## Running the Worker

### Development

The worker should run as a separate process from the Next.js server:

```bash
# Terminal 1: Start Next.js dev server
pnpm dev

# Terminal 2: Start the worker
cd apps/web
pnpm worker
```

### Production

In production, run the worker as a separate service:

```bash
# Using process manager (PM2, systemd, etc.)
tsx apps/web/scripts/start-worker.ts

# Or with Docker
# Add worker service to docker-compose.yml
```

## Environment Variables

The worker requires these environment variables (same as web app):

```env
# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # Optional

# Database
DATABASE_URL=postgresql://...

# App URL (for internal API calls)
NEXTAUTH_URL=http://localhost:3000
```

## How It Works

### 1. Job Queuing

When a user uploads a CSV and clicks "Process", the API route adds a job to the queue:

```typescript
import { queueBatchImport } from '@/lib/queue/batch-import-queue'

// In your API route
await queueBatchImport(batchId, tenantId)
```

### 2. Worker Processing

The worker:
1. Fetches all PENDING rows from the batch
2. Groups rows by (Job# + Address) for multi-parcel shipments
3. For each group:
   - Creates labels via ShipStation API
   - Creates JobShipment in PACE
   - Creates Cartons in PACE with tracking info
   - Updates row status to SUCCESS or FAILED
4. Updates batch final statistics

### 3. Progress Tracking

The worker updates job progress (0-100%) which can be polled:

```typescript
import { getBatchJobStatus } from '@/lib/queue/batch-import-queue'

const status = await getBatchJobStatus(batchId)
console.log(status.progress) // 0-100
```

## Error Handling

- **Retry**: Failed jobs retry up to 3 times with exponential backoff
- **Row-level**: If one shipment fails, others continue processing
- **Logging**: All errors logged to console with context
- **Database**: Failed rows marked with errorMessage for user review

## Monitoring

### Check Queue Status

```bash
# Use BullMQ UI (install separately)
npm install -g bull-board

# Or use Redis CLI
redis-cli
> KEYS bull:batch-import:*
```

### Logs

Worker logs include:
- Job start/complete events
- Progress updates
- Errors with context
- ShipStation/PACE API responses

## Rate Limiting

The worker has built-in rate limiting:
- Max 10 jobs per second (to avoid ShipStation rate limits)
- Concurrency: 5 batches processed simultaneously
- Configurable in `batch-import-worker.ts`

## Scaling

To handle higher loads:

1. **Horizontal**: Run multiple worker instances
2. **Vertical**: Increase concurrency setting
3. **Priority**: Add priority to large batches
4. **Partitioning**: Separate queues for different carriers

## Troubleshooting

### Worker not processing jobs

1. Check Redis connection:
   ```bash
   redis-cli ping
   ```

2. Check worker is running:
   ```bash
   ps aux | grep start-worker
   ```

3. Check environment variables are set

### Jobs stuck in "active"

This usually means the worker crashed. Restart it:
```bash
pnpm worker
```

### High memory usage

Reduce concurrency or implement pagination for large batches.

## Testing

### Manual test:

```typescript
// Create a test batch in database
const batch = await prisma.batchImport.create({
  data: {
    fileName: 'test.csv',
    tenantId: 'your-tenant-id',
    // ... config
  }
})

// Create test rows
await prisma.batchImportRow.create({
  data: {
    batchImportId: batch.id,
    rowNumber: 1,
    jobNumber: '12345',
    // ... shipment data
  }
})

// Queue the batch
await queueBatchImport(batch.id, 'your-tenant-id')

// Watch worker logs
```

## Future Enhancements

- [ ] Web UI for queue monitoring (Bull Board)
- [ ] Metrics/analytics dashboard
- [ ] Email notifications on completion
- [ ] Pause/resume functionality
- [ ] Batch templates/presets

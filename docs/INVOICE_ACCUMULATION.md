# Invoice Line Item Accumulation

## Problem

PACE can send **multiple webhook calls** for the same invoice number with different internal IDs. This happens when an invoice has multiple parts or components.

## Race Condition Fix (CRITICAL)

**Issue**: When multiple webhook requests arrive within milliseconds (e.g., 5 requests arriving within 220ms), concurrent read-modify-write operations cause data loss.

**Example**: Invoice 56946 was sent as 5 separate webhooks:
- Expected: 5 sales distributions + 8 invoice extras = $2,340.12
- Actual: Only 3 sales distributions + 6 invoice extras = $549.14
- **Lost data**: 2 jobs worth $1,791 were overwritten

**Root Cause**: Read-modify-write without proper locking
```
Request 1: Read [] → Add [A] → Write [A]
Request 2: Read [A] → Add [B] → Write [A, B]
Request 3: Read [A] (before #2 saves!) → Add [C] → Write [A, C]  ← OVERWRITES B!
```

**Solution**: Database-level row locking with `SELECT ... FOR UPDATE`
```typescript
await db.$transaction(async (tx) => {
  // Lock the row - other requests will wait
  const existing = await tx.$queryRaw`
    SELECT * FROM "InvoiceIntegration"
    WHERE "invoiceNumber" = ${invoiceNumber}
    FOR UPDATE
  `

  // Now safe to read, modify, and write
  // Other concurrent requests are blocked until we commit
}, { isolationLevel: 'Serializable' })
```

This ensures **all 5 parts are accumulated correctly** even when arriving simultaneously.

## Tax Amount Accumulation (CRITICAL)

**Issue**: Tax amounts were being overwritten instead of accumulated, causing incorrect totals.

**Example**: Invoice 56954 with 2 parts:
- Part 1 (Job 112724): Sales $50.00, Tax $0.00
- Part 2 (Job 1002485): Sales $735.00, Tax $63.39
- **Expected total**: $50 + $735 + $63.39 = **$848.39**
- **Previous behavior**: $785.00 (tax was overwritten, not added!)

**Solution**: Accumulate tax amounts across all parts
```typescript
// Accumulate tax amounts (don't overwrite!)
const existingTaxAmount = existingPayload.invoice.taxAmount || 0
const newTaxAmount = payload.invoice.taxAmount || 0
const combinedTaxAmount = existingTaxAmount + newTaxAmount

const totalAmount = combinedInvoiceAmount + combinedExtrasAmount + combinedTaxAmount
```

Now correctly sends **$848.39** to NetSuite.

## Processing Delay

To ensure all parts are accumulated before sending to NetSuite, the system uses a **10-second delay**:

```
12:09:33 - Part 1 arrives → Queue with 10s delay (will process at 12:09:43)
12:09:34 - Part 2 arrives → Replace delayed job (now will process at 12:09:44)
12:09:44 - No more parts → Worker sends complete invoice to NetSuite
```

**Key Features:**
- ✅ Each webhook queues with a 10-second delay
- ✅ New parts **replace** the delayed job (resets timer)
- ✅ Uses BullMQ's `jobId` deduplication (only one job per invoice)
- ✅ Worker processes the **final accumulated** version

### Example:

**Invoice 55853-1** is sent in 2 separate webhook calls:

**Call #1 (PACE ID: 19667)**
```json
{
  "invoice": {
    "id": 19667,
    "invoiceNum": "55853-1",
    "invoiceAmount": 495.04,
    "taxAmount": 0
  },
  "salesDistributions": [5 items],
  "invoiceExtras": [
    { "id": 12190, "invoiceExtraTypeName": "Freight", "price": 150.00 },
    { "id": 12191, "invoiceExtraTypeName": "Handling", "price": 25.00 }
  ]
}
```

**Call #2 (PACE ID: 19668)**
```json
{
  "invoice": {
    "id": 19668,
    "invoiceNum": "55853-1",
    "invoiceAmount": 165.00,
    "taxAmount": 35.00
  },
  "salesDistributions": [5 items],
  "invoiceExtras": []
}
```

## Solution

The webhook now **accumulates** line items instead of overwriting:

1. **Deduplicate by ID**: Uses a Map to track unique items by their `id` field
2. **Combine Arrays**: Merges `salesDistributions` and `invoiceExtras`
3. **Recalculate Totals**: Sums all line items to get correct total
4. **Track PACE IDs**: Stores all PACE invoice IDs in `metadata.paceInvoiceIds`

### Result:

**Combined Invoice (to NetSuite)**
```json
{
  "invoice": {
    "invoiceNum": "55853-1",
    "invoiceAmount": 660.04,  // Recalculated from line items
    "taxAmount": 35.00
  },
  "salesDistributions": [10 items],  // 5 + 5 combined
  "invoiceExtras": [2 items],         // 2 + 0 combined
  "metadata": {
    "totalSalesDistLines": 10,
    "totalInvoiceExtras": 2,
    "paceInvoiceIds": [19667, 19668]  // Tracks both parts
  }
}
```

## How It Works

### 1. First Call (Invoice 19667)

Creates new `InvoiceIntegration` record:
```
📋 Created invoice integration record
   invoiceNumber: 55853-1
   salesDistLines: 5
   invoiceExtras: 2
   totalAmount: 495.04
```

### 2. Second Call (Invoice 19668)

Finds existing record and accumulates:
```
📋 Invoice 55853-1 already exists, accumulating line items...
✅ Accumulated invoice data:
   invoiceNumber: 55853-1
   previousSalesDistLines: 5
   newSalesDistLines: 5
   combinedSalesDistLines: 10
   previousExtras: 2
   newExtras: 0
   combinedExtras: 2
   totalAmount: 660.04
```

### 3. Sent to NetSuite

The worker processes the **combined** invoice with all line items.

## Deduplication Logic

Line items are deduplicated using a **Map** keyed by their `id`:

```typescript
// Accumulate sales distributions
const salesDistMap = new Map()
existingSalesDistributions.forEach(dist => salesDistMap.set(dist.id, dist))
newSalesDistributions.forEach(dist => salesDistMap.set(dist.id, dist))
const combined = Array.from(salesDistMap.values())
```

This ensures:
- ✅ Each line item appears only once (even if sent multiple times)
- ✅ Order is preserved
- ✅ Latest version wins (if same ID sent twice)

## Total Amount Calculation

The total is **recalculated** from line items, not summed from parts:

```typescript
const salesTotal = salesDistributions.reduce((sum, dist) => sum + dist.amount, 0)
const extrasTotal = invoiceExtras.reduce((sum, extra) => sum + extra.price, 0)
const totalAmount = salesTotal + extrasTotal
```

This ensures accuracy even if PACE's amounts don't match exactly.

## Logging

Detailed logs show the accumulation process:

```
📋 Invoice 55853-1 already exists, accumulating line items...
✅ Accumulated invoice data:
   id: abc123
   invoiceNumber: 55853-1
   previousSalesDistLines: 5
   newSalesDistLines: 5
   combinedSalesDistLines: 10
   previousExtras: 2
   newExtras: 0
   combinedExtras: 2
   totalAmount: 660.04
   status: pending
```

## Edge Cases Handled

### 1. Same Line Item Sent Twice
**Result**: Latest version kept (Map deduplication)

### 2. Empty Arrays
**Result**: Handled gracefully with `|| []` defaults

### 3. Duplicate PACE IDs
**Result**: Deduplicated in `paceInvoiceIds` array

### 4. Three or More Parts
**Result**: All accumulated correctly (no limit)

## Testing

### Manual Test

Send two webhook calls with same `invoiceNum`:

```bash
# First call
curl -X POST http://localhost:3000/api/webhooks/pace/invoice \
  -H "Content-Type: application/json" \
  -d '{
    "invoice": {
      "id": 19667,
      "invoiceNum": "55853-1",
      "invoiceAmount": 495.04
    },
    "salesDistributions": [...]
  }'

# Second call (same invoiceNum, different id)
curl -X POST http://localhost:3000/api/webhooks/pace/invoice \
  -H "Content-Type: application/json" \
  -d '{
    "invoice": {
      "id": 19668,
      "invoiceNum": "55853-1",
      "invoiceAmount": 165.00
    },
    "salesDistributions": [...]
  }'
```

### Verify in Database

```sql
SELECT
  "invoiceNumber",
  payload->'metadata'->>'totalSalesDistLines' as sales_lines,
  payload->'metadata'->>'totalInvoiceExtras' as extras,
  payload->'invoice'->>'invoiceAmount' as total,
  payload->'metadata'->'paceInvoiceIds' as pace_ids
FROM "InvoiceIntegration"
WHERE "invoiceNumber" = '55853-1';
```

Expected:
```
invoiceNumber | sales_lines | extras | total  | pace_ids
55853-1       | 10          | 2      | 660.04 | [19667, 19668]
```

## Benefits

✅ **Accurate Totals**: NetSuite receives correct amounts
✅ **Complete Data**: All line items included
✅ **Idempotent**: Same webhook can be sent multiple times safely
✅ **Traceable**: `paceInvoiceIds` tracks all source invoices
✅ **Auditable**: Detailed logging of accumulation

## Future Enhancements

### 1. Delayed Processing

Currently, each webhook call triggers a queue. Could add a delay:
- Wait 10 seconds after last update
- Only then send to NetSuite
- Ensures all parts arrive before processing

### 2. Status Tracking

Track accumulation status:
```typescript
{
  accumulationStatus: 'partial' | 'complete',
  expectedParts: 2,
  receivedParts: 2
}
```

### 3. Conflict Resolution

If line item with same ID has different data:
- Log warning
- Keep latest version
- Store both versions for audit

## Related Files

- [apps/web/app/api/webhooks/pace/invoice/route.ts](../apps/web/app/api/webhooks/pace/invoice/route.ts) - Accumulation logic
- [apps/worker/jobs/netsuite-invoice.ts](../apps/worker/jobs/netsuite-invoice.ts) - Worker that sends to NetSuite
- [prisma/schema.prisma](../prisma/schema.prisma) - InvoiceIntegration model

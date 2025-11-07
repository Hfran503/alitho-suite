# Atlassian Orders Email Monitoring System

This system automatically monitors an IMAP email folder for Atlassian Welcome Packet emails, extracts employee information, and stores it in a structured format.

## Features

- ✅ IMAP email monitoring from configured folder
- ✅ HTML email parsing with field extraction
- ✅ Country-based categorization (Philippines, Australia, India, USA, International)
- ✅ Missing address detection and flagging
- ✅ Automatic email deletion/archiving after successful processing
- ✅ JSON data export for integration with other systems
- ✅ Web UI with tabs for viewing orders by country
- ✅ Manual and automated email checking via cron

## Architecture

### Components

1. **Database Model** (`AtlassianOrder`)
   - Stores extracted employee data from emails
   - Tracks processing status and metadata
   - Location: `prisma/schema.prisma`

2. **IMAP Client** (`ImapClient`)
   - Connects to IMAP server using credentials from AWS Secrets Manager
   - Fetches unread emails from specified folder
   - Manages email lifecycle (mark as read, delete)
   - Location: `apps/worker/lib/imap-client.ts`

3. **Email Parser** (`parseAtlassianEmail`)
   - Extracts key-value pairs from HTML emails
   - Handles missing data and placeholder values
   - Categorizes by country
   - Location: `apps/worker/lib/atlassian-email-parser.ts`

4. **Worker Process** (`atlassianOrdersWorker`)
   - Background job processor using BullMQ
   - Processes emails asynchronously
   - Retries on failure
   - Location: `apps/worker/jobs/atlassian-orders.ts`

5. **API Routes**
   - `GET /api/atlassian/orders` - List all orders with filtering
   - `POST /api/atlassian/orders` - Trigger manual email check
   - `GET /api/atlassian/orders/[id]` - Get specific order
   - `PATCH /api/atlassian/orders/[id]` - Update order
   - `DELETE /api/atlassian/orders/[id]` - Delete order
   - `GET /api/cron/atlassian-orders` - Automated cron endpoint

6. **Web UI**
   - Tabbed interface for viewing orders by country
   - Manual email check trigger
   - JSON export functionality
   - Location: `apps/web/app/(dashboard)/atlassian-orders/page.tsx`

## Setup Instructions

### 1. Configure IMAP Credentials

The system uses the existing email integration settings in the Settings page.

1. Navigate to Settings > Email Integration
2. Configure IMAP settings:
   - **IMAP Server**: Your IMAP server (e.g., `imap.hostinger.com:993`)
   - **IMAP User**: Your email username
   - **IMAP Password**: Your email password

Credentials are securely stored in AWS Secrets Manager at:
`calitho-suite/integrations/email/{tenantId}`

### 2. Create Email Folder

In your email account, create a folder named **`AtlassianOrders`** where Atlassian welcome packet emails will be stored or forwarded.

**Note**: The folder can be at the root level or nested under another folder (e.g., `CalithoSuite/AtlassianOrders`). The system will automatically detect the correct path by trying common variations:
- `AtlassianOrders`
- `INBOX.AtlassianOrders`
- `CalithoSuite.AtlassianOrders`
- `INBOX.CalithoSuite.AtlassianOrders`

If the folder is not found, the worker will list all available folders in the logs to help you identify the correct path.

### 3. Start the Worker

The worker is automatically registered and will start with the worker process:

```bash
# In development
pnpm --filter worker dev

# In production
pnpm --filter worker start
```

### 4. Set Up Automated Checking (Every 15 Minutes)

You have **two ways** to check for emails:
- ✅ **Automated** - Every 15 minutes via cron
- ✅ **Manual** - Click "Check Emails" button in the UI anytime

#### Setup for Dokploy Deployment

**Step 1: Set up CRON_SECRET in AWS Secrets Manager**

The CRON_SECRET is stored securely in AWS Secrets Manager (same as your other credentials).

You have **three options** to set it up:

**Option A: Using Settings UI (Easiest!)** ⭐ **RECOMMENDED**
1. Go to **Settings → Security** tab in your application (`/settings`)
2. Click **"Generate"** button to create a secure random secret (or enter your own)
3. Click **"Save Secret"** - it will automatically save to AWS Secrets Manager
4. Click **"Copy"** to copy the secret for use in Step 2 below

**Option B: Using AWS CLI**
```bash
# Generate a secret first
SECRET=$(openssl rand -base64 32)

# Save to AWS Secrets Manager
aws secretsmanager create-secret \
  --name "calitho-suite/cron" \
  --description "Cron job authentication secret" \
  --secret-string "{\"CRON_SECRET\":\"$SECRET\"}" \
  --region us-west-1

# Print the secret (save this for Step 2)
echo "Your CRON_SECRET: $SECRET"
```

**Option C: Using AWS Console**
1. Generate a secret: `openssl rand -base64 32`
2. Go to AWS Secrets Manager console
3. Click "Store a new secret"
4. Select "Other type of secret"
5. Add key-value pair:
   - Key: `CRON_SECRET`
   - Value: (paste your generated secret)
6. Secret name: `calitho-suite/cron`
7. Save

The secret will be automatically fetched by the cron endpoint - no environment variables needed!

**Step 2: Create Dokploy Schedule Job**

Dokploy has built-in scheduled jobs! This is the easiest option:

1. In Dokploy dashboard, go to your application
2. Navigate to **Schedule Jobs** tab
3. Click **Create Schedule Job**
4. Configure the job:
   - **Type**: Select "Dokploy Server Jobs"
   - **Command/Script**:
     ```bash
     #!/bin/bash
     curl -X GET \
       -H "Authorization: Bearer YOUR_CRON_SECRET_HERE" \
       https://your-domain.com/api/cron/atlassian-orders
     ```
   - **Schedule**: `*/15 * * * *` (every 15 minutes)
   - **Name**: `Atlassian Orders Email Check`
5. Replace:
   - `YOUR_CRON_SECRET_HERE` with the **same secret** you stored in AWS Secrets Manager in Step 1
   - `your-domain.com` with your actual domain (e.g., `calithosuite.com`)
6. Save and the job will start running automatically!

**How it works:**
- The Dokploy cron script sends the secret in the Authorization header
- The API endpoint fetches the secret from AWS Secrets Manager and compares them
- If they match, the email check proceeds
- You can view execution logs in the Schedule Jobs tab to monitor the job

**Security Note:** The secret is stored securely in AWS Secrets Manager, not in environment variables. The Dokploy script only sends it in the request header for authentication.

**Alternative Option: External Cron Service**

If you prefer an external service, use **cron-job.org**:

1. Go to [cron-job.org](https://cron-job.org) and create free account
2. Create a new cron job:
   - **URL**: `https://your-domain.com/api/cron/atlassian-orders`
   - **Schedule**: Every 15 minutes
   - **Request Method**: GET
   - **Headers**: Add `Authorization: Bearer YOUR_CRON_SECRET`

#### Manual Checking (Always Available)

**You can always manually trigger email checks:**
1. Navigate to the **Atlassian Orders** page
2. Click the **"Check Emails"** button (top right)
3. Wait 5-10 seconds for processing
4. The page will auto-refresh with new orders

This works even if you don't set up automated cron!

### 5. Access the Dashboard

Navigate to: `https://your-domain.com/atlassian-orders`

## Usage

### Manual Email Check

1. Go to the Atlassian Orders page
2. Click the **Check Emails** button
3. Wait for the job to process (usually 10-30 seconds)
4. Page will auto-refresh with new orders

### View Orders by Country

Use the tabs to filter orders by country:
- **All** - All orders
- **Philippines** - Philippine addresses
- **Australia** - Australian addresses
- **India** - Indian addresses
- **USA** - United States addresses
- **International** - Other countries
- **Missing Address** - Orders with missing or placeholder addresses

### Export Data

Click the **Export JSON** button to download all orders grouped by country category.

The JSON structure mirrors the original tool's data format:

```json
{
  "all": [...],
  "philippines": [...],
  "australia": [...],
  "india": [...],
  "usa": [...],
  "international": [...],
  "missing": [...]
}
```

### API Integration

You can integrate with other systems using the API:

```javascript
// Fetch all orders
const response = await fetch('/api/atlassian/orders');
const data = await response.json();

// Filter by country
const response = await fetch('/api/atlassian/orders?countryCategory=Philippines');

// Filter by status
const response = await fetch('/api/atlassian/orders?status=completed');

// Search by name or email
const response = await fetch('/api/atlassian/orders?search=john');

// Trigger manual check
await fetch('/api/atlassian/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    folderPath: 'AtlassianOrders',
    deleteAfterProcessing: true
  })
});
```

## Data Fields Extracted

The system extracts the following fields from emails:

### Name Fields
- First Name
- Last Name
- Full Name
- Print Name (for labels)

### Contact Information
- Personal Email
- Work Email
- Phone Number

### Address Information
- Address 1 (street address)
- Address 2 (apt/suite)
- Address 3 (additional line)
- City
- State/Province
- ZIP/Postal Code
- Country
- Country Category (auto-categorized)

### Employment Information
- Start Date
- Manager
- Department
- Location/Office

## Email Processing Rules

### Address Validation

Addresses are marked as "missing" if they contain:
- Empty or blank values
- `[address to be confirmed in workday prior to start date]`
- `[not available]`
- `[to be confirmed]`
- `[pending]`
- `[tbd]`
- `to be determined`
- `n/a`

### Country Categorization

| Country | Category |
|---------|----------|
| Philippines | Philippines |
| Australia | Australia |
| India | India |
| United States, USA, US | United States of America |
| All others | International US |

### Email Lifecycle

1. Email arrives in `AtlassianOrders` folder (unread)
2. Worker fetches unread emails
3. Email is parsed and data extracted
4. Data saved to database
5. Email is marked as read or deleted (configurable)

## Troubleshooting

### No emails being processed

1. Check IMAP credentials in Settings
2. Verify the folder name is exactly `AtlassianOrders`
3. Check worker logs: `pnpm --filter worker logs`
4. Ensure emails are marked as unread in the folder

### Email parsing errors

1. Check email HTML structure matches expected format
2. Review `emailBodyHtml` field in database for problematic emails
3. Check worker logs for parsing errors

### Worker not running

```bash
# Check if worker is running
pnpm --filter worker status

# Restart worker
pnpm --filter worker restart

# View worker logs
pnpm --filter worker logs
```

### Database errors

```bash
# Regenerate Prisma client
pnpm db:generate

# Check database connection
pnpm db:studio
```

## Development

### Run locally

```bash
# Start worker in development mode
pnpm --filter worker dev

# Start web app
pnpm --filter web dev

# Open Prisma Studio to view data
pnpm db:studio
```

### Test email parsing

Create a test script:

```typescript
import { parseAtlassianEmail } from './apps/worker/lib/atlassian-email-parser';

const testHtml = `
  <html>
    <body>
      First Name: John<br>
      Last Name: Doe<br>
      Address1: 123 Main St<br>
      Country: Philippines<br>
    </body>
  </html>
`;

const result = parseAtlassianEmail(testHtml, 'Atlassian Welcome Packet For _ John Doe');
console.log(JSON.stringify(result, null, 2));
```

### Run worker manually

```typescript
import { queueAtlassianOrdersCheck } from './apps/web/lib/queue/atlassian-orders-queue';

await queueAtlassianOrdersCheck('tenant-id', 'AtlassianOrders', false);
```

## Security Considerations

- IMAP credentials are stored in AWS Secrets Manager (encrypted)
- Cron endpoint requires `CRON_SECRET` authorization
- API routes use session-based authentication via Next-Auth
- Emails can be automatically deleted after processing to minimize data retention

## Performance

- Worker processes one tenant at a time to avoid IMAP conflicts
- Rate limiting: Max 5 jobs per minute
- Concurrent processing: 1 (to prevent IMAP connection issues)
- Automatic retries: Up to 3 attempts with exponential backoff

## Future Enhancements

Potential improvements:
- [ ] Email templates for notifications
- [ ] Integration with shipping/fulfillment APIs
- [ ] Bulk address validation
- [ ] CSV export in addition to JSON
- [ ] Email attachment handling
- [ ] Custom field mapping configuration
- [ ] Multi-folder monitoring
- [ ] Webhook notifications on new orders

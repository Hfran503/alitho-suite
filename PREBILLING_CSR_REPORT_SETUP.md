# Prebilling CSR Report - Automated Daily Email Setup

This document explains how to set up automated daily prebilling reports that are sent to CSRs at 8:10 AM California time.

## Overview

The system automatically:
1. Fetches all open prebilling jobs from PACE
2. Identifies jobs with issues (missing PO, missing estimate, change orders with $0, etc.)
3. Groups jobs by CSR
4. Sends a personalized email to each CSR with their jobs requiring attention

## Current Configuration (Production Mode)

**PRODUCTION:** Emails are sent to actual CSR email addresses with BCC to `Hector.franco@calitho.com`.

- Each CSR receives their personalized prebilling report
- Hector.franco@calitho.com receives a BCC copy of all emails
- CSRs without email addresses in PACE will be skipped

## Setup Instructions

### 1. Ensure Email Integration is Configured

The system uses the email integration configured in Settings > Integrations > Email.

Make sure you have configured one of:
- SMTP
- SendGrid
- AWS SES
- Resend

### 2. Set Up CRON_SECRET (if not already done)

The cron endpoint is protected by a secret token. You can set it up via:

**Option A: Through Settings UI (Recommended)**
1. Go to Settings > Security
2. Generate a CRON_SECRET
3. Save it

**Option B: Via AWS CLI**
```bash
aws secretsmanager create-secret \
  --name "calitho-suite/cron" \
  --secret-string '{"CRON_SECRET":"your-generated-secret-here"}' \
  --region us-west-1
```

**Option C: Local Development Only**
Add to `.env`:
```
CRON_SECRET=your-secret-here
```

### 3. Configure Cron Job in Dokploy

#### Schedule for California Time:
- **8:10 AM PST** (Winter/Standard Time): `10 16 * * *` (4:10 PM UTC)
- **8:10 AM PDT** (Summer/Daylight Time): `10 15 * * *` (3:10 PM UTC)

**Recommended: Use PST schedule year-round** (`10 16 * * *`)

#### Dokploy Configuration:

1. Go to your Dokploy project
2. Navigate to "Schedule Jobs" or "Server Jobs"
3. Create a new scheduled job with:
   - **Name:** Prebilling CSR Report
   - **Schedule:** `10 16 * * *` (8:10 AM PST daily)
   - **Command/Script:**
     ```bash
     curl -X POST \
       -H "Authorization: Bearer YOUR_CRON_SECRET_HERE" \
       https://your-domain.com/api/cron/prebilling-csr-report
     ```

Replace:
- `YOUR_CRON_SECRET_HERE` with your actual CRON_SECRET
- `your-domain.com` with your actual domain

### 4. Manual Testing

You can test the endpoint manually using:

```bash
# Test locally
curl -X POST \
  -H "Authorization: Bearer your-cron-secret" \
  http://localhost:3000/api/cron/prebilling-csr-report

# Test in production
curl -X POST \
  -H "Authorization: Bearer your-cron-secret" \
  https://your-domain.com/api/cron/prebilling-csr-report
```

## Email Content

The email includes:
- Personalized greeting with CSR name
- Total number of jobs requiring attention
- Table with:
  - Job Number
  - Customer Name
  - Proposal Number
  - List of issues for each job
- Call to action

### Issues Detected:
1. **Missing PO** - When customer requires PO but none is set
2. **Missing Estimate Price** - When proposal has no estimate or sell price
3. **Change Orders with $0** - When change orders exist with zero or null price
4. **Job Value $0 or Missing** - When job has no value set

### Email Examples:

**With Issues:**
```
Good Morning, John!

Here's your daily prebilling report. You have 5 job(s) requiring attention:

[Table showing jobs and their issues]

Action Required:
Please review and resolve these issues to ensure jobs can be billed properly.
```

**No Issues:**
```
Good Morning, John!

Great news! You have no prebilling issues to address today.

All your open jobs are in good standing.
```

## Monitoring

Check the cron job logs in Dokploy to see:
- Number of jobs found
- Number of CSRs processed
- Number of emails sent
- Any errors

Example successful response:
```json
{
  "success": true,
  "message": "Sent prebilling reports to 8 CSR(s) across 1 tenant(s)",
  "totalEmails": 8,
  "results": [
    {
      "tenantId": "...",
      "tenantName": "Calitho",
      "jobsFound": 145,
      "csrCount": 8,
      "emailsSent": 8,
      "status": "success"
    }
  ],
  "timestamp": "2025-01-11T16:10:00.000Z"
}
```

## Troubleshooting

### Emails Not Sending
1. Check email integration in Settings > Integrations > Email
2. Test email integration using the "Send Test Email" button
3. Check worker logs for email processing errors
4. Verify Redis is running and accessible

### Cron Job Not Running
1. Verify CRON_SECRET is correct
2. Check Dokploy logs for execution errors
3. Test endpoint manually with curl
4. Ensure the schedule syntax is correct

### Wrong Timezone
1. Adjust the cron schedule based on PST/PDT
2. California is UTC-8 (PST) or UTC-7 (PDT)
3. Recommended: Use `10 16 * * *` year-round (8:10 AM PST)

## API Endpoint

**Endpoint:** `POST /api/cron/prebilling-csr-report`

**Authentication:** Bearer token (CRON_SECRET)

**Response:**
```json
{
  "success": true,
  "message": "Sent prebilling reports to X CSR(s) across Y tenant(s)",
  "totalEmails": 8,
  "results": [...],
  "timestamp": "2025-01-11T16:10:00.000Z"
}
```

## Production Deployment Checklist

- [ ] Email integration configured and tested
- [ ] CRON_SECRET generated and saved
- [ ] Cron job scheduled in Dokploy (8:10 AM California time)
- [ ] Endpoint tested manually
- [ ] BCC emails received at Hector.franco@calitho.com
- [ ] CSR email addresses verified in PACE system
- [ ] Monitor first few automated runs
- [ ] Verify CSRs are receiving emails
- [ ] Confirm BCC copies are being received

## Future Enhancements

Consider adding:
- Email preferences per CSR (opt-in/opt-out)
- Weekly summary option
- Customizable issue priorities
- Dashboard showing email delivery status
- Historical report tracking

# NetSuite Vendor Bills Export - Deployment Instructions

This document provides step-by-step instructions for deploying the Vendor Bills Export scheduled script in NetSuite.

## Overview

The Vendor Bills Export script runs daily to:
1. Query vendor bills created from purchase orders (created 1 day ago)
2. Match with item receipts
3. Transform the data into PACE-compatible format
4. Send to Calitho Suite via webhook for import into PACE

## Prerequisites

### Custom Fields Required

1. **Vendor Field**: `custentity_calitho_ext_id_unstored`
   - Type: Entity (Vendor)
   - This field stores the external ID that maps to PACE vendor ID

2. **PO Line Column Field**: `custcolpolineid`
   - Type: Transaction Column
   - This field stores the PO Line ID reference on vendor bill lines

3. **Item Receipt Column Fields**:
   - `custcolreceipt_po_line_id` - PO Line ID reference
   - `custcolreceipt_line_id` - Receipt Line ID

## Script Deployment Steps

### 1. Upload the Script File

1. Navigate to **Customization > Scripting > Scripts > New**
2. Click **+ (Create Script Record)**
3. Choose **SuiteScript 2.x**
4. Upload the file: `VendorBills_ScheduledScript.js`
5. Click **Create Script Record**

### 2. Configure Script Settings

Fill in the following details:

- **Name**: Vendor Bills Export to Calitho Suite
- **ID**: `customscript_vendor_bills_export`
- **Script File**: Select the uploaded file
- **Description**: Daily export of vendor bills to Calitho Suite for PACE import

### 3. Add Script Parameters

Create the following parameters:

#### Parameter 1: Webhook URL
- **ID**: `custscript_webhook_url`
- **Type**: Free-Form Text
- **Display Type**: Normal
- **Default Value**: `https://calithosuite.com/api/webhooks/netsuite/vendor-bills`
- **Description**: The Calitho Suite webhook endpoint URL

#### Parameter 2: Webhook Token
- **ID**: `custscript_webhook_token`
- **Type**: Free-Form Text
- **Display Type**: Password (hidden)
- **Default Value**: (Copy from NetSuite Integration settings in Calitho Suite)
- **Description**: Bearer token for webhook authentication

**How to get the token:**
1. Log in to Calitho Suite
2. Go to **Settings > Integrations > NetSuite**
3. Scroll to **"Webhook Authentication"** section
4. Generate a secure token: `openssl rand -base64 32`
5. Enter and save the token in Calitho Suite
6. Copy the same token to this NetSuite script parameter

### 4. Configure Script Deployment

1. Click the **Deployments** subtab
2. Click **+ Deploy Script**
3. Fill in deployment settings:

#### Basic Settings
- **Title**: Daily Vendor Bills Export
- **ID**: `customdeploy_vendor_bills_export`
- **Status**: Testing (change to Released after testing)
- **Log Level**: Debug (for initial deployment, change to Audit after testing)

#### Audience
- **Audience**: All Roles

#### Schedule
- **Schedule**: Daily
- **Repeat**: Every Day
- **Start Time**: 11:00 PM (or end of business day)
- **Time Zone**: (Your company's time zone)

### 5. Set Execution Context

- **Execution Context**: User Event Script, Scheduled Script, Map/Reduce Script

### 6. Save the Deployment

Click **Save** to deploy the script.

## Configuration (Calitho Suite)

### Webhook Token Setup

The webhook authentication token is stored securely in AWS Secrets Manager and configured through the Calitho Suite UI:

1. **Generate a Secure Token:**
   ```bash
   openssl rand -base64 32
   ```

2. **Configure in Calitho Suite:**
   - Log in to Calitho Suite
   - Navigate to **Settings > Integrations > NetSuite**
   - Scroll to the **"Webhook Authentication"** section
   - Enter the generated token in the **"Webhook Token"** field
   - Click **Save**

3. **Configure in NetSuite:**
   - Copy the same token
   - Paste it into the NetSuite script's `custscript_webhook_token` parameter

**Note:** The token is automatically stored in AWS Secrets Manager at:
- Path: `calitho-suite/integrations/netsuite/{TENANT_ID}`
- Field: `webhookToken`

## Testing the Integration

### 1. Manual Script Execution

1. Go to **Customization > Scripting > Script Deployments**
2. Find "Daily Vendor Bills Export"
3. Click **Execute**
4. Monitor the **Execution Log** for results

### 2. Verify Webhook Receipt

1. Check Calitho Suite logs for incoming webhook
2. Go to the webhook health endpoint:
   ```
   GET https://calithosuite.com/api/webhooks/netsuite/vendor-bills
   ```
3. Should return:
   ```json
   {
     "message": "NetSuite Vendor Bill Webhook Endpoint",
     "status": "healthy"
   }
   ```

### 3. Check Database Records

Query the `VendorBillIntegration` table to verify records were created:

```sql
SELECT * FROM "VendorBillIntegration"
ORDER BY "createdAt" DESC
LIMIT 10;
```

## Monitoring

### Script Execution Logs

1. **NetSuite Logs**:
   - Navigate to **Customization > Scripting > Script Execution Log**
   - Filter by Script: "Vendor Bills Export to Calitho Suite"

2. **Calitho Suite Logs**:
   - Check application logs for webhook processing
   - Check worker logs for PACE integration

### Common Log Messages

#### Success Messages
```
✅ Created vendor bill integration record
📤 Queued vendor bill for PACE
🔄 Processing vendor bill (attempt 1)
✅ Vendor bill sent successfully to PACE
```

#### Error Messages
```
❌ Vendor bill webhook received without Bearer token
❌ Failed to parse JSON payload
❌ Error processing vendor bill
```

## Troubleshooting

### Script Not Running

1. **Check Deployment Status**: Must be "Released" not "Testing"
2. **Check Schedule**: Verify start time and repeat settings
3. **Check Governance**: View execution logs for governance issues

### Webhook Authentication Failed

1. Verify `NETSUITE_WEBHOOK_TOKEN` matches in both NetSuite script parameter and Calitho Suite environment
2. Check webhook request headers in logs

### No Data Sent

1. **Check Date Filter**: Script looks for vendor bills created 1 day ago
2. **Check Filters**: Verify vendor bills were created from purchase orders
3. **Check Custom Fields**: Ensure `custcolpolineid` is populated on vendor bill lines

### PACE Import Failed

1. Check worker logs in Calitho Suite
2. Verify PACE API credentials are configured in AWS Secrets Manager
3. Check parsed CSV data in `VendorBillIntegration.processedData`

## CSV Data Format

The script sends data in the following format:

```csv
_ACTION_,billBatch,billType,dateDue,vendor,invoiceDate,invoiceNumber,voucherDate,bill,discountApplicable,glAccount,poQuantity,poUnitPrice,poUom,purchaseOrderReceipt,invoiceAmount
I,,1,05/15/2024,VENDOR123,04/15/2024,VB-12345,04/15/2024,,FALSE,2,100,25.50,EA,RCT-001,2550.00
```

### Column Definitions

| Column | Description | Example |
|--------|-------------|---------|
| _ACTION_ | Action code (I=Insert) | I |
| billBatch | Batch identifier | (empty) |
| billType | Bill type code | 1 |
| dateDue | Due date (MM/DD/YYYY) | 05/15/2024 |
| vendor | Vendor external ID | VENDOR123 |
| invoiceDate | Invoice date | 04/15/2024 |
| invoiceNumber | Bill transaction ID | VB-12345 |
| voucherDate | Voucher date | 04/15/2024 |
| bill | Bill reference | (empty) |
| discountApplicable | Discount flag | FALSE |
| glAccount | GL account code | 2 |
| poQuantity | Quantity | 100 |
| poUnitPrice | Unit price | 25.50 |
| poUom | Unit of measure | EA |
| purchaseOrderReceipt | Receipt line ID | RCT-001 |
| invoiceAmount | Total amount | 2550.00 |

## Maintenance

### Updating the Script

1. Make changes to the script file
2. Upload new version to NetSuite
3. Update script record to reference new file
4. Test in sandbox first
5. Deploy to production

### Schedule Adjustments

1. Go to script deployment
2. Edit **Schedule** tab
3. Adjust timing as needed
4. Save changes

## Support

For issues or questions:
- Check script execution logs in NetSuite
- Check Calitho Suite application logs
- Review webhook endpoint health
- Contact Calitho Suite support team

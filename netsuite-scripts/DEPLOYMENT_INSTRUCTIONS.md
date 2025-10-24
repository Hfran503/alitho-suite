# PACE Invoice RESTlet - Deployment Instructions

## Overview
This RESTlet receives JSON invoice data from your PACE webhook and creates invoices in NetSuite, matching the logic from your existing TXT file processor.

## Key Differences from TXT Processor

### What the RESTlet Does
- Receives JSON data via HTTP POST from your Node.js application
- Looks up items by **External ID** (using `salesCategoryId` from PACE)
- Creates invoices with the same structure as your TXT processor
- Returns success/error response immediately (no email)

### Critical Requirement: Item Custom External IDs
**The RESTlet looks up items using a custom field**: `custitem_calitho_ext_id`. You must ensure that all your NetSuite items have this custom field populated with the PACE `salesCategoryId`.

For example, from your JSON payload:
```json
{
  "salesCategoryId": 7010,
  "salesCategoryName": "IL: Print - General"
}
```

The NetSuite item for "IL: Print - General" must have **custitem_calitho_ext_id = 7010**.

## Deployment Steps

### 1. Upload the Script to NetSuite

1. Go to **Customization > Scripting > Scripts > New**
2. Click **Choose File** and upload `PACE_Invoice_RESTlet.js`
3. Click **Create Script Record**

### 2. Configure the Script

1. **Name**: PACE Invoice RESTlet
2. **ID**: `customscript_pace_invoice_restlet`
3. **API Version**: 2.1
4. **Deployed**: ✓ (checked)

### 3. Create Deployment

1. Click **Deploy Script**
2. **Status**: Released
3. **Log Level**: Debug (for initial testing, change to Audit later)
4. **Audience**: All Roles (or specific role that your integration uses)
5. **Execute As Role**: Administrator (or a role with permissions to create invoices)

### 4. Get the RESTlet URL

After deploying, NetSuite will generate a URL like:
```
https://301349-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=2934&deploy=1
```

**Important**: Copy this URL exactly - you already have it in your `.env` file as `NETSUITE_RESTLET_URL`.

## Item Configuration Requirements

### Sales Distribution Items
For each sales category in PACE, create or update the NetSuite item:

| PACE Sales Category ID | PACE Sales Category Name | NetSuite Custom Field Value |
|------------------------|-------------------------|---------------------------|
| 7010 | IL: Print - General | 7010 |
| 5025 | Finishing | 5025 |
| 5023 | Offset | 5023 |
| 7018 | IL: Freight | 7018 |
| 5027 | Shipping | 5027 |
| 5021 | Prepress | 5021 |

### How to Set Custom External ID on NetSuite Items

1. Go to **Lists > Accounting > Items**
2. Search for the item (e.g., "IL: Print - General")
3. Click **Edit**
4. Find the custom field **"Calitho Ext ID"** (Field ID: `custitem_calitho_ext_id`)
5. Set the value to the PACE sales category ID (e.g., `7010`)
6. Click **Save**

**If the item doesn't exist**, create it:
1. **Lists > Accounting > Items > New**
2. Choose appropriate item type (Service, Non-Inventory, etc.)
3. **Item Name/Number**: Match the PACE sales category name
4. Set the custom field **"Calitho Ext ID"** to the PACE sales category ID
5. Configure pricing, GL accounts, etc.
6. Click **Save**

### Invoice Extras Items
These are already mapped by Internal ID in the script (matching your TXT processor):

| Type | NetSuite Item Internal ID |
|------|---------------------------|
| Freight | 376 |
| Handling | 376 |
| Postage | 372 |
| Sales Tax | 310 |

**Verify these IDs match your NetSuite items:**
1. Go to the item in NetSuite
2. Look at the URL - the ID is in the URL: `...&id=376&...`
3. If your IDs are different, update the `getInvoiceExtraItemId()` function in the RESTlet

## Testing the RESTlet

### Test 1: Connection Test (GET Request)
```bash
# Your application already has a test endpoint
# Go to Settings > NetSuite Integration > Test Connection
```

### Test 2: Create Invoice (POST Request)
Use the "Send to NetSuite" button on an invoice in your application.

### Expected Responses

**Success:**
```json
{
  "success": true,
  "message": "Invoice created successfully",
  "invoiceId": "12345",
  "invoiceNumber": "55686",
  "customer": "Stanford Medicine",
  "totalAmount": 57502.95
}
```

**Error - Item Not Found:**
```json
{
  "success": false,
  "error": "Item not found for sales category: IL: Print - General (7010)",
  "invoiceNumber": "55686"
}
```

**Error - Customer Not Found:**
```json
{
  "success": false,
  "error": "Customer not found for External ID: 00001012",
  "invoiceNumber": "55686"
}
```

**Error - Duplicate Invoice:**
```json
{
  "success": false,
  "error": "Invoice already exists in NetSuite",
  "invoiceNumber": "55686"
}
```

## Troubleshooting

### Permission Errors (INSUFFICIENT_PERMISSION)

**Error: "Permission Violation: You need the 'Lists -> Items' permission"**
- The role used by your Access Token doesn't have permission to search items
- Solution: Add **Items** permission (View level) to the integration role
- Go to **Setup > Users/Roles > Manage Roles** > Edit your integration role > Permissions > Lists > Items = View

**Error: "Permission Violation: You need the 'Transactions -> Find Transaction' permission"**
- The role doesn't have permission to search for existing invoices
- Solution: Add **Find Transaction** permission (Full level) to the integration role
- Go to **Setup > Users/Roles > Manage Roles** > Edit your integration role > Permissions > Transactions > Find Transaction = Full

**After adding permissions:**
1. Save the role
2. Wait 2-3 minutes for changes to propagate
3. Try sending the invoice again
4. If still failing, you may need to regenerate the Access Token

### "Item not found for sales category"
- The NetSuite item's custom field `custitem_calitho_ext_id` doesn't match the PACE `salesCategoryId`
- Go to NetSuite and set the **"Calitho Ext ID"** field on the item
- Or create the item if it doesn't exist

### "Customer not found"
- The customer's External ID in NetSuite doesn't match the PACE `customerId`
- Check the customer record in NetSuite: **External ID** field must equal the PACE customer ID

### "Invoice already exists"
- The invoice number is already in NetSuite
- This is normal duplicate prevention
- The invoice won't be created again

### Authentication Errors
- Check that your TBA credentials are correct in Settings
- Verify the RESTlet URL is correct
- Ensure the integration role has all required permissions (see "Permissions Required" section)

## Monitoring

### View Execution Logs
1. Go to **Customization > Scripting > Script Execution Log**
2. Filter by **Script**: PACE Invoice RESTlet
3. Review logs for errors

### View Created Invoices
1. Go to **Transactions > Sales > Enter Invoices**
2. Search by invoice number from PACE

## Permissions Required

The role used by your integration token needs these permissions configured:

### Setup > Users/Roles > Manage Roles > [Your Integration Role] > Permissions Tab

**Transactions Permissions:**
- **Invoices**: Full (Create, Edit, View, List)
- **Find Transaction**: Full (required for searching existing invoices)

**Lists Permissions:**
- **Customers**: View (required for customer lookup)
- **Items**: View or Full (required for item lookup by custom field)

**Setup Permissions:**
- **SuiteScript**: Full (required to execute RESTlet)
- **Log in using Access Tokens**: Full (required for TBA authentication)

**Custom Records Permissions (if applicable):**
- Any custom record types: As needed

### How to Add Permissions:

1. Go to **Setup > Users/Roles > Manage Roles**
2. Find the role used by your integration token
3. Click **Edit**
4. Go to **Permissions** subtab
5. Add/Update the permissions listed above:
   - **Transactions** tab: Set "Invoices" to "Full", "Find Transaction" to "Full"
   - **Lists** tab: Set "Customers" to "View", "Items" to "View"
   - **Setup** tab: Set "SuiteScript" to "Full", "Log in using Access Tokens" to "Full"
6. Click **Save**

**Important**: After changing permissions, you may need to regenerate your Access Token or wait a few minutes for the changes to take effect.

## Next Steps

1. ✅ Upload and deploy the RESTlet
2. ✅ Configure all item External IDs to match PACE sales category IDs
3. ✅ Test with a sample invoice
4. ✅ Monitor logs for any errors
5. ✅ Switch log level from Debug to Audit once stable

## Support

If you encounter issues:
1. Check the Script Execution Log in NetSuite
2. Check your Node.js server logs
3. Verify item and customer External IDs match

# Atlassian Orders - Quick Start Guide

## 🎯 What You Get

✅ **Automated email checking every 15 minutes**
✅ **Manual "Check Emails" button in the UI**
✅ **JSON export** grouped by country
✅ **Automatic email deletion** after processing

---

## ⚡ 3-Minute Setup

### Step 1: Configure IMAP
1. Go to **Settings** in your app
2. Configure your email IMAP settings:
   - IMAP Server: `imap.hostinger.com:993` (or your server)
   - IMAP User: your email
   - IMAP Password: your password

### Step 2: Create Email Folder
1. In your email account, create a folder called: **`AtlassianOrders`**
2. Forward or move Atlassian welcome packet emails to this folder

### Step 3: Set Up Automatic Checking
1. **Generate a secret**:
   ```bash
   openssl rand -base64 32
   ```

2. **Store in AWS Secrets Manager**:
   ```bash
   aws secretsmanager create-secret \
     --name "calitho-suite/cron" \
     --description "Cron job authentication secret" \
     --secret-string '{"CRON_SECRET":"your-generated-secret-here"}' \
     --region us-west-1
   ```
   (Replace `your-generated-secret-here` with the secret from step 1)

3. **Create Dokploy Schedule Job**:
   - In Dokploy, go to your app's **Schedule Jobs** tab
   - Click **Create Schedule Job**
   - Set **Type**: "Dokploy Server Jobs"
   - Set **Schedule**: `*/15 * * * *`
   - Set **Name**: `Atlassian Orders Email Check`
   - Set **Script**:
     ```bash
     #!/bin/bash
     curl -X GET \
       -H "Authorization: Bearer YOUR_CRON_SECRET" \
       https://your-domain.com/api/cron/atlassian-orders
     ```
   - Replace `YOUR_CRON_SECRET` with the **same secret** from step 1
   - Replace `your-domain.com` with your actual domain (e.g., `calithosuite.com`)
   - **Save**

**Done!** Emails will be checked automatically every 15 minutes.

The secret is stored securely in AWS Secrets Manager (not in environment variables).
You can view logs in the Schedule Jobs tab to monitor executions.

---

## 🚀 Using the System

### View Orders
Navigate to: **`/atlassian-orders`**

You'll see tabs for:
- All orders
- Philippines
- Australia
- India
- USA
- International
- Missing Address (flagged)

### Manual Check
Click the **"Check Emails"** button (top right) anytime to immediately check for new emails.

### Export Data
Click **"Export JSON"** to download all orders grouped by country.

---

## 📋 What Happens Automatically

Every 15 minutes, the system:
1. ✉️ Connects to your IMAP email account
2. 📁 Checks the `AtlassianOrders` folder for unread emails
3. 📝 Extracts employee data (name, address, country, etc.)
4. 💾 Saves to database
5. 🗑️ Deletes the email (to keep folder clean)
6. ✅ Shows new orders in the UI

---

## 🔍 What Gets Extracted

From each email:
- **Name**: First, Last, Full Name, Print Name (for labels)
- **Contact**: Personal Email, Work Email, Phone
- **Address**: Street, City, State, ZIP, Country
- **Employment**: Start Date, Manager, Department
- **Status**: Completed or Missing Address (flagged)

---

## 🌍 Country Grouping

Orders are automatically categorized:
- **Philippines** → Philippines
- **Australia** → Australia
- **India** → India
- **USA, United States** → United States of America
- **All others** → International US

---

## 🎨 UI Features

- **Summary Cards**: See counts at a glance
- **Tabs**: Filter by country with one click
- **Search**: Find orders by name or email
- **Status Badges**: Color-coded status indicators
- **Export**: Download JSON for external use
- **Real-time**: Auto-refresh after checking emails

---

## 🆘 Troubleshooting

**No emails being processed?**
- Check IMAP credentials in Settings
- Verify folder name is exactly `AtlassianOrders`
- Make sure emails are unread
- Check worker is running: `pnpm --filter worker dev`

**Can't see the page?**
- Navigate to: `/atlassian-orders`
- Check that you're logged in

**Cron not working?**
- Verify `CRON_SECRET` is set in Vercel
- Check Vercel logs for cron executions
- Manually trigger to test: click "Check Emails" button

---

## 📚 Full Documentation

See [ATLASSIAN_ORDERS_SETUP.md](./ATLASSIAN_ORDERS_SETUP.md) for complete details on:
- Architecture
- API endpoints
- Database schema
- Advanced configuration
- Development guide

---

## ✨ Summary

You now have a fully automated system that:
1. **Checks emails every 15 minutes automatically**
2. **Lets you manually check anytime** with a button
3. **Extracts and categorizes** employee data
4. **Exports to JSON** for other systems
5. **Cleans up emails** after processing

No more manual file uploads! Just forward emails to the folder and the system handles the rest. 🎉

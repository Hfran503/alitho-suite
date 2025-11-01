# Enfocus Switch PDF Upload - Setup Complete!

## What Was Built

A complete PDF upload system that integrates with Enfocus Switch using **SFTP** for near real-time file transfer:

### ✅ Database Schema
- New `SwitchPdfUpload` table to track all PDF uploads
- Stores file metadata, upload status, and Switch responses
- Migration applied successfully

### ✅ API Endpoints
1. **POST /api/switch/upload-pdf** - Upload PDF and send to Switch
2. **GET /api/switch/uploads** - List upload history with pagination
3. **POST /api/switch/uploads/[id]/retry** - Retry failed uploads

### ✅ User Interface
- New page: [/switch-upload](http://localhost:3000/switch-upload)
- Drag & drop PDF upload
- Optional metadata (job number, customer name)
- Real-time upload history with status tracking
- Retry button for failed uploads

### ✅ Features
- PDF validation (file type & size)
- Automatic S3 backup of all PDFs
- Immediate push to Enfocus Switch Submit Point
- Error handling with retry capability
- Multi-tenant support
- Authentication & authorization

---

## Next Steps to Get It Running

### 1. Set Up SFTP Server

**Quick Option - Using OpenSSH (Linux):**

```bash
# Install OpenSSH server
sudo apt update && sudo apt install openssh-server

# Create user for Switch
sudo useradd -m -d /home/switchuser -s /bin/bash switchuser
sudo passwd switchuser  # Set password

# Create upload directory
sudo mkdir -p /home/switchuser/switch-inbox
sudo chown switchuser:switchuser /home/switchuser/switch-inbox

# Start SSH service
sudo systemctl enable ssh && sudo systemctl start ssh
```

**Other Options:**
- Windows: Use FileZilla Server
- Docker: `docker run -p 2222:22 -v /upload:/home/switchuser/switch-inbox atmoz/sftp switchuser:password:1001`

See [SFTP_SETUP_GUIDE.md](SFTP_SETUP_GUIDE.md) for detailed instructions.

### 2. Add Environment Variables

Add to your `.env` file:

```bash
# SFTP Configuration
SFTP_HOST=192.168.1.100        # Your SFTP server
SFTP_PORT=22
SFTP_USERNAME=switchuser
SFTP_PASSWORD=your-password
SFTP_UPLOAD_PATH=/switch-inbox
```

### 3. Configure Enfocus Switch

In **Switch Designer**:

1. Drag **"FTP receive"** element from **Communication** section
2. Configure connection:
   - **Protocol**: SFTP
   - **Server**: `192.168.1.100`
   - **Port**: `22`
   - **Username**: `switchuser`
   - **Password**: `your-password`
3. Configure polling:
   - **Folder**: `/switch-inbox`
   - **Poll interval**: `5 seconds`
   - **File pattern**: `*.pdf`
4. Enable: **Remove files after download**
5. Connect output to your workflow
6. Save and activate

### 4. Test SFTP Connection

```bash
# Test from your web server
sftp switchuser@192.168.1.100
# Try: cd switch-inbox, ls, quit
```

### 5. Restart Your Application

```bash
pnpm dev
```

### 6. Test the Integration!

1. Navigate to: [http://localhost:3000/switch-upload](http://localhost:3000/switch-upload)
2. Upload a test PDF
3. Within 1-5 seconds, file should appear in Switch
4. Check upload history on the page

---

## File Structure

```
apps/web/
├── app/
│   ├── (dashboard)/
│   │   └── switch-upload/
│   │       ├── page.tsx          # Upload UI
│   │       └── README.md         # Full documentation
│   └── api/
│       └── switch/
│           ├── upload-pdf/
│           │   └── route.ts      # Upload endpoint
│           └── uploads/
│               ├── route.ts      # List uploads
│               └── [id]/
│                   └── retry/
│                       └── route.ts  # Retry failed upload

prisma/
└── schema.prisma                 # Added SwitchPdfUpload model

.env.example                      # Updated with Switch config
```

---

## How It Works

### Upload Flow

```
1. User selects PDF file
   ↓
2. File uploaded to S3 for backup
   ↓
3. Database record created (status: "uploading")
   ↓
4. File uploaded to SFTP server (/switch-inbox)
   ↓
5. Status updated to "sent" or "failed"
   ↓
6. Switch polls SFTP folder (every 5 seconds)
   ↓
7. Switch downloads and processes the PDF
```

**Timeline:**
- Upload to S3: < 1 second
- Upload to SFTP: 1-2 seconds (local network)
- Switch detection: 1-5 seconds (based on poll interval)
- **Total: 2-8 seconds** from upload to Switch processing

### Status Lifecycle

- **pending** → Upload record created
- **uploading** → Uploading to S3
- **sent** → Successfully sent to Switch ✓
- **failed** → Failed to send (can retry) ⚠️

---

## Configuration Options

### Adjust File Size Limit

Edit `apps/web/app/api/switch/upload-pdf/route.ts`:

```typescript
const MAX_FILE_SIZE = 50 * 1024 * 1024 // Change to desired size
```

### Add Custom Metadata Fields

Modify the UI form in `apps/web/app/(dashboard)/switch-upload/page.tsx`:

```tsx
// Add more input fields
<input
  type="text"
  value={customField}
  onChange={(e) => setCustomField(e.target.value)}
  placeholder="Custom field"
/>

// Include in metadata
const metadata = {
  jobNumber,
  customerName,
  customField,  // Your new field
}
```

---

## Troubleshooting

### "Switch Submit URL not configured"
→ Check `.env` has `SWITCH_SUBMIT_URL` set
→ Restart the application

### "Failed to send to Switch"
→ Verify Switch server is running
→ Test connectivity: `curl http://[switch-ip]:8080/submit`
→ Check firewall rules
→ Verify Submit Point is started in Switch

### Authentication errors
→ Check `SWITCH_AUTH_TOKEN` matches Switch config
→ Try without auth first to test basic connectivity

### PDF still uploads even when Switch fails
→ This is intentional! Files are backed up to S3
→ Use the Retry button to resend to Switch

---

## Documentation

Full documentation available at:
- [apps/web/app/(dashboard)/switch-upload/README.md](apps/web/app/(dashboard)/switch-upload/README.md)

---

## What's Next?

### Optional Enhancements

1. **Batch Upload** - Upload multiple PDFs at once
2. **Webhooks** - Let Switch notify when processing is complete
3. **Email Notifications** - Alert on success/failure
4. **Download PDFs** - View/download from history
5. **Advanced Filtering** - Search by job number, date, etc.

---

## Support

If you encounter issues:

1. Check the detailed README in the switch-upload folder
2. Review Switch logs for processing errors
3. Check browser console for client errors
4. Review server logs for API errors

Enjoy your new Enfocus Switch integration! 🚀

# Enfocus Switch PDF Upload Integration

This feature allows users to upload PDF files that are automatically sent to Enfocus Switch for processing.

## Architecture

**PUSH-based integration:**
1. User uploads PDF via web interface
2. PDF is stored in S3 for backup/audit
3. PDF is immediately POSTed to Switch Submit Point
4. Status is tracked in database
5. Failed uploads can be retried

## Setup

### 1. Enfocus Switch Configuration

In Enfocus Switch Designer:
1. Go to **Configurators** → **Submit Points**
2. Create a new **HTTP Submit Point**
3. Configure:
   - **Port**: e.g., 8080
   - **Authentication**: Recommended (Bearer token or Basic auth)
   - **Path**: e.g., `/submit`
4. Connect the Submit Point to your workflow entry point
5. Note the URL: `http://your-switch-server:8080/submit`

### 2. Environment Variables

Add these to your `.env` file:

```env
# Enfocus Switch Submit Point Configuration
SWITCH_SUBMIT_URL=http://your-switch-server:8080/submit
SWITCH_AUTH_TOKEN=your-secret-token-here  # Optional but recommended

# S3 Configuration (already configured)
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
# S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY if not using IAM roles
```

### 3. Network Configuration

Ensure your web application server can reach the Switch server:
- If Switch is on-premises: Configure firewall rules
- If Switch is in cloud: Use private network or VPN
- Test connectivity: `curl http://your-switch-server:8080/submit`

## Features

### PDF Upload
- **Drag & drop** or file browser
- **PDF validation** (file type and size)
- **Metadata support** (job number, customer name, etc.)
- **Immediate feedback** on upload success/failure
- **S3 backup** of all uploaded files

### Upload Tracking
- View complete upload history
- Filter by status (pending, sent, failed)
- Retry failed uploads
- See error messages for debugging

### Status Flow
1. **pending** - Upload record created
2. **uploading** - File being uploaded to S3
3. **sent** - Successfully sent to Switch
4. **failed** - Failed to send to Switch (can retry)

## API Endpoints

### POST `/api/switch/upload-pdf`
Upload a PDF file to Switch.

**Request:**
```
Content-Type: multipart/form-data

file: PDF file (max 50MB)
metadata: JSON string (optional)
  {
    "jobNumber": "12345",
    "customerName": "ACME Corp"
  }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "filename": "document.pdf",
    "status": "sent",
    "sentToSwitch": true
  }
}
```

### GET `/api/switch/uploads`
List uploaded PDFs.

**Query Parameters:**
- `status` - Filter by status (optional)
- `limit` - Number of records (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0
  }
}
```

### POST `/api/switch/uploads/:id/retry`
Retry a failed upload.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "status": "sent"
  }
}
```

## Database Schema

The `SwitchPdfUpload` model tracks all uploads:

```prisma
model SwitchPdfUpload {
  id               String    @id @default(cuid())
  filename         String
  originalFilename String
  fileSize         Int
  mimeType         String
  s3Bucket         String?
  s3Key            String?
  s3Url            String?
  status           String    // pending, uploading, sent, failed
  switchSubmitUrl  String?
  switchResponse   Json?
  errorMessage     String?
  metadata         Json?
  tenantId         String
  uploadedBy       String?
  createdAt        DateTime
  updatedAt        DateTime
  sentToSwitchAt   DateTime?
}
```

## Troubleshooting

### Upload fails with "Switch Submit URL not configured"
- Check that `SWITCH_SUBMIT_URL` is set in `.env`
- Restart the application after adding environment variables

### Upload fails with "Failed to send to Switch: ..."
- Verify Switch server is running and accessible
- Check firewall rules and network connectivity
- Verify the Submit Point URL is correct
- Check Switch logs for error details

### Authentication errors
- Ensure `SWITCH_AUTH_TOKEN` matches Switch configuration
- Check Switch Submit Point authentication settings

### File size limits
- Maximum file size: 50MB (configurable in code)
- Adjust `MAX_FILE_SIZE` in `/api/switch/upload-pdf/route.ts`

## Future Enhancements

Potential improvements:
- [ ] Batch upload multiple PDFs
- [ ] Download original PDF from history
- [ ] Email notifications on success/failure
- [ ] Webhook from Switch to update processing status
- [ ] Advanced filtering and search
- [ ] Export upload history to CSV

# Enfocus Switch SFTP Integration - Complete Setup Guide

## Overview

This guide will help you set up SFTP-based PDF upload to Enfocus Switch for **near real-time** file transfer (1-5 second delay).

### Architecture

```
User uploads PDF → Web App → SFTP Server → Switch monitors folder → Processes PDF
                      ↓
                  S3 Backup
```

**Benefits:**
- Near real-time (1-5 second delay)
- Secure (encrypted SFTP)
- Works across networks
- Reliable & battle-tested

---

## Prerequisites

- Enfocus Switch installed and running
- SFTP server accessible from both your web app and Switch
- Network connectivity between all components

---

## Step 1: Set Up SFTP Server

You need an SFTP server that both your web app and Switch can access. Here are three options:

### Option A: Use Existing SFTP Server (Easiest)

If you already have an SFTP server, skip to Step 2.

### Option B: Set Up OpenSSH Server (Linux - Recommended)

**On Ubuntu/Debian:**

```bash
# Install OpenSSH server
sudo apt update
sudo apt install openssh-server

# Create dedicated user for Switch
sudo useradd -m -d /home/switchuser -s /bin/bash switchuser
sudo passwd switchuser  # Set a strong password

# Create upload directory
sudo mkdir -p /home/switchuser/switch-inbox
sudo chown switchuser:switchuser /home/switchuser/switch-inbox

# Enable and start SSH service
sudo systemctl enable ssh
sudo systemctl start ssh

# Test connection
sftp switchuser@localhost
```

**Configuration** (`/etc/ssh/sshd_config`):
```
# Allow SFTP
Subsystem sftp /usr/lib/openssh/sftp-server

# Optional: Restrict user to their home directory
Match User switchuser
    ChrootDirectory /home/switchuser
    ForceCommand internal-sftp
    AllowTcpForwarding no
    X11Forwarding no
```

Restart SSH: `sudo systemctl restart sshd`

### Option C: Use FileZilla Server (Windows)

**Download and Install:**
1. Download from: https://filezilla-project.org/download.php?type=server
2. Install and launch FileZilla Server
3. Create user "switchuser" with password
4. Set home directory: `C:\SwitchInbox`
5. Grant read/write permissions

### Option D: Docker SFTP Server (Any OS)

```bash
# Run SFTP server in Docker
docker run -d \
  --name sftp-switch \
  -p 2222:22 \
  -v /path/to/upload:/home/switchuser/switch-inbox \
  atmoz/sftp \
  switchuser:your-password:1001
```

Test: `sftp -P 2222 switchuser@localhost`

---

## Step 2: Configure Environment Variables

Add to your `.env` file:

```bash
# SFTP Configuration
SFTP_HOST=192.168.1.100        # Your SFTP server IP or hostname
SFTP_PORT=22                    # SFTP port (default 22)
SFTP_USERNAME=switchuser        # SFTP username
SFTP_PASSWORD=your-password     # SFTP password
SFTP_UPLOAD_PATH=/switch-inbox  # Folder on SFTP server
```

**For SSH Key Authentication** (More secure, optional):
```bash
# Instead of SFTP_PASSWORD, use:
SFTP_PRIVATE_KEY=/path/to/private/key
```

---

## Step 3: Configure Enfocus Switch

### 3.1 Add FTP Receive Element

1. Open **Switch Designer**
2. Open your workflow
3. From the **Communication** section, drag **"FTP receive"** element into your workflow
4. Double-click the element to configure

### 3.2 Configure FTP Receive Settings

**Connection Tab:**
- **Protocol**: SFTP (SSH File Transfer Protocol)
- **Server**: `192.168.1.100` (your SFTP server)
- **Port**: `22`
- **Username**: `switchuser`
- **Password**: `your-password`

**Polling Tab:**
- **Folder**: `/switch-inbox` or `switch-inbox` (relative to home)
- **Poll interval**: `5 seconds` (for near real-time)
- **File pattern**: `*.pdf` (only PDF files)

**Options Tab:**
- **Download files**: ✓ Enabled
- **Remove files after download**: ✓ Enabled (recommended)
- **Create subfolders**: ✗ Disabled

**Traffic Light:**
- **Connection timeout**: 30 seconds
- **Error handling**: Retry 3 times, then fail

### 3.3 Connect to Workflow

Connect the **FTP receive** element output to your workflow entry point.

### 3.4 Save and Activate

1. Save the workflow
2. Start/activate the flow
3. The FTP receive element should show **green** (connected)

---

## Step 4: Test the Integration

### 4.1 Test SFTP Connection

```bash
# From your web server, test SFTP connection
sftp switchuser@192.168.1.100
# Enter password when prompted
# Try: ls, pwd, cd switch-inbox
# Exit: quit
```

### 4.2 Manual File Upload Test

```bash
# Upload a test PDF
echo "test" > test.pdf
sftp switchuser@192.168.1.100
sftp> cd switch-inbox
sftp> put test.pdf
sftp> quit
```

**Check Switch**: The file should appear in Switch within 5 seconds.

### 4.3 Web App Upload Test

1. Start your web app: `pnpm dev`
2. Navigate to: http://localhost:3000/switch-upload
3. Upload a PDF file
4. Check upload history - status should show "sent"
5. Verify file appears in Switch workflow within 5 seconds

---

## Step 5: Production Checklist

Before going live:

- [ ] Change default SFTP password to strong password
- [ ] Test SFTP connection from web app server
- [ ] Test SFTP connection from Switch server
- [ ] Verify Switch FTP receive element shows green status
- [ ] Test end-to-end file upload
- [ ] Monitor Switch logs for any errors
- [ ] Set up alerts for failed uploads
- [ ] Configure firewall rules (port 22)
- [ ] Consider using SSH key authentication instead of password

---

## Firewall Configuration

### Allow Port 22 (SFTP)

**Ubuntu/Debian:**
```bash
sudo ufw allow 22/tcp
sudo ufw enable
```

**CentOS/RHEL:**
```bash
sudo firewall-cmd --permanent --add-port=22/tcp
sudo firewall-cmd --reload
```

**Windows:**
1. Open Windows Firewall
2. Inbound Rules → New Rule
3. Port → TCP → Specific local ports: 22
4. Allow the connection

---

## Troubleshooting

### Issue: "SFTP not configured" error

**Solution:**
```bash
# Check .env file has required variables:
SFTP_HOST=...
SFTP_USERNAME=...
SFTP_PASSWORD=...

# Restart web app
pnpm dev
```

### Issue: "Failed to connect to SFTP server"

**Checklist:**
1. Is SFTP server running? `sudo systemctl status ssh` (Linux)
2. Can you ping the server? `ping 192.168.1.100`
3. Is port 22 open? `telnet 192.168.1.100 22`
4. Is username/password correct? Test manually: `sftp switchuser@192.168.1.100`
5. Check firewall rules

### Issue: Switch not picking up files

**Checklist:**
1. Is Switch FTP receive element green/connected?
2. Is the folder path correct? `/switch-inbox` vs `switch-inbox`
3. Is poll interval too long? Try 5 seconds
4. Check Switch logs for errors
5. Manually upload a file and check if Switch sees it
6. Verify file pattern matches: `*.pdf`

### Issue: Permission denied

**Solution (Linux):**
```bash
# Check folder ownership
ls -la /home/switchuser/

# Fix permissions
sudo chown -R switchuser:switchuser /home/switchuser/switch-inbox
sudo chmod 755 /home/switchuser/switch-inbox
```

### Issue: Files uploaded but not deleted

**Solution:**
- Enable "Remove files after download" in Switch FTP receive element
- Ensure switchuser has write/delete permissions on the folder

---

## Network Diagrams

### Same Network Setup
```
┌─────────────┐
│  Web App    │────┐
│  Server     │    │
└─────────────┘    │    SFTP
                   ├──────────┐
┌─────────────┐    │          ▼
│  Switch     │────┘    ┌──────────┐
│  Server     │◄────────│   SFTP   │
└─────────────┘  SFTP   │  Server  │
                        └──────────┘
```

### Cloud to On-Premises Setup
```
        ┌─────────────┐
        │  Web App    │
        │  (Cloud)    │
        └──────┬──────┘
               │ Internet
               │ SFTP
        ┌──────▼──────┐
        │    VPN/     │
        │  Firewall   │
        └──────┬──────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼─────┐        ┌─────▼────┐
│  SFTP   │◄───────│  Switch  │
│ Server  │  SFTP  │  Server  │
└─────────┘        └──────────┘
```

---

## Security Best Practices

1. **Use SSH Keys Instead of Passwords**
   ```bash
   # Generate key pair
   ssh-keygen -t rsa -b 4096 -f switch_sftp_key

   # Copy public key to server
   ssh-copy-id -i switch_sftp_key.pub switchuser@192.168.1.100

   # Update .env
   SFTP_PRIVATE_KEY=/path/to/switch_sftp_key
   # Remove SFTP_PASSWORD
   ```

2. **Restrict User Access**
   - Use chroot jail to confine user to home directory
   - Disable shell access for SFTP-only users
   - Set minimal permissions (755 for folders, 644 for files)

3. **Monitor & Audit**
   - Enable SSH logging: `/var/log/auth.log` (Linux)
   - Monitor failed login attempts
   - Set up alerts for unusual activity

4. **Network Security**
   - Use VPN for cloud-to-on-premises connections
   - Whitelist IP addresses in firewall
   - Change default SSH port (optional): Port 2222 instead of 22

---

## Advanced Configuration

### Custom File Naming

Modify upload endpoint in `apps/web/app/api/switch/upload-pdf/route.ts`:

```typescript
// Add job number to filename
const remotePath = `${sftpFolder}/${timestamp}-${metadata.jobNumber}-${sanitizedFilename}`
```

### Folder Organization

Upload to different folders based on metadata:

```typescript
// Upload to customer-specific folders
const customerFolder = metadata.customerName.replace(/[^a-zA-Z0-9]/g, '_')
const remotePath = `${sftpFolder}/${customerFolder}/${timestamp}-${sanitizedFilename}`
```

Configure multiple FTP receive elements in Switch, one per customer folder.

### Email Notifications

Add to your upload success handler:

```typescript
// Send email notification
await sendEmail({
  to: 'production@company.com',
  subject: `PDF Uploaded: ${file.name}`,
  body: `Job: ${metadata.jobNumber}\nFile: ${remotePath}`
})
```

---

## Performance Tuning

### Switch Polling Interval

- **1 second**: Most responsive, higher server load
- **5 seconds**: Good balance (recommended)
- **10+ seconds**: Less load, noticeable delay

### Concurrent Uploads

The SFTP library supports concurrent uploads. No configuration needed.

### Network Bandwidth

SFTP typically transfers at:
- **Local network**: 50-100 MB/s
- **VPN**: 10-50 MB/s
- **Internet**: 5-20 MB/s

A 10MB PDF should transfer in:
- Local: < 1 second
- VPN: 1-2 seconds
- Internet: 2-5 seconds

---

## Alternative: Hot Folder (If Same Server)

If your web app and Switch are on the **same machine**, you can skip SFTP and use a hot folder:

```typescript
// Instead of uploadToSftp()
import fs from 'fs/promises'
await fs.writeFile(`/path/to/switch-hotfolder/${filename}`, fileBuffer)
```

Configure Switch to monitor `/path/to/switch-hotfolder` directly.

---

## Support

If you encounter issues:

1. Check logs:
   - Web app: Console output
   - SFTP server: `/var/log/auth.log` (Linux)
   - Switch: Switch Server log files

2. Test each component individually:
   - SFTP connection: `sftp user@host`
   - File upload: Manual SFTP upload
   - Switch monitoring: Place file manually in folder

3. Review documentation:
   - [Enfocus Switch Documentation](https://www.enfocus.com/en/support/switch)
   - [OpenSSH Documentation](https://www.openssh.com/manual.html)

---

## What's Next?

✅ **You're all set!** PDFs uploaded via your web app will automatically appear in Enfocus Switch for processing.

**Recommended next steps:**
1. Test thoroughly with sample PDFs
2. Monitor for a few days to ensure stability
3. Train users on the upload interface
4. Set up monitoring/alerts for failed uploads

Enjoy your real-time PDF workflow! 🚀

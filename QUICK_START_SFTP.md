# Quick Start: PDF Upload to Enfocus Switch via SFTP

## 🚀 TL;DR - Get Running in 5 Minutes

### 1. Set Up SFTP Server (Pick One)

**Option A - Linux (Recommended):**
```bash
sudo apt install openssh-server
sudo useradd -m switchuser && sudo passwd switchuser
sudo mkdir -p /home/switchuser/switch-inbox
sudo chown switchuser:switchuser /home/switchuser/switch-inbox
```

**Option B - Docker:**
```bash
docker run -d -p 2222:22 -v /upload:/home/switchuser/switch-inbox \
  atmoz/sftp switchuser:yourpassword:1001
```

**Option C - Windows:**
Download FileZilla Server → Create user "switchuser" → Set folder: `C:\SwitchInbox`

---

### 2. Configure Environment Variables

Add to `.env`:
```bash
SFTP_HOST=192.168.1.100
SFTP_PORT=22
SFTP_USERNAME=switchuser
SFTP_PASSWORD=yourpassword
SFTP_UPLOAD_PATH=/switch-inbox
```

---

### 3. Configure Switch FTP Receive

In Switch Designer:
1. Add **"FTP receive"** element
2. Set **Protocol**: SFTP
3. Set **Server**: 192.168.1.100, **Port**: 22
4. Set **Folder**: `/switch-inbox`, **Poll**: 5 seconds
5. Connect to workflow → Save → Activate

---

### 4. Test It!

```bash
# Start app
pnpm dev

# Visit
open http://localhost:3000/switch-upload

# Upload a PDF and watch it appear in Switch within 5 seconds!
```

---

## ✅ What You Get

- **Real-time uploads** (2-8 second total latency)
- **S3 backup** of all PDFs
- **Upload history** with retry capability
- **Metadata support** (job number, customer name)
- **Secure SFTP** encryption

---

## 📖 Full Documentation

- **Detailed Setup**: [SFTP_SETUP_GUIDE.md](SFTP_SETUP_GUIDE.md)
- **Complete Overview**: [SWITCH_UPLOAD_SETUP.md](SWITCH_UPLOAD_SETUP.md)
- **In-App Help**: `/switch-upload/README.md`

---

## 🔧 Troubleshooting

**Can't connect to SFTP?**
```bash
# Test manually
sftp switchuser@192.168.1.100
```

**Switch not picking up files?**
- Check FTP receive element is green (connected)
- Verify folder path: `/switch-inbox` (with leading slash)
- Set poll interval to 5 seconds
- Check Switch logs

**Upload fails?**
- Verify all env vars are set
- Restart app: `pnpm dev`
- Check SFTP server is running

---

## 💡 Pro Tips

1. **Faster Detection**: Set Switch poll interval to 1-2 seconds
2. **Security**: Use SSH keys instead of password (see full guide)
3. **Organization**: Add job number to filenames for easier tracking
4. **Monitoring**: Watch upload history at `/switch-upload`

---

**Need Help?** See [SFTP_SETUP_GUIDE.md](SFTP_SETUP_GUIDE.md) for:
- Detailed SFTP server setup
- Network configuration
- Switch configuration screenshots
- Advanced security options
- Performance tuning

---

Happy automating! 🎉

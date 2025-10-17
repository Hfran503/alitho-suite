# Dokploy Deployment Guide

## Required Environment Variables

These environment variables MUST be configured in Dokploy for the application to work:

### 1. Database (Required)
```bash
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
SHADOW_DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
```

### 2. Redis (Required)
```bash
REDIS_URL=redis://your-redis-host:6379
# OR for Upstash Redis:
REDIS_URL=rediss://default:your-password@your-host.upstash.io:6379
```

### 3. NextAuth (Required)
```bash
NEXTAUTH_URL=https://your-production-domain.com
NEXTAUTH_SECRET=your-generated-secret-here
```
**Generate secret with:** `openssl rand -base64 32`

### 4. AWS S3 (Required for file uploads)
```bash
S3_BUCKET=your-bucket-name
S3_REGION=us-west-1
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

### 5. PACE API (Required for shipments)
```bash
PACE_API_URL=http://192.168.1.218/rpc/rest/services
PACE_USERNAME=CalithoSuiteAPI
PACE_PASSWORD=Calitho94520!!
```

**⚠️ IMPORTANT: Network Connectivity**
- The PACE API URL uses a private IP address (192.168.1.218)
- This will ONLY work if your Dokploy server is on the same network
- If Dokploy is hosted remotely (cloud), you need:
  - VPN connection to your local network, OR
  - Expose PACE API through a public endpoint/domain, OR
  - Use SSH tunneling

## How to Add Environment Variables in Dokploy

### Option 1: Through Dokploy UI (Recommended)
1. Log into Dokploy dashboard
2. Navigate to your application
3. Go to **"Environment"** tab
4. Click **"Add Variable"**
5. Add each variable with its key and value
6. Click **"Save"**
7. **Redeploy** the application

### Option 2: Through Dokploy CLI
```bash
dokploy app:env:set calitho-suite-app KEY=VALUE
dokploy app:redeploy calitho-suite-app
```

## Verifying Environment Variables

After deploying, you can verify environment variables are loaded:

### Method 1: Use Debug Endpoint
1. Visit: `https://your-domain.com/api/debug/env`
2. Login first to authenticate
3. Check which variables are configured

### Method 2: Check Application Logs
```bash
# In Dokploy, view application logs
# Look for errors like "PACE API not configured"
```

## Common Issues

### Issue 1: "PACE API not configured"
**Cause:** Environment variables not set in Dokploy
**Fix:** Add PACE_API_URL, PACE_USERNAME, PACE_PASSWORD in Dokploy environment settings

### Issue 2: Cannot connect to PACE API
**Cause:** Network connectivity - Dokploy can't reach 192.168.1.218
**Fix:**
- Verify Dokploy server is on same network as PACE API
- Try pinging from Dokploy server: `ping 192.168.1.218`
- Check firewall rules

### Issue 3: Database connection errors
**Cause:** DATABASE_URL not set or incorrect
**Fix:** Verify connection string in Dokploy environment settings

### Issue 4: NextAuth errors / Can't login
**Cause:** NEXTAUTH_SECRET or NEXTAUTH_URL not set
**Fix:** Set both variables and ensure NEXTAUTH_URL matches your domain

## Testing Network Connectivity to PACE API

If Dokploy server has SSH access:

```bash
# SSH into Dokploy server
ssh user@dokploy-server

# Test if PACE API is reachable
curl -v http://192.168.1.218/rpc/rest/services/FindObjects/findSortAndLimit

# Test with authentication
curl -u "CalithoSuiteAPI:Calitho94520!!" \
  http://192.168.1.218/rpc/rest/services/FindObjects/findSortAndLimit
```

## Deployment Checklist

- [ ] All environment variables added in Dokploy
- [ ] NEXTAUTH_SECRET generated and set
- [ ] NEXTAUTH_URL matches production domain
- [ ] Database connection tested
- [ ] Redis connection tested
- [ ] S3 credentials configured
- [ ] PACE API reachable from Dokploy server
- [ ] Application redeployed after adding env vars
- [ ] Verified env vars loaded via `/api/debug/env`
- [ ] Test login functionality
- [ ] Test shipments page

## Support

If you continue to have issues:
1. Check `/api/debug/env` endpoint
2. Review Dokploy application logs
3. Test network connectivity from Dokploy server
4. Verify all environment variables are saved in Dokploy

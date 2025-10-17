# Troubleshooting Guide

## Issue: "PACE API not configured" Error in Production

### Symptoms
```
Error: PACE API not configured. Please set PACE_API_URL in environment variables.
```

### Root Cause
Environment variables are not being injected into the Docker container by Dokploy.

### Solution Steps

#### Step 1: Verify Environment Variables in Dokploy UI

1. **Login to Dokploy dashboard**
2. **Navigate to your application**: `calitho-suite-app`
3. **Go to Environment Variables section** (look for tabs like: Settings, Environment, Config, or Variables)
4. **Check if these variables exist:**
   - `PACE_API_URL`
   - `PACE_USERNAME`
   - `PACE_PASSWORD`

#### Step 2: Add Missing Environment Variables

If the variables are missing, add them:

```bash
PACE_API_URL=http://192.168.1.218/rpc/rest/services
PACE_USERNAME=CalithoSuiteAPI
PACE_PASSWORD=Calitho94520!!
```

**Also add these required variables if missing:**
```bash
DATABASE_URL=postgresql://your-connection-string
REDIS_URL=redis://your-redis-url
NEXTAUTH_URL=https://your-production-domain.com
NEXTAUTH_SECRET=your-secret-here
S3_BUCKET=your-bucket
S3_REGION=us-west-1
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
```

#### Step 3: Save and Redeploy

1. **Click "Save"** after adding variables
2. **Trigger a redeploy** (look for buttons like "Redeploy", "Restart", or "Deploy")
3. **Wait for deployment to complete** (2-3 minutes)

#### Step 4: Verify Variables Were Loaded

After deployment, visit this URL (login first):
```
http://calitho-suite-app-s1ykce-43d957-85-31-225-163.traefik.me/api/debug/env
```

You should see:
```json
{
  "success": true,
  "data": {
    "summary": {
      "configured": 13,
      "missing": 0
    },
    "variables": {
      "PACE_API_URL": true,
      "PACE_USERNAME": true,
      "PACE_PASSWORD": true,
      "DATABASE_URL": true,
      ...
    }
  }
}
```

If you see `"PACE_API_URL": false`, the variable is NOT being injected by Dokploy.

---

## Issue: 404 Errors for Dashboard Routes

### Symptoms
```
GET /dashboard/orders?_rsc=u4k0h 404 (Not Found)
GET /dashboard/customers?_rsc=u4k0h 404 (Not Found)
GET /dashboard/products?_rsc=u4k0h 404 (Not Found)
```

### Root Cause
These routes don't exist in your application. The sidebar is linking to routes that haven't been created yet.

### Available Routes
These routes ARE available:
- `/dashboard` - Main dashboard
- `/settings` - Settings page
- `/shipments` - Shipments list
- `/shipments-by-date` - Shipments by date
- `/shipments/[id]` - Shipment details

### Solution
Either:
1. **Remove links** from the sidebar for non-existent routes, OR
2. **Create placeholder pages** for these routes

To remove the links, edit the sidebar navigation in:
```
apps/web/components/Sidebar.tsx
```

---

## Issue: Network Connectivity to PACE API

### Symptoms
Even with environment variables set, PACE API calls fail with connection timeouts or network errors.

### Root Cause
PACE API is at `http://192.168.1.218` - a private network IP address. Your Dokploy server cannot reach this address if it's not on the same network.

### Check Network Connectivity

1. **SSH into your Dokploy server**
2. **Test connectivity:**
   ```bash
   # Test if PACE API is reachable
   curl -v http://192.168.1.218/rpc/rest/services/FindObjects/findSortAndLimit

   # Test with authentication
   curl -u "CalithoSuiteAPI:Calitho94520!!" \
     -H "Content-Type: application/json" \
     -X POST \
     http://192.168.1.218/rpc/rest/services/FindObjects/findSortAndLimit
   ```

3. **Expected results:**
   - ✅ **Success**: You get a response (even if it's an error from PACE, means connectivity works)
   - ❌ **Failure**: Connection timeout, connection refused, or no route to host

### Solutions if Network is Unreachable

#### Option 1: VPN (Recommended for Remote Servers)
Set up a VPN connection between Dokploy server and your local network where PACE API runs.

#### Option 2: SSH Tunnel (Temporary/Testing)
```bash
# On Dokploy server, create tunnel to local network
ssh -L 8080:192.168.1.218:80 user@your-local-gateway

# Then in Dokploy, set:
PACE_API_URL=http://localhost:8080/rpc/rest/services
```

#### Option 3: Expose PACE API (Use with Caution)
Expose PACE API through:
- Reverse proxy with authentication
- Cloudflare Tunnel
- ngrok or similar service

⚠️ **Security Warning**: Only expose PACE API if you have proper authentication and encryption.

#### Option 4: Deploy on Same Network
Deploy Dokploy on a server that's on the same network as PACE API (192.168.1.x).

---

## Quick Diagnostic Checklist

Run through this checklist:

- [ ] Environment variables added in Dokploy UI
- [ ] Application redeployed after adding variables
- [ ] `/api/debug/env` shows `PACE_API_URL: true`
- [ ] Dokploy server can ping `192.168.1.218`
- [ ] Dokploy server can curl PACE API endpoint
- [ ] No firewall blocking traffic between Dokploy and PACE API
- [ ] PACE API credentials are correct

---

## Getting Help

If issues persist:

1. **Check Dokploy logs:**
   - Look for environment variable injection logs
   - Check for startup errors

2. **Check application logs:**
   - In Dokploy, view application container logs
   - Look for errors during startup

3. **Test debug endpoint:**
   - Visit `/api/debug/env` to see which vars are loaded
   - This will show exactly what the app sees

4. **Network testing:**
   - SSH into Dokploy server
   - Test connectivity to PACE API
   - Verify firewall rules

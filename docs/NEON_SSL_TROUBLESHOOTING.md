# Neon Database SSL/TLS Troubleshooting

## The Problem

You may encounter this error when deploying to Dokploy:

```
Error: P1011: Error opening a TLS connection: error:0A00041A:SSL routines:ssl3_read_bytes:tlsv1 alert decode error:../ssl/record/rec_layer_s3.c:1599:SSL alert number 50
```

## Root Cause

This error occurs when Prisma cannot establish a secure TLS/SSL connection to the Neon database. Common causes include:

1. **Missing SSL parameters** in the `DATABASE_URL`
2. **SSL version incompatibility** between the client (Prisma) and server (Neon)
3. **Incorrect SSL mode** configuration
4. **Using a pooler connection** instead of a direct connection for migrations

## Solutions

### Solution 1: Add SSL Parameters to DATABASE_URL (Recommended)

Update your `DATABASE_URL` in Dokploy to include explicit SSL parameters:

```bash
# Before (may cause SSL errors):
DATABASE_URL="postgresql://neondb_owner:password@ep-super-sky-xxx.c-2.us-east-1.aws.neon.tech/neondb"

# After (recommended):
DATABASE_URL="postgresql://neondb_owner:password@ep-super-sky-xxx.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Or with additional SSL strictness:
DATABASE_URL="postgresql://neondb_owner:password@ep-super-sky-xxx.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&sslaccept=strict"
```

**Available SSL modes:**
- `disable` - No SSL (not recommended for production)
- `prefer` - Try SSL first, fall back to non-SSL (default, but may cause issues)
- `require` - Require SSL, fail if not available **(recommended)**
- `verify-ca` - Require SSL and verify server certificate
- `verify-full` - Require SSL, verify server certificate and hostname

### Solution 2: Use Direct Connection (Not Pooler)

Neon provides two types of connection strings:

1. **Pooler connection** (for application runtime):
   - Format: `ep-xxx-pooler.c-2.us-east-1.aws.neon.tech`
   - Good for: High-concurrency connections
   - Bad for: Migrations (doesn't support advisory locks)

2. **Direct connection** (for migrations):
   - Format: `ep-xxx.c-2.us-east-1.aws.neon.tech`
   - Good for: Migrations, administrative tasks
   - Bad for: Very high connection counts

**Our [start.sh](../start.sh) automatically converts pooler URLs to direct URLs for migrations**, but you should still set the correct URL in your environment variables.

### Solution 3: Check Node.js and OpenSSL Versions

The error may also occur if the Docker image uses incompatible SSL/TLS versions. Our Dockerfile uses `node:20-bookworm` which should have modern OpenSSL support.

If issues persist, you could try:
- Updating to the latest Node.js LTS version
- Using a different base image (e.g., `node:20-alpine`)

## How the Automatic Fix Works

The [start.sh](../start.sh#L49-L63) script includes automatic SSL parameter detection:

```bash
# Ensure SSL parameters are present in the connection string
if [[ "$MIGRATION_DATABASE_URL" == *"neon.tech"* ]] && [[ "$MIGRATION_DATABASE_URL" != *"sslmode="* ]]; then
  echo "⚠️  Adding SSL parameters for Neon database connection"

  # Check if URL already has query parameters
  if [[ "$MIGRATION_DATABASE_URL" == *"?"* ]]; then
    # Append to existing parameters
    MIGRATION_DATABASE_URL="${MIGRATION_DATABASE_URL}&sslmode=require&sslaccept=strict"
  else
    # Add new parameters
    MIGRATION_DATABASE_URL="${MIGRATION_DATABASE_URL}?sslmode=require&sslaccept=strict"
  fi

  echo "   SSL parameters added: sslmode=require&sslaccept=strict"
fi
```

This means:
1. If you're using a Neon database
2. And your `DATABASE_URL` doesn't have SSL parameters
3. The script automatically adds `sslmode=require&sslaccept=strict`

## Verification Steps

After applying the fix:

1. **Check the Dokploy logs** during deployment:
   ```
   ⚠️  Adding SSL parameters for Neon database connection
   SSL parameters added: sslmode=require&sslaccept=strict
   ```

2. **Verify migrations run successfully**:
   ```
   Running database migrations...
   ✓ Migrations completed successfully
   ```

3. **Test the database connection** from your application

## Getting Your Correct DATABASE_URL from Neon

1. Log into your Neon console: https://console.neon.tech
2. Navigate to your project
3. Go to **Dashboard** > **Connection Details**
4. Copy the **Direct connection string** (not the pooler one)
5. Ensure it includes `?sslmode=require` at the end

Example:
```
postgresql://neondb_owner:npg_xxxxx@ep-super-sky-xxx.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## Still Having Issues?

If the error persists after trying these solutions:

1. **Check Neon status**: https://neon.tech/status
2. **Verify network connectivity** from Dokploy server:
   ```bash
   # SSH into Dokploy server
   nc -zv ep-super-sky-xxx.c-2.us-east-1.aws.neon.tech 5432
   ```

3. **Test the connection string locally**:
   ```bash
   # Install psql locally
   psql "postgresql://neondb_owner:password@ep-super-sky-xxx.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
   ```

4. **Check Dokploy logs** for more detailed error messages

5. **Contact Neon support** if it's a server-side issue

## Related Files

- [start.sh](../start.sh) - Startup script with automatic SSL parameter addition
- [DOKPLOY_DEPLOYMENT.md](../DOKPLOY_DEPLOYMENT.md) - General deployment guide
- [prisma/schema.prisma](../prisma/schema.prisma) - Prisma schema configuration

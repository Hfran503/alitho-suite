# Neon Database Pooler Migration Fix

## Problem

When deploying to Dokploy with Neon PostgreSQL, migrations fail with:

```
Error: P1002
The database server at `ep-xxx-pooler.c-2.us-east-1.aws.neon.tech:5432` was reached but timed out.
Context: Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369)).
Elapsed: 10000ms.
```

## Root Cause

Neon provides two types of connection URLs:

1. **Pooled connection** (`-pooler.` in hostname):
   - Example: `ep-super-sky-ad1f0egf-pooler.c-2.us-east-1.aws.neon.tech`
   - Uses PgBouncer for connection pooling
   - ❌ **Does NOT support PostgreSQL advisory locks**
   - ❌ **Cannot be used for Prisma migrations**
   - ✅ Good for application runtime queries

2. **Direct connection** (no `-pooler` in hostname):
   - Example: `ep-super-sky-ad1f0egf.c-2.us-east-1.aws.neon.tech`
   - Direct PostgreSQL connection
   - ✅ **Supports advisory locks**
   - ✅ **Required for Prisma migrations**
   - May have connection limits

Prisma uses PostgreSQL advisory locks (`pg_advisory_lock`) during migrations to ensure only one migration runs at a time. Connection poolers like PgBouncer don't support these locks, causing timeouts.

## Solution

### Automatic Fix (Recommended)

The updated `start.sh` script now automatically:

1. **Detects pooler URLs** - Checks if DATABASE_URL contains `-pooler.`
2. **Converts to direct URL** - Automatically removes `-pooler` for migrations only
3. **Retries with backoff** - Retries 3 times with exponential backoff if it fails
4. **Uses pooler for runtime** - Still uses the pooled connection for the app

### Manual Fix Options

#### Option 1: Update DATABASE_URL in Dokploy (Best for Production)

In your Dokploy environment variables:

```bash
# Change this:
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.c-2.us-east-1.aws.neon.tech/db

# To this (remove '-pooler'):
DATABASE_URL=postgresql://user:pass@ep-xxx.c-2.us-east-1.aws.neon.tech/db
```

**Pros:**
- Simple, one-time fix
- Works for all deployments
- No code changes needed

**Cons:**
- Loses pooling benefits (not recommended for high-traffic apps)
- May hit Neon's connection limits

#### Option 2: Use Separate URLs (Best Practice)

Set two environment variables in Dokploy:

```bash
# Direct connection for migrations
DATABASE_URL=postgresql://user:pass@ep-xxx.c-2.us-east-1.aws.neon.tech/db

# Pooled connection for runtime queries (optional)
DATABASE_POOL_URL=postgresql://user:pass@ep-xxx-pooler.c-2.us-east-1.aws.neon.tech/db
```

Then update your Prisma schema:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DATABASE_URL") // Use direct URL for migrations
}
```

**Pros:**
- Best of both worlds
- Direct connection for migrations
- Can use pooler for app queries if needed

**Cons:**
- Requires schema change
- More complex setup

#### Option 3: Release Stuck Lock (Emergency Only)

If migrations are stuck due to a held lock, run:

```bash
cd packages/database
psql "$DATABASE_URL" -f scripts/release-migration-lock.sql
```

Or directly in SQL:

```sql
SELECT pg_advisory_unlock_all();
```

## What Changed

### Files Modified

1. **`start.sh`** - Added automatic pooler URL detection and retry logic
2. **`scripts/migrate-with-retry.sh`** - New standalone migration script with retries
3. **`packages/database/scripts/release-migration-lock.sql`** - Emergency lock release

### Key Code Changes

```bash
# Detect and convert pooler URL
if [[ "$DATABASE_URL" == *"-pooler."* ]]; then
  DIRECT_URL="${DATABASE_URL//-pooler./-.}"
  MIGRATION_DATABASE_URL="$DIRECT_URL"
fi

# Run migration with retry
env DATABASE_URL="$MIGRATION_DATABASE_URL" pnpm db:migrate
```

## Verification

After deploying, check the logs for:

```
✓ Converted to direct URL for migrations
Using: postgresql://...@ep-xxx.c-2...
✓ Migrations completed successfully
```

## Related Links

- [Prisma Advisory Locking Docs](https://pris.ly/d/migrate-advisory-locking)
- [Neon Connection Pooling](https://neon.tech/docs/connect/connection-pooling)
- [PgBouncer Limitations](https://www.pgbouncer.org/faq.html)

## Summary

**The fix is now automatic.** Your deployments should work without manual intervention. The `start.sh` script will:

1. Detect pooler URLs
2. Convert to direct connection for migrations
3. Retry on timeout
4. Provide clear error messages if manual intervention is needed

If you still see migration failures, check that:
- Your DATABASE_URL is correct in Dokploy
- The Neon database is accessible
- No other process is running migrations simultaneously

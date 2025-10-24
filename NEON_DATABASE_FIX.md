# Fixing Neon Database Advisory Lock Timeout

## Problem

Your deployment is failing with:
```
Error: P1002
Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369))
```

This happens when:
1. Multiple deployments try to run migrations at the same time
2. A previous migration process crashed and left a lock
3. Database connection pooling interferes with advisory locks

## Solution Options

### Option 1: Clear Stale Locks (Recommended)

Connect to your Neon database and clear any stale advisory locks:

```sql
-- Check for active advisory locks
SELECT * FROM pg_locks WHERE locktype = 'advisory';

-- Release all advisory locks (run this if you see locks)
SELECT pg_advisory_unlock_all();
```

**How to run this:**

1. Go to Neon Console: https://console.neon.tech
2. Navigate to your project
3. Click on "SQL Editor"
4. Run the unlock command:
   ```sql
   SELECT pg_advisory_unlock_all();
   ```

### Option 2: Use Direct Connection for Migrations

Neon provides two connection strings:
- **Pooled**: For application queries (ends with `-pooler.neon.tech`)
- **Direct**: For migrations and admin tasks

Update your migration script to use the **direct connection**:

**In your Dokploy environment variables:**

```bash
# For migrations (direct connection)
DATABASE_URL=postgresql://neondb_owner:password@ep-super-sky-ad1f0egf.c-2.us-east-1.aws.neon.tech:5432/neondb?sslmode=require

# For application (pooled connection - optional, can use same as above)
DATABASE_URL_POOLED=postgresql://neondb_owner:password@ep-super-sky-ad1f0egf-pooler.c-2.us-east-1.aws.neon.tech:5432/neondb?sslmode=require
```

**Notice the difference:**
- Direct: `ep-super-sky-ad1f0egf.c-2.us-east-1.aws.neon.tech` (no `-pooler`)
- Pooled: `ep-super-sky-ad1f0egf-pooler.c-2.us-east-1.aws.neon.tech` (has `-pooler`)

### Option 3: Increase Migration Timeout

Add connection parameters to handle slow connections:

```bash
DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require&connect_timeout=30&pool_timeout=30
```

### Option 4: Disable Migrations in Startup Script (Quick Fix)

If migrations are already up-to-date, you can skip them during deployment.

**Temporary workaround - Check if migrations are needed:**

1. SSH into your Dokploy server or use Neon console
2. Check migration status:
   ```sql
   SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 5;
   ```
3. If all migrations are applied, you can temporarily comment out the migration step

## Recommended Steps

### Step 1: Clear Stale Locks

1. Go to Neon Console
2. Run SQL Editor:
   ```sql
   SELECT pg_advisory_unlock_all();
   ```

### Step 2: Update Connection String

Get your **direct** (non-pooled) connection string from Neon:

1. Go to Neon Console → Your Project → Connection Details
2. Copy the connection string **without** `-pooler`
3. Update in Dokploy environment variables (or AWS Secrets Manager)

### Step 3: Redeploy

After fixing the connection string, redeploy your application.

## Prevention

To prevent this in the future:

### 1. Use Direct Connection for Migrations

Always use the direct connection for migration operations. Update your startup script to differentiate between migration and application connections.

### 2. Run Migrations Once

Ensure only ONE instance runs migrations. In docker-compose, you already have a separate `migrator` service - make sure it runs before the app starts:

```yaml
migrator:
  # ... existing config
  restart: "no"  # ✓ Already set correctly

web:
  depends_on:
    migrator:
      condition: service_completed_successfully  # Add this
```

### 3. Add Connection Pooling Settings

Update your `DATABASE_URL` to include connection parameters:

```bash
postgresql://user:password@host:5432/db?sslmode=require&connect_timeout=30&statement_timeout=60000&pool_timeout=30
```

## Check Migration Status

To see if migrations are actually needed:

```sql
-- See all applied migrations
SELECT migration_name, finished_at, applied_steps_count
FROM "_prisma_migrations"
ORDER BY finished_at DESC;

-- See if there are pending migrations
-- (If this table exists and has all migrations, you're up to date)
```

## Quick Fix for Immediate Deployment

If you need to deploy immediately and migrations are already applied:

1. **Temporarily skip migration step** by setting an environment variable:
   ```bash
   SKIP_MIGRATIONS=true
   ```

2. **Update your startup script** to check this:
   ```bash
   if [ "$SKIP_MIGRATIONS" != "true" ]; then
     echo "Running database migrations..."
     pnpm run db:migrate
   fi
   ```

3. **Deploy with this setting**

4. **Fix the database connection** using Option 1 or 2 above

5. **Remove SKIP_MIGRATIONS** for future deployments

## Contact Neon Support

If the issue persists:
1. The database might be in a bad state
2. Contact Neon support with the advisory lock issue
3. They can manually clear locks or restart the pooler

## Verification

After applying the fix, verify it works:

```bash
# Test the connection
psql "$DATABASE_URL" -c "SELECT version();"

# Test advisory lock
psql "$DATABASE_URL" -c "SELECT pg_try_advisory_lock(72707369); SELECT pg_advisory_unlock_all();"
```

This should return successfully without timing out.

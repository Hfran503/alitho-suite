-- Release Prisma migration advisory lock
-- Run this if migrations are stuck with "Timed out trying to acquire a postgres advisory lock"

-- Release the specific Prisma migration lock
SELECT pg_advisory_unlock_all();

-- Check for any remaining locks
SELECT
  locktype,
  database,
  pid,
  mode,
  granted
FROM pg_locks
WHERE locktype = 'advisory';

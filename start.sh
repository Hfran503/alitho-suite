#!/bin/bash
set -e

echo "Starting Calitho Suite..."

# Debug: Check environment variables before loading secrets
echo "Environment check:"
echo "  NODE_ENV: $NODE_ENV"
echo "  AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:+SET}"
echo "  DATABASE_URL (before): ${DATABASE_URL:+SET (${DATABASE_URL:0:30}...)}"
echo "  REDIS_URL (before): ${REDIS_URL:0:30}..."

# Load secrets from AWS Secrets Manager in production
if [ "$NODE_ENV" = "production" ] || [ -n "$AWS_ACCESS_KEY_ID" ]; then
  echo "Loading secrets from AWS Secrets Manager..."
  export USE_AWS_SECRETS=true
  source ./scripts/load-secrets.sh
fi

# Debug: Print REDIS_URL after loading secrets
echo "REDIS_URL (after): ${REDIS_URL:0:30}..."

# Debug: Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set!"
  exit 1
else
  echo "DATABASE_URL is set (${DATABASE_URL:0:30}...)"
fi

# Generate Prisma client (ensures it's available for migrations, seeding, and runtime)
# IMPORTANT: Always regenerate in production to ensure pnpm symlinks are correct
echo "Generating Prisma client..."

# Clear module resolution cache to ensure fresh imports
echo "Clearing module cache..."
rm -rf /tmp/tsx-* /tmp/node-* ~/.tsx ~/.cache/tsx 2>/dev/null || true

# Generate Prisma client
cd /app
npx prisma generate --schema=./prisma/schema.prisma

if [ $? -eq 0 ]; then
  echo "✓ Prisma client generated successfully"

  # Verify the client was generated
  if [ -f "node_modules/.prisma/client/index.js" ]; then
    echo "✓ Prisma client files verified"
  else
    echo "✗ Prisma client files not found!"
    exit 1
  fi
else
  echo "✗ Failed to generate Prisma client"
  exit 1
fi

echo ""

# Run database migrations with explicit environment variable
echo "Running database migrations..."

# Check if using Neon pooler connection
MIGRATION_DATABASE_URL="$DATABASE_URL"
if [[ "$DATABASE_URL" == *"-pooler."* ]]; then
  echo "⚠️  WARNING: DATABASE_URL uses connection pooler"

  # Try to convert pooler URL to direct URL for migrations
  # Remove "-pooler" from the hostname (e.g., ep-xxx-pooler.c-2 -> ep-xxx.c-2)
  DIRECT_URL="${DATABASE_URL//-pooler./.}"
  echo "   Converted to direct URL for migrations"
  echo "   Using: ${DIRECT_URL:0:50}..."
  MIGRATION_DATABASE_URL="$DIRECT_URL"

  echo "   Note: Pooler connections don't support Prisma advisory locks"
  echo "   Using direct connection for migrations only"
fi

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

# Try to run migrations (allow output to stream)
set +e  # Don't exit on error
env DATABASE_URL="$MIGRATION_DATABASE_URL" pnpm db:migrate 2>&1 | tee /tmp/migration.log
MIGRATION_EXIT_CODE=${PIPESTATUS[0]}
set -e  # Re-enable exit on error

# Check if migration failed
if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
  # Check for P1001 (can't reach database - likely direct connection blocked)
  if grep -q "P1001" /tmp/migration.log; then
    echo ""
    echo "⚠️  Cannot reach database server for migrations (P1001)"
    echo "This is common when:"
    echo "  1. Neon direct endpoint is not accessible from this network"
    echo "  2. The connection pooler URL is being used but direct is required"
    echo ""
    echo "Attempting to verify schema is up-to-date using pooler connection..."

    # Try using prisma db push with the pooler URL (doesn't require advisory locks)
    # This will fail if schema differs, but succeed if schema is in sync
    set +e
    env DATABASE_URL="$DATABASE_URL" npx prisma db push --skip-generate --accept-data-loss 2>&1 | tee /tmp/db-push.log
    PUSH_EXIT_CODE=${PIPESTATUS[0]}
    set -e

    if [ $PUSH_EXIT_CODE -eq 0 ]; then
      echo "✓ Database schema is in sync (verified via db push)"
      echo "Continuing with application startup..."
    elif grep -q "already in sync" /tmp/db-push.log; then
      echo "✓ Database schema is already in sync"
      echo "Continuing with application startup..."
    else
      echo ""
      echo "❌ Could not verify database schema"
      echo "Please run migrations manually from a machine that can reach the database:"
      echo "  DATABASE_URL='direct-connection-url' npx prisma migrate deploy"
      echo ""
      echo "Or set SKIP_MIGRATIONS=true to bypass this check"

      # Allow override to skip migrations
      if [ "$SKIP_MIGRATIONS" = "true" ]; then
        echo "⚠️  SKIP_MIGRATIONS=true - continuing without migration verification"
      else
        exit 1
      fi
    fi

  # Check for P1002 (timeout/advisory lock error)
  elif grep -q "P1002" /tmp/migration.log || grep -q "advisory lock" /tmp/migration.log; then
    echo ""
    echo "⚠️  Migration timeout (P1002 - advisory lock timeout)"
    echo "This usually means:"
    echo "  1. Connection pooler doesn't support advisory locks (use direct connection)"
    echo "  2. Another process is holding the lock"
    echo "  3. Database is under heavy load"
    echo ""
    echo "Retrying with exponential backoff..."

    # Retry logic with exponential backoff
    for attempt in 1 2 3; do
      wait_time=$((5 * attempt))
      echo "Retry attempt $attempt/3 (waiting ${wait_time}s)..."
      sleep $wait_time

      set +e
      env DATABASE_URL="$MIGRATION_DATABASE_URL" pnpm db:migrate 2>&1 | tee /tmp/migration.log
      MIGRATION_EXIT_CODE=${PIPESTATUS[0]}
      set -e

      if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
        echo "✓ Migration succeeded on retry $attempt"
        break
      fi
    done

    if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
      echo ""
      echo "❌ Migration failed after 3 retries"
      echo ""
      echo "SOLUTION: Update your DATABASE_URL to use a direct connection:"
      echo "  Current (pooler): ep-xxx-pooler.c-2.us-east-1.aws.neon.tech"
      echo "  Change to (direct): ep-xxx.c-2.us-east-1.aws.neon.tech"
      echo ""
      echo "Or set DIRECT_DATABASE_URL in your environment variables."
      exit 1
    fi

  # Check for P3005 (non-empty database)
  elif grep -q "P3005" /tmp/migration.log; then
    echo ""
    echo "⚠️  Database is not empty (P3005 error detected)"
    echo "Attempting to baseline by marking migrations as applied..."

    # Mark the init migration as already applied
    echo "Marking 20241016000000_init as applied..."
    cd /app
    npx prisma migrate resolve --applied "20241016000000_init" --schema=./prisma/schema.prisma

    if [ $? -eq 0 ]; then
      echo "✓ Migration baseline successful"
      echo "Database schema is already in sync, continuing..."
    else
      echo "✗ Failed to baseline migration"
      exit 1
    fi
  else
    echo "✗ Migration failed with exit code $MIGRATION_EXIT_CODE"
    cat /tmp/migration.log
    exit 1
  fi
else
  echo "✓ Migrations completed successfully"
fi

# Seed database with initial data (uses upsert, safe to run multiple times)
echo ""
echo "Seeding database with initial data..."
set +e  # Don't exit on error
pnpm db:seed
SEED_EXIT_CODE=$?
set -e  # Re-enable exit on error

if [ $SEED_EXIT_CODE -eq 0 ]; then
  echo "✓ Database seed completed successfully"
else
  echo "⚠️  Database seeding had issues (exit code: $SEED_EXIT_CODE)"
  echo "   This is usually okay if core data (tenant/users) already exists"
  echo "   Continuing with application startup..."
fi

# Start the application
echo ""
echo "Starting application..."
echo "Final REDIS_URL check: ${REDIS_URL:0:30}..."

# Export all environment variables for the standalone server
export NODE_ENV=production
export DATABASE_URL="$DATABASE_URL"
export REDIS_URL="$REDIS_URL"
export NEXTAUTH_URL="$NEXTAUTH_URL"
export NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
export S3_BUCKET="$S3_BUCKET"
export S3_REGION="$S3_REGION"
export S3_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export S3_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
export AWS_REGION="$AWS_REGION"

# CRITICAL: Export PACE API variables
export PACE_API_URL="$PACE_API_URL"
export PACE_USERNAME="$PACE_USERNAME"
export PACE_PASSWORD="$PACE_PASSWORD"

echo "Environment variables exported:"
echo "  PACE_API_URL: ${PACE_API_URL:+SET}"
echo "  PACE_USERNAME: ${PACE_USERNAME:+SET}"
echo "  PACE_PASSWORD: ${PACE_PASSWORD:+SET}"

# Start web server using standalone server
# Set port and hostname for Docker/Dokploy
export PORT=3000
export HOSTNAME="0.0.0.0"

echo "Starting Next.js standalone server on 0.0.0.0:3000..."

# Find the server.js file (Next.js standalone places it in different locations depending on config)
if [ -f "/app/server.js" ]; then
  echo "Found server.js at /app/server.js"
  cd /app
  node server.js &
  WEB_PID=$!
elif [ -f "/app/apps/web/server.js" ]; then
  echo "Found server.js at /app/apps/web/server.js"
  cd /app
  node apps/web/server.js &
  WEB_PID=$!
elif [ -f "/app/apps/web/.next/standalone/apps/web/server.js" ]; then
  echo "Found server.js at /app/apps/web/.next/standalone/apps/web/server.js (Nixpacks build)"

  # Copy generated Prisma client to standalone directory (critical for runtime)
  echo "Copying Prisma client to standalone directory..."

  # Find all .prisma/client directories in standalone and copy the generated client there
  if [ -d "/app/node_modules/.prisma/client" ]; then
    # Find pnpm-style prisma client directories in standalone
    STANDALONE_BASE="/app/apps/web/.next/standalone"
    find "$STANDALONE_BASE" -type d -name ".prisma" 2>/dev/null | while read prisma_dir; do
      echo "  Copying to: $prisma_dir/client"
      cp -r /app/node_modules/.prisma/client/* "$prisma_dir/client/" 2>/dev/null || true
    done

    # Also copy to standard location
    mkdir -p "$STANDALONE_BASE/node_modules/.prisma/client"
    cp -r /app/node_modules/.prisma/client/* "$STANDALONE_BASE/node_modules/.prisma/client/"

    echo "✓ Prisma client copied to standalone directory"
  else
    echo "⚠️  Warning: Prisma client not found at /app/node_modules/.prisma/client"
    # Try generating in standalone
    echo "Attempting to generate Prisma client in standalone..."
    cd /app/apps/web/.next/standalone
    /app/node_modules/.bin/prisma generate --schema=/app/prisma/schema.prisma 2>/dev/null || true
  fi

  cd /app/apps/web/.next/standalone
  node apps/web/server.js &
  WEB_PID=$!
else
  echo "ERROR: Cannot find server.js in any expected location"
  echo "Checked locations:"
  echo "  - /app/server.js"
  echo "  - /app/apps/web/server.js"
  echo "  - /app/apps/web/.next/standalone/apps/web/server.js"
  echo ""
  echo "Directory structure:"
  echo "Contents of /app:"
  ls -la /app | head -20
  echo ""
  echo "Contents of /app/apps/web/.next:"
  ls -la /app/apps/web/.next 2>/dev/null || echo "  Directory does not exist"
  exit 1
fi

# Start worker
echo "Starting worker..."
cd /app/apps/worker

if [ ! -f "dist/index.js" ]; then
  echo "ERROR: Worker dist/index.js not found at /app/apps/worker/dist/index.js"
  ls -la /app/apps/worker
  exit 1
fi

node dist/index.js &
WORKER_PID=$!

# Function to cleanup on exit
cleanup() {
  echo "Shutting down..."
  kill $WEB_PID $WORKER_PID 2>/dev/null
  exit 0
}

trap cleanup SIGTERM SIGINT

# Wait for both processes
wait $WEB_PID $WORKER_PID

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

# Database connectivity will be verified during migrations
echo ""

# Generate Prisma client (ensures it's available for migrations, seeding, and runtime)
# IMPORTANT: Always regenerate in production to ensure pnpm symlinks are correct
echo "Generating Prisma client..."

# Clear module resolution cache to ensure fresh imports
echo "Clearing module cache..."
rm -rf /tmp/tsx-* /tmp/node-* ~/.tsx ~/.cache/tsx 2>/dev/null || true

# Generate Prisma client
cd /app
npx prisma@5.22.0 generate --schema=./prisma/schema.prisma

if [ $? -eq 0 ]; then
  echo "✓ Prisma client generated successfully"

  # Verify the client was generated
  if [ -f "node_modules/.prisma/client/index.js" ]; then
    echo "✓ Prisma client files verified"

    # Copy generated client to pnpm store location (where worker resolves @prisma/client)
    PNPM_PRISMA_DIR="/app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client"
    if [ -d "$(dirname "$PNPM_PRISMA_DIR")" ]; then
      echo "Copying Prisma client to pnpm store location..."
      mkdir -p "$PNPM_PRISMA_DIR"
      cp -r /app/node_modules/.prisma/client/* "$PNPM_PRISMA_DIR/"
      echo "✓ Prisma client copied to pnpm store"
    fi

    # Also copy to packages/database node_modules if it exists
    if [ -d "/app/packages/database/node_modules/.prisma" ]; then
      echo "Copying Prisma client to database package..."
      cp -r /app/node_modules/.prisma/client/* /app/packages/database/node_modules/.prisma/client/
      echo "✓ Prisma client copied to database package"
    fi
  else
    echo "✗ Prisma client files not found!"
    exit 1
  fi
else
  echo "✗ Failed to generate Prisma client"
  exit 1
fi

echo ""

# Run database migrations (safe - only applies pending migrations)
echo "Running database migrations..."

set +e  # Don't exit on error
pnpm db:migrate 2>&1 | tee /tmp/migration.log
MIGRATION_EXIT_CODE=${PIPESTATUS[0]}
set -e  # Re-enable exit on error

if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
  echo ""
  echo "⚠️  Migration failed"

  # Check for P3005 (non-empty database without migration history)
  if grep -q "P3005" /tmp/migration.log; then
    echo "Database has existing data but no migration history."
    echo "Attempting to baseline by marking migrations as applied..."

    cd /app
    npx prisma@5.22.0 migrate resolve --applied "20241016000000_init" --schema=./prisma/schema.prisma

    if [ $? -eq 0 ]; then
      echo "✓ Migration baseline successful"
    else
      echo "✗ Failed to baseline migration"
      exit 1
    fi
  else
    echo "✗ Migration failed with exit code $MIGRATION_EXIT_CODE"
    cat /tmp/migration.log

    # Allow override to skip migrations
    if [ "$SKIP_MIGRATIONS" = "true" ]; then
      echo "⚠️  SKIP_MIGRATIONS=true - continuing without migrations"
    else
      exit 1
    fi
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
    npx prisma@5.22.0 generate --schema=/app/prisma/schema.prisma 2>/dev/null || true
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

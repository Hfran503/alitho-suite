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

# Run database migrations with explicit environment variable
echo "Running database migrations..."

# Try to run migrations (allow output to stream)
set +e  # Don't exit on error
env DATABASE_URL="$DATABASE_URL" pnpm db:migrate 2>&1 | tee /tmp/migration.log
MIGRATION_EXIT_CODE=${PIPESTATUS[0]}
set -e  # Re-enable exit on error

# Check if migration failed due to non-empty database (P3005)
if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
  if grep -q "P3005" /tmp/migration.log; then
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

# Start web server using standalone mode (correct way for Next.js standalone)
cd /app/apps/web
node .next/standalone/apps/web/server.js &
WEB_PID=$!

# Start worker
cd /app/apps/worker
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

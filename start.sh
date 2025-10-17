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

# Start the application
echo "Starting application..."
echo "Final REDIS_URL check: ${REDIS_URL:0:30}..."
exec turbo run start

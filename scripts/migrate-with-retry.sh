#!/bin/bash
# Migration script with retry logic and direct connection support

set -e

echo "🔄 Starting database migration with retry logic..."

# Function to run migrations with retry
migrate_with_retry() {
  local max_attempts=3
  local attempt=1
  local wait_time=5

  while [ $attempt -le $max_attempts ]; do
    echo "📝 Migration attempt $attempt of $max_attempts..."

    if pnpm --filter @repo/database db:migrate; then
      echo "✅ Migration successful!"
      return 0
    else
      if [ $attempt -lt $max_attempts ]; then
        echo "⚠️  Migration failed. Waiting ${wait_time}s before retry..."
        sleep $wait_time
        wait_time=$((wait_time * 2))  # Exponential backoff
      fi
      attempt=$((attempt + 1))
    fi
  done

  echo "❌ Migration failed after $max_attempts attempts"
  return 1
}

# Check if DATABASE_URL uses pooler
if [[ $DATABASE_URL == *"-pooler."* ]]; then
  echo "⚠️  WARNING: DATABASE_URL is using connection pooler"
  echo "   Pooler URL: $DATABASE_URL"
  echo "   "
  echo "   Prisma migrations require a DIRECT connection (not pooler)."
  echo "   "
  echo "   Please set DATABASE_URL to your direct connection URL:"
  echo "   - Remove '-pooler' from the hostname"
  echo "   - Or set a separate DIRECT_DATABASE_URL environment variable"
  echo "   "
  echo "   Example:"
  echo "   ❌ ep-xxx-pooler.c-2.us-east-1.aws.neon.tech (pooler - won't work)"
  echo "   ✅ ep-xxx.c-2.us-east-1.aws.neon.tech (direct - will work)"
  echo "   "
fi

# If DIRECT_DATABASE_URL is set, use it for migrations
if [ -n "$DIRECT_DATABASE_URL" ]; then
  echo "📌 Using DIRECT_DATABASE_URL for migrations"
  export DATABASE_URL="$DIRECT_DATABASE_URL"
fi

# Run migration with retry logic
migrate_with_retry

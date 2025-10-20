#!/bin/bash

# Fetch secrets from AWS and set as environment variables
export AWS_REGION=${AWS_REGION:-us-west-1}

echo "🔐 Fetching secrets from AWS Secrets Manager..."
echo ""

# Function to fetch and parse secret
fetch_secret() {
  local secret_name=$1
  aws secretsmanager get-secret-value \
    --secret-id "$secret_name" \
    --region "$AWS_REGION" \
    --query SecretString \
    --output text 2>/dev/null
}

# Fetch NextAuth secrets
NEXTAUTH_JSON=$(fetch_secret "calitho-suite/nextauth")
if [ $? -eq 0 ]; then
  export NEXTAUTH_SECRET=$(echo "$NEXTAUTH_JSON" | jq -r '.NEXTAUTH_SECRET')
  if [ ! -z "$NEXTAUTH_SECRET" ] && [ "$NEXTAUTH_SECRET" != "null" ]; then
    echo "✓ NEXTAUTH_SECRET loaded from AWS"
  else
    echo "⚠️  Failed to parse NEXTAUTH_SECRET"
  fi
else
  echo "❌ Failed to fetch NEXTAUTH secret"
fi

# Fetch Database URL (only if not already set in .env.local)
if [ -z "$DATABASE_URL" ]; then
  DB_JSON=$(fetch_secret "calitho-suite/database")
  if [ $? -eq 0 ]; then
    export DATABASE_URL=$(echo "$DB_JSON" | jq -r '.DATABASE_URL')
    if [ ! -z "$DATABASE_URL" ] && [ "$DATABASE_URL" != "null" ]; then
      echo "✓ DATABASE_URL loaded from AWS"
    fi
  fi
fi

# Fetch Redis URL (only if not already set in .env.local)
if [ -z "$REDIS_URL" ]; then
  REDIS_JSON=$(fetch_secret "calitho-suite/redis")
  if [ $? -eq 0 ]; then
    export REDIS_URL=$(echo "$REDIS_JSON" | jq -r '.REDIS_URL')
    if [ ! -z "$REDIS_URL" ] && [ "$REDIS_URL" != "null" ]; then
      echo "✓ REDIS_URL loaded from AWS"
    fi
  fi
fi

echo ""
echo "🚀 Starting development server..."
cd "$(dirname "$0")/.." && npm run dev

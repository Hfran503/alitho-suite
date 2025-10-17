#!/bin/bash
set -e

echo "Starting Calitho Suite..."

# Load secrets from AWS Secrets Manager in production
if [ "$NODE_ENV" = "production" ] || [ -n "$AWS_ACCESS_KEY_ID" ]; then
  echo "Loading secrets from AWS Secrets Manager..."
  export USE_AWS_SECRETS=true
  source ./scripts/load-secrets.sh
fi

# Run database migrations
echo "Running database migrations..."
pnpm db:migrate

# Start the application
echo "Starting application..."
turbo run start

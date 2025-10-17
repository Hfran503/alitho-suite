#!/bin/bash
set -e

echo "Starting Calitho Suite..."

# Run database migrations
echo "Running database migrations..."
pnpm db:migrate

# Start the application
echo "Starting application..."
pnpm start

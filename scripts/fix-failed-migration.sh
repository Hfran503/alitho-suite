#!/bin/bash

# This script resolves the failed migration in production database
# Usage: ./scripts/fix-failed-migration.sh

echo "Connecting to production database to resolve failed migration..."

# Mark the failed migration as rolled back so Prisma can proceed
DATABASE_URL="postgresql://neondb_owner:npg_STQ5tc7jWsog@ep-super-sky-ad1f0egf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" \
npx prisma migrate resolve --rolled-back 20251019221428_add_return_label_fields --schema=./prisma/schema.prisma

echo "Failed migration marked as rolled back"
echo "Now you can run: pnpm db:migrate to apply pending migrations"

#!/usr/bin/env bash
set -euo pipefail

# PostgreSQL Backup Script
# Backs up database to S3/MinIO with timestamp

echo "🔄 Starting PostgreSQL backup..."

# Configuration from environment variables
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-app}"
POSTGRES_DB="${POSTGRES_DB:-app}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"

S3_ENDPOINT="${S3_ENDPOINT}"
S3_BUCKET="${S3_BUCKET}"
S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}"
S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}"

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
BACKUP_FILE="/tmp/pg-backup-${TIMESTAMP}.sql.gz"

echo "📦 Creating backup: ${BACKUP_FILE}"

# Create compressed backup
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  | gzip > "${BACKUP_FILE}"

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "✅ Backup created: ${BACKUP_SIZE}"

# Upload to S3/MinIO
echo "☁️  Uploading to S3..."

aws configure set aws_access_key_id "${S3_ACCESS_KEY_ID}"
aws configure set aws_secret_access_key "${S3_SECRET_ACCESS_KEY}"

aws --endpoint-url "${S3_ENDPOINT}" s3 cp \
  "${BACKUP_FILE}" \
  "s3://${S3_BUCKET}/db-backups/pg-backup-${TIMESTAMP}.sql.gz"

echo "✅ Uploaded to s3://${S3_BUCKET}/db-backups/pg-backup-${TIMESTAMP}.sql.gz"

# Cleanup temp file
rm -f "${BACKUP_FILE}"
echo "🧹 Cleaned up temporary file"

echo "🎉 Backup completed successfully!"

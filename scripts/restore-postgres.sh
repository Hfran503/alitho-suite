#!/usr/bin/env bash
set -euo pipefail

# PostgreSQL Restore Script
# Restores database from S3/MinIO backup

if [ $# -eq 0 ]; then
  echo "Usage: $0 <backup-filename>"
  echo "Example: $0 pg-backup-20241016-120000.sql.gz"
  exit 1
fi

BACKUP_FILENAME="$1"

echo "⚠️  WARNING: This will restore the database from backup."
echo "   Backup file: ${BACKUP_FILENAME}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
  echo "❌ Restore cancelled"
  exit 0
fi

echo "🔄 Starting PostgreSQL restore..."

# Configuration
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-app}"
POSTGRES_DB="${POSTGRES_DB:-app}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"

S3_ENDPOINT="${S3_ENDPOINT}"
S3_BUCKET="${S3_BUCKET}"
S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}"
S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}"

BACKUP_FILE="/tmp/${BACKUP_FILENAME}"

# Download from S3
echo "☁️  Downloading backup from S3..."

aws configure set aws_access_key_id "${S3_ACCESS_KEY_ID}"
aws configure set aws_secret_access_key "${S3_SECRET_ACCESS_KEY}"

aws --endpoint-url "${S3_ENDPOINT}" s3 cp \
  "s3://${S3_BUCKET}/db-backups/${BACKUP_FILENAME}" \
  "${BACKUP_FILE}"

echo "✅ Downloaded backup file"

# Restore database
echo "📦 Restoring database..."

gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${POSTGRES_HOST}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}"

echo "✅ Database restored"

# Cleanup
rm -f "${BACKUP_FILE}"
echo "🧹 Cleaned up temporary file"

echo "🎉 Restore completed successfully!"

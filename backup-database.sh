#!/bin/bash

# Neon Database Backup Script
# Creates a backup of the entire database using pg_dump

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not found in environment"
  exit 1
fi

# Create backups directory if it doesn't exist
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/neondb_backup_$TIMESTAMP.sql"

echo "=========================================="
echo "Neon Database Backup"
echo "=========================================="
echo "Backup directory: $BACKUP_DIR"
echo "Backup file: $BACKUP_FILE"
echo ""
echo "Starting backup..."
echo ""

# Check if we need to use Docker for newer PostgreSQL version
LOCAL_PG_VERSION=$(pg_dump --version 2>/dev/null | grep -oE '[0-9]+' | head -1 || echo "0")

if [ "$LOCAL_PG_VERSION" -lt 17 ]; then
  echo "Using Docker with PostgreSQL 17 (local version: $LOCAL_PG_VERSION is too old)"

  # Run pg_dump using Docker with PostgreSQL 17
  docker run --rm \
    -e PGPASSWORD="$DATABASE_URL" \
    postgres:17-alpine \
    pg_dump "$DATABASE_URL" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    --verbose \
    > "$BACKUP_FILE" 2>&1
else
  echo "Using local pg_dump version: $LOCAL_PG_VERSION"

  # Run pg_dump using the DATABASE_URL
  # Options:
  #   --no-owner: Don't output commands to set ownership of objects
  #   --no-acl: Don't output commands to set access privileges
  #   --clean: Add commands to drop database objects before creating them
  #   --if-exists: Use IF EXISTS when dropping objects
  pg_dump "$DATABASE_URL" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    --verbose \
    > "$BACKUP_FILE" 2>&1
fi

# Check if backup was successful
if [ $? -eq 0 ]; then
  # Get file size
  FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

  echo ""
  echo "=========================================="
  echo "✅ Backup completed successfully!"
  echo "=========================================="
  echo "File: $BACKUP_FILE"
  echo "Size: $FILE_SIZE"
  echo ""

  # Also create a compressed version
  echo "Creating compressed backup..."
  gzip -c "$BACKUP_FILE" > "$BACKUP_FILE.gz"
  COMPRESSED_SIZE=$(du -h "$BACKUP_FILE.gz" | cut -f1)

  echo "✅ Compressed backup created: $BACKUP_FILE.gz"
  echo "Compressed size: $COMPRESSED_SIZE"
  echo ""

  # List all backups
  echo "Available backups:"
  ls -lh "$BACKUP_DIR"

else
  echo ""
  echo "❌ Backup failed!"
  exit 1
fi

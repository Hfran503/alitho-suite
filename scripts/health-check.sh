#!/usr/bin/env bash
set -euo pipefail

# Health Check Script
# Checks all services are running properly

echo "🏥 Running health checks..."

FAIL_COUNT=0

# Check web service
echo -n "Checking web service... "
if curl -f -s -o /dev/null "http://localhost:3000/api/healthz"; then
  echo "✅"
else
  echo "❌ FAILED"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Check PostgreSQL
echo -n "Checking PostgreSQL... "
if docker compose exec -T postgres pg_isready -U app > /dev/null 2>&1; then
  echo "✅"
else
  echo "❌ FAILED"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Check Redis
echo -n "Checking Redis... "
if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
  echo "✅"
else
  echo "❌ FAILED"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Check MinIO
echo -n "Checking MinIO... "
if curl -f -s -o /dev/null "http://localhost:9000/minio/health/live"; then
  echo "✅"
else
  echo "❌ FAILED"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
if [ $FAIL_COUNT -eq 0 ]; then
  echo "🎉 All health checks passed!"
  exit 0
else
  echo "⚠️  ${FAIL_COUNT} health check(s) failed"
  exit 1
fi

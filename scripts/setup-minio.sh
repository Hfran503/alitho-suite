#!/usr/bin/env bash
set -euo pipefail

# MinIO Setup Script
# Creates initial buckets and policies

echo "🗂️  Setting up MinIO buckets..."

# Configuration
S3_ENDPOINT="${S3_ENDPOINT}"
S3_BUCKET="${S3_BUCKET:-crm-uploads}"
S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}"
S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}"

# Configure AWS CLI for MinIO
aws configure set aws_access_key_id "${S3_ACCESS_KEY_ID}"
aws configure set aws_secret_access_key "${S3_SECRET_ACCESS_KEY}"

# Create main bucket
echo "Creating bucket: ${S3_BUCKET}"
aws --endpoint-url "${S3_ENDPOINT}" s3 mb "s3://${S3_BUCKET}" || echo "Bucket already exists"

# Create lifecycle policy for temp files (optional)
cat > /tmp/lifecycle-policy.json <<EOF
{
  "Rules": [
    {
      "Id": "DeleteTempUploads",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "temp/"
      },
      "Expiration": {
        "Days": 1
      }
    },
    {
      "Id": "DeleteOldBackups",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "db-backups/"
      },
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
EOF

echo "Applying lifecycle policy..."
aws --endpoint-url "${S3_ENDPOINT}" s3api put-bucket-lifecycle-configuration \
  --bucket "${S3_BUCKET}" \
  --lifecycle-configuration file:///tmp/lifecycle-policy.json || echo "Failed to set lifecycle policy"

rm -f /tmp/lifecycle-policy.json

echo "✅ MinIO setup complete!"

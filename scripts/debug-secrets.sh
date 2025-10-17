#!/bin/bash

# Debug script to show what's in AWS Secrets Manager
# Usage: ./scripts/debug-secrets.sh

set -e

AWS_REGION=${AWS_REGION:-us-west-1}

echo "=== AWS Secrets Manager Debug ==="
echo "Region: $AWS_REGION"
echo ""

# Check prerequisites
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI not installed"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "Error: jq not installed"
    exit 1
fi

# Function to show secret structure
show_secret() {
    local secret_name=$1
    echo "=== Secret: $secret_name ==="

    local secret_json=$(aws secretsmanager get-secret-value \
        --secret-id "$secret_name" \
        --region "$AWS_REGION" \
        --query SecretString \
        --output text 2>&1)

    if [ $? -eq 0 ]; then
        echo "Keys available:"
        echo "$secret_json" | jq -r 'keys[]' 2>/dev/null || echo "Failed to parse JSON"
        echo ""
        echo "Secret structure (values hidden):"
        echo "$secret_json" | jq 'with_entries(.value = "<REDACTED>")' 2>/dev/null || echo "Failed to parse JSON"
    else
        echo "Error: $secret_json"
    fi
    echo ""
}

# Show all secrets
show_secret "calitho-suite/database"
show_secret "calitho-suite/nextauth"
show_secret "calitho-suite/redis"

echo "=== Done ==="

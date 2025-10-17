#!/bin/bash

# Load secrets from AWS Secrets Manager and export as environment variables
# Usage: source ./scripts/load-secrets.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

AWS_REGION=${AWS_REGION:-us-west-1}

# Function to fetch secret from AWS Secrets Manager
get_secret() {
    local secret_name=$1
    local secret_key=$2

    if command -v aws &> /dev/null; then
        local secret_json=$(aws secretsmanager get-secret-value \
            --secret-id "$secret_name" \
            --region "$AWS_REGION" \
            --query SecretString \
            --output text 2>/dev/null)

        if [ $? -eq 0 ]; then
            echo "$secret_json" | jq -r ".$secret_key"
        else
            echo ""
        fi
    else
        echo ""
    fi
}

# Only fetch from AWS in production or if explicitly requested
if [ "$NODE_ENV" = "production" ] || [ "$USE_AWS_SECRETS" = "true" ]; then
    echo -e "${YELLOW}Loading secrets from AWS Secrets Manager...${NC}"

    # Fetch DATABASE_URL
    DATABASE_URL_FROM_AWS=$(get_secret "calitho-suite/database" "DATABASE_URL")
    if [ ! -z "$DATABASE_URL_FROM_AWS" ]; then
        export DATABASE_URL="$DATABASE_URL_FROM_AWS"
        echo -e "${GREEN}✓ Loaded DATABASE_URL from AWS${NC}"
    fi

    # Fetch NEXTAUTH_SECRET and NEXTAUTH_URL
    NEXTAUTH_SECRET_FROM_AWS=$(get_secret "calitho-suite/nextauth" "NEXTAUTH_SECRET")
    if [ ! -z "$NEXTAUTH_SECRET_FROM_AWS" ]; then
        export NEXTAUTH_SECRET="$NEXTAUTH_SECRET_FROM_AWS"
        echo -e "${GREEN}✓ Loaded NEXTAUTH_SECRET from AWS${NC}"
    fi

    NEXTAUTH_URL_FROM_AWS=$(get_secret "calitho-suite/nextauth" "NEXTAUTH_URL")
    if [ ! -z "$NEXTAUTH_URL_FROM_AWS" ]; then
        export NEXTAUTH_URL="$NEXTAUTH_URL_FROM_AWS"
        echo -e "${GREEN}✓ Loaded NEXTAUTH_URL from AWS${NC}"
    fi

    # Fetch REDIS_URL
    REDIS_URL_FROM_AWS=$(get_secret "calitho-suite/redis" "REDIS_URL")
    if [ ! -z "$REDIS_URL_FROM_AWS" ]; then
        export REDIS_URL="$REDIS_URL_FROM_AWS"
        echo -e "${GREEN}✓ Loaded REDIS_URL from AWS${NC}"
    fi

    echo -e "${GREEN}Secrets loaded successfully${NC}"
else
    echo -e "${YELLOW}Using .env file (development mode)${NC}"
fi

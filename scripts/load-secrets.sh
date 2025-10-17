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

    if ! command -v aws &> /dev/null; then
        return 1
    fi

    if ! command -v jq &> /dev/null; then
        return 1
    fi

    local secret_json=$(aws secretsmanager get-secret-value \
        --secret-id "$secret_name" \
        --region "$AWS_REGION" \
        --query SecretString \
        --output text 2>/dev/null)

    if [ $? -ne 0 ]; then
        return 1
    fi

    local value=$(echo "$secret_json" | jq -r ".$secret_key" 2>/dev/null)

    if [ "$value" != "null" ] && [ ! -z "$value" ]; then
        echo "$value"
        return 0
    else
        return 1
    fi
}

# Only fetch from AWS in production or if explicitly requested
if [ "$NODE_ENV" = "production" ] || [ "$USE_AWS_SECRETS" = "true" ]; then
    echo -e "${YELLOW}Loading secrets from AWS Secrets Manager...${NC}"

    # Check prerequisites
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}Error: AWS CLI not installed${NC}"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        echo -e "${RED}Error: jq not installed${NC}"
        exit 1
    fi

    echo "AWS Region: $AWS_REGION"

    # Fetch DATABASE_URL (only if not already set)
    if [ -z "$DATABASE_URL" ]; then
        echo "DATABASE_URL not set in environment, attempting to fetch from AWS..."
        DATABASE_URL_FROM_AWS=$(get_secret "calitho-suite/database" "DATABASE_URL")

        if [ $? -eq 0 ] && [ ! -z "$DATABASE_URL_FROM_AWS" ]; then
            export DATABASE_URL="$DATABASE_URL_FROM_AWS"
            echo -e "${GREEN}✓ Loaded DATABASE_URL from AWS (${DATABASE_URL:0:30}...)${NC}"
        else
            echo -e "${RED}✗ Failed to load DATABASE_URL from AWS Secrets Manager${NC}"
            echo "  Secret name: calitho-suite/database"
            echo "  Key: DATABASE_URL"
            echo "  Region: $AWS_REGION"

            # Try to test AWS CLI access directly
            echo "  Testing AWS access..."
            aws secretsmanager list-secrets --region "$AWS_REGION" --max-results 1 > /dev/null 2>&1
            if [ $? -eq 0 ]; then
                echo "  AWS CLI access: OK"
                # Try to fetch and show the raw secret
                echo "  Attempting to fetch raw secret..."
                aws secretsmanager get-secret-value \
                    --secret-id "calitho-suite/database" \
                    --region "$AWS_REGION" \
                    --query SecretString \
                    --output text 2>&1 | head -c 100
                echo ""
            else
                echo "  AWS CLI access: FAILED - check AWS credentials"
            fi
        fi
    else
        echo -e "${GREEN}✓ Using DATABASE_URL from environment (${DATABASE_URL:0:30}...)${NC}"
    fi

    # Fetch NEXTAUTH_SECRET and NEXTAUTH_URL
    if [ -z "$NEXTAUTH_SECRET" ]; then
        NEXTAUTH_SECRET_FROM_AWS=$(get_secret "calitho-suite/nextauth" "NEXTAUTH_SECRET")
        if [ $? -eq 0 ] && [ ! -z "$NEXTAUTH_SECRET_FROM_AWS" ]; then
            export NEXTAUTH_SECRET="$NEXTAUTH_SECRET_FROM_AWS"
            echo -e "${GREEN}✓ Loaded NEXTAUTH_SECRET from AWS${NC}"
        fi
    fi

    if [ -z "$NEXTAUTH_URL" ]; then
        NEXTAUTH_URL_FROM_AWS=$(get_secret "calitho-suite/nextauth" "NEXTAUTH_URL")
        if [ $? -eq 0 ] && [ ! -z "$NEXTAUTH_URL_FROM_AWS" ]; then
            export NEXTAUTH_URL="$NEXTAUTH_URL_FROM_AWS"
            echo -e "${GREEN}✓ Loaded NEXTAUTH_URL from AWS${NC}"
        fi
    fi

    # Fetch REDIS_URL (only if not already set)
    if [ -z "$REDIS_URL" ]; then
        REDIS_URL_FROM_AWS=$(get_secret "calitho-suite/redis" "REDIS_URL")
        if [ $? -eq 0 ] && [ ! -z "$REDIS_URL_FROM_AWS" ]; then
            export REDIS_URL="$REDIS_URL_FROM_AWS"
            echo -e "${GREEN}✓ Loaded REDIS_URL from AWS${NC}"
        fi
    else
        echo -e "${GREEN}✓ Using REDIS_URL from environment${NC}"
    fi

    echo -e "${GREEN}Secrets loading complete${NC}"

    # Validate critical secrets are set
    echo ""
    echo "Final validation:"
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}✗ DATABASE_URL is not set${NC}"
    else
        echo -e "${GREEN}✓ DATABASE_URL is set${NC}"
    fi

    if [ -z "$REDIS_URL" ]; then
        echo -e "${YELLOW}⚠ REDIS_URL is not set${NC}"
    else
        echo -e "${GREEN}✓ REDIS_URL is set${NC}"
    fi

    if [ -z "$NEXTAUTH_SECRET" ]; then
        echo -e "${YELLOW}⚠ NEXTAUTH_SECRET is not set${NC}"
    else
        echo -e "${GREEN}✓ NEXTAUTH_SECRET is set${NC}"
    fi

    # PACE API variables (from Dokploy environment or AWS Secrets)
    if [ -z "$PACE_API_URL" ]; then
        # Try to load from AWS Secrets if available
        PACE_API_URL_FROM_AWS=$(get_secret "calitho-suite/pace" "PACE_API_URL" 2>/dev/null)
        if [ $? -eq 0 ] && [ ! -z "$PACE_API_URL_FROM_AWS" ]; then
            export PACE_API_URL="$PACE_API_URL_FROM_AWS"
            echo -e "${GREEN}✓ Loaded PACE_API_URL from AWS${NC}"
        else
            echo -e "${YELLOW}⚠ PACE_API_URL not set (AWS secret not found, using Dokploy env if available)${NC}"
        fi
    else
        export PACE_API_URL="$PACE_API_URL"
        echo -e "${GREEN}✓ Using PACE_API_URL from environment (${PACE_API_URL:0:30}...)${NC}"
    fi

    if [ -z "$PACE_USERNAME" ]; then
        PACE_USERNAME_FROM_AWS=$(get_secret "calitho-suite/pace" "PACE_USERNAME" 2>/dev/null)
        if [ $? -eq 0 ] && [ ! -z "$PACE_USERNAME_FROM_AWS" ]; then
            export PACE_USERNAME="$PACE_USERNAME_FROM_AWS"
            echo -e "${GREEN}✓ Loaded PACE_USERNAME from AWS${NC}"
        else
            echo -e "${YELLOW}⚠ PACE_USERNAME not set (AWS secret not found, using Dokploy env if available)${NC}"
        fi
    else
        export PACE_USERNAME="$PACE_USERNAME"
        echo -e "${GREEN}✓ Using PACE_USERNAME from environment${NC}"
    fi

    if [ -z "$PACE_PASSWORD" ]; then
        PACE_PASSWORD_FROM_AWS=$(get_secret "calitho-suite/pace" "PACE_PASSWORD" 2>/dev/null)
        if [ $? -eq 0 ] && [ ! -z "$PACE_PASSWORD_FROM_AWS" ]; then
            export PACE_PASSWORD="$PACE_PASSWORD_FROM_AWS"
            echo -e "${GREEN}✓ Loaded PACE_PASSWORD from AWS${NC}"
        else
            echo -e "${YELLOW}⚠ PACE_PASSWORD not set (AWS secret not found, using Dokploy env if available)${NC}"
        fi
    else
        export PACE_PASSWORD="$PACE_PASSWORD"
        echo -e "${GREEN}✓ Using PACE_PASSWORD from environment${NC}"
    fi
else
    echo -e "${YELLOW}Using .env file (development mode)${NC}"
fi

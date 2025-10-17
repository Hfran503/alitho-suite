#!/bin/bash

# Calitho Suite - AWS Secrets Manager Setup Script
# This script helps you create secrets in AWS Secrets Manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Calitho Suite - AWS Secrets Setup${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    echo "Install it with: brew install awscli"
    exit 1
fi

# Check AWS credentials
echo -e "${YELLOW}Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    echo "Run: aws configure"
    exit 1
fi

echo -e "${GREEN}✓ AWS credentials configured${NC}"
echo ""

# Set region
AWS_REGION=${AWS_REGION:-us-west-1}
echo -e "${YELLOW}Using region: ${AWS_REGION}${NC}"
echo ""

# Function to create secret
create_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3

    echo -e "${YELLOW}Creating secret: ${secret_name}${NC}"

    # Check if secret already exists
    if aws secretsmanager describe-secret --secret-id "$secret_name" --region "$AWS_REGION" &> /dev/null; then
        echo -e "${YELLOW}Secret already exists. Updating...${NC}"
        aws secretsmanager update-secret \
            --secret-id "$secret_name" \
            --secret-string "$secret_value" \
            --region "$AWS_REGION" > /dev/null
    else
        aws secretsmanager create-secret \
            --name "$secret_name" \
            --description "$description" \
            --secret-string "$secret_value" \
            --region "$AWS_REGION" > /dev/null
    fi

    echo -e "${GREEN}✓ Secret created/updated: ${secret_name}${NC}"
    echo ""
}

# 1. DATABASE SECRET
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}1. Setting up DATABASE secret${NC}"
echo -e "${YELLOW}========================================${NC}"
read -p "Enter your DATABASE_URL (or press Enter to skip): " DATABASE_URL

if [ ! -z "$DATABASE_URL" ]; then
    SECRET_VALUE="{\"DATABASE_URL\":\"$DATABASE_URL\"}"
    create_secret "calitho-suite/database" "$SECRET_VALUE" "Calitho Suite database connection string"
else
    echo -e "${YELLOW}Skipped database secret${NC}"
    echo ""
fi

# 2. NEXTAUTH SECRET
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}2. Setting up NEXTAUTH secret${NC}"
echo -e "${YELLOW}========================================${NC}"
echo "Generate a secure secret with: openssl rand -base64 32"
read -p "Enter your NEXTAUTH_SECRET (or press Enter to auto-generate): " NEXTAUTH_SECRET

if [ -z "$NEXTAUTH_SECRET" ]; then
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    echo -e "${GREEN}Generated: ${NEXTAUTH_SECRET}${NC}"
fi

SECRET_VALUE="{\"NEXTAUTH_SECRET\":\"$NEXTAUTH_SECRET\"}"
create_secret "calitho-suite/nextauth" "$SECRET_VALUE" "Calitho Suite NextAuth secret for JWT signing"

# 3. REDIS SECRET
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}3. Setting up REDIS secret${NC}"
echo -e "${YELLOW}========================================${NC}"
read -p "Enter your REDIS_URL (or press Enter to skip): " REDIS_URL

if [ ! -z "$REDIS_URL" ]; then
    SECRET_VALUE="{\"REDIS_URL\":\"$REDIS_URL\"}"
    create_secret "calitho-suite/redis" "$SECRET_VALUE" "Calitho Suite Redis connection string"
else
    echo -e "${YELLOW}Skipped Redis secret${NC}"
    echo ""
fi

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ AWS Secrets Manager setup complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Your secrets have been created in AWS Secrets Manager."
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update your .env file to enable Secrets Manager:"
echo "   - Uncomment the AWS_SECRET_* variables"
echo "   - Remove sensitive values from .env (they'll be fetched from AWS)"
echo ""
echo "2. For production deployment, ensure your app has IAM permissions:"
echo "   - secretsmanager:GetSecretValue"
echo "   - secretsmanager:DescribeSecret"
echo ""
echo "3. Test locally by running: pnpm dev"
echo ""

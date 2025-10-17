#!/bin/bash

# Calitho Suite - IAM Permissions Setup Script
# This script creates and attaches the necessary IAM policy for Secrets Manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Calitho Suite - IAM Permissions Setup${NC}"
echo -e "${GREEN}========================================${NC}"
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

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS Account ID: ${AWS_ACCOUNT_ID}${NC}"
echo ""

# IAM user name
IAM_USER_NAME="calitho-suite-app"
POLICY_NAME="CalithoSuiteSecretsManagerPolicy"

# Check if policy already exists
echo -e "${YELLOW}Checking if policy exists...${NC}"
POLICY_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${POLICY_NAME}"

if aws iam get-policy --policy-arn "$POLICY_ARN" &> /dev/null; then
    echo -e "${YELLOW}Policy already exists. Skipping creation.${NC}"
else
    echo -e "${YELLOW}Creating IAM policy: ${POLICY_NAME}${NC}"

    # Create the policy
    aws iam create-policy \
        --policy-name "$POLICY_NAME" \
        --policy-document file://docs/iam-secrets-manager-policy.json \
        --description "Allows Calitho Suite to manage secrets in AWS Secrets Manager" \
        > /dev/null

    echo -e "${GREEN}✓ Policy created successfully${NC}"
fi

echo ""

# Attach policy to user
echo -e "${YELLOW}Attaching policy to IAM user: ${IAM_USER_NAME}${NC}"

if aws iam attach-user-policy \
    --user-name "$IAM_USER_NAME" \
    --policy-arn "$POLICY_ARN" 2>&1; then
    echo -e "${GREEN}✓ Policy attached successfully${NC}"
else
    echo -e "${RED}Failed to attach policy. It may already be attached.${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ IAM Permissions Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "• Policy: $POLICY_NAME"
echo "• Policy ARN: $POLICY_ARN"
echo "• User: $IAM_USER_NAME"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Wait 10-15 seconds for IAM changes to propagate"
echo "2. Run the secrets setup script: ./scripts/setup-secrets.sh"
echo ""
echo -e "${GREEN}Permissions granted:${NC}"
echo "• secretsmanager:CreateSecret"
echo "• secretsmanager:UpdateSecret"
echo "• secretsmanager:GetSecretValue"
echo "• secretsmanager:DescribeSecret"
echo "• secretsmanager:PutSecretValue"
echo "• secretsmanager:DeleteSecret"
echo "• secretsmanager:ListSecrets"
echo "• secretsmanager:TagResource"
echo ""

# AWS Secrets Manager Integration

This guide explains how to use AWS Secrets Manager to securely store and retrieve sensitive configuration values for Calitho Suite.

## Overview

AWS Secrets Manager helps you protect secrets needed to access your applications, services, and IT resources. Instead of hardcoding sensitive information in your code or storing it in `.env` files, you can store it securely in AWS Secrets Manager.

## Benefits

- **Security**: Secrets are encrypted at rest using AWS KMS
- **Rotation**: Automatic secret rotation capabilities
- **Audit**: CloudTrail logging of all secret access
- **No Credentials in Code**: Secrets are fetched at runtime
- **Environment Separation**: Different secrets for dev/staging/prod

## Quick Start

### 1. Install AWS CLI

```bash
brew install awscli
aws configure
```

### 2. Run the Setup Script

```bash
./scripts/setup-secrets.sh
```

This interactive script will:
- Create secrets in AWS Secrets Manager
- Guide you through entering your sensitive values
- Set up the proper secret structure

### 3. Update Your .env File

Uncomment the AWS Secrets Manager variables in `.env`:

```bash
# AWS Secrets Manager (optional - for production)
AWS_SECRET_DATABASE=calitho-suite/database
AWS_SECRET_NEXTAUTH=calitho-suite/nextauth
AWS_SECRET_REDIS=calitho-suite/redis
```

### 4. Remove Sensitive Values (Optional)

For production, you can remove the actual secret values from `.env`:

```bash
# These will be fetched from AWS Secrets Manager
# DATABASE_URL=  # Remove or comment out
# NEXTAUTH_SECRET=  # Remove or comment out
# REDIS_URL=  # Remove or comment out
```

## Secret Structure

### Database Secret (`calitho-suite/database`)

```json
{
  "DATABASE_URL": "postgresql://user:password@host/db"
}
```

### NextAuth Secret (`calitho-suite/nextauth`)

```json
{
  "NEXTAUTH_SECRET": "your-secret-here"
}
```

### Redis Secret (`calitho-suite/redis`)

```json
{
  "REDIS_URL": "redis://host:6379"
}
```

## Manual Secret Creation

If you prefer to create secrets manually:

### Using AWS CLI

```bash
# Database secret
aws secretsmanager create-secret \
  --name calitho-suite/database \
  --description "Calitho Suite database connection" \
  --secret-string '{"DATABASE_URL":"your-connection-string"}' \
  --region us-west-1

# NextAuth secret
aws secretsmanager create-secret \
  --name calitho-suite/nextauth \
  --description "Calitho Suite NextAuth JWT secret" \
  --secret-string '{"NEXTAUTH_SECRET":"your-secret"}' \
  --region us-west-1

# Redis secret
aws secretsmanager create-secret \
  --name calitho-suite/redis \
  --description "Calitho Suite Redis connection" \
  --secret-string '{"REDIS_URL":"redis://host:6379"}' \
  --region us-west-1
```

### Using AWS Console

1. Go to [AWS Secrets Manager Console](https://console.aws.amazon.com/secretsmanager/)
2. Click **"Store a new secret"**
3. Select **"Other type of secret"**
4. Choose **"Plaintext"** and paste the JSON structure
5. Name the secret (e.g., `calitho-suite/database`)
6. Click **"Store"**

## IAM Permissions

Your application needs the following IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-west-1:*:secret:calitho-suite/*"
      ]
    }
  ]
}
```

### For EC2/ECS/Lambda

Attach this policy to your instance/task role. The application will automatically use IAM role credentials.

### For Local Development

Use AWS CLI credentials:
```bash
aws configure
```

## Usage in Code

The secrets utility automatically handles fetching from AWS Secrets Manager with fallback to environment variables.

### Example: Using in Next.js

```typescript
import { getDatabaseUrl, getNextAuthSecret } from '@/lib/secrets'

// Fetch individual secrets
const databaseUrl = await getDatabaseUrl()
const nextAuthSecret = await getNextAuthSecret()

// Or fetch all at once
import { getAllSecrets } from '@/lib/secrets'
const secrets = await getAllSecrets()
```

### Example: Using in Worker

```typescript
import { getRedisUrl } from '../lib/secrets'

const redisUrl = await getRedisUrl()
const redis = new Redis(redisUrl)
```

## Environment Priority

The secrets utility uses this priority order:

1. **Development Mode**: Always use `.env` file
2. **Production Mode with AWS Secrets Manager**: Fetch from AWS
3. **Fallback**: Use `.env` file if AWS fetch fails

This ensures:
- Local development works without AWS setup
- Production uses secure AWS Secrets Manager
- Graceful degradation if AWS is unavailable

## Secret Rotation

To rotate a secret:

```bash
# Update the secret value
aws secretsmanager update-secret \
  --secret-id calitho-suite/database \
  --secret-string '{"DATABASE_URL":"new-connection-string"}' \
  --region us-west-1

# Restart your application to pick up the new value
```

**Note**: The application caches secrets in memory. Restart required for changes to take effect.

## Troubleshooting

### Error: "Secret not found"

- Verify secret name matches exactly
- Check AWS region is correct
- Ensure IAM permissions are set

### Error: "Access denied"

- Check IAM permissions
- Verify AWS credentials are configured
- Ensure the IAM role/user has `secretsmanager:GetSecretValue`

### Secrets not loading

- Check `NODE_ENV` environment variable
- Verify AWS CLI is configured: `aws sts get-caller-identity`
- Check CloudWatch logs for error details

### Clear Cache

If you need to force a refresh of cached secrets:

```typescript
import { clearSecretsCache } from '@/lib/secrets'

clearSecretsCache()
```

## Cost

AWS Secrets Manager pricing (as of 2024):
- **$0.40** per secret per month
- **$0.05** per 10,000 API calls

For this setup with 3 secrets:
- Monthly cost: ~$1.20
- API calls: Minimal (cached in application memory)

## Best Practices

1. ✅ **Use different secrets for each environment** (dev, staging, prod)
2. ✅ **Never commit secrets to version control**
3. ✅ **Rotate secrets regularly** (at least every 90 days)
4. ✅ **Use IAM roles** instead of access keys in production
5. ✅ **Enable CloudTrail logging** for audit trail
6. ✅ **Use least privilege** IAM policies
7. ✅ **Monitor secret access** with CloudWatch

## Migration from .env to AWS Secrets Manager

1. Run the setup script: `./scripts/setup-secrets.sh`
2. Verify secrets are created: `aws secretsmanager list-secrets`
3. Test locally with secrets enabled
4. Deploy to production with IAM role
5. Remove secrets from `.env` in production
6. Keep `.env` for local development

## Support

For issues or questions:
- Check the [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- Review application logs
- Contact your DevOps team

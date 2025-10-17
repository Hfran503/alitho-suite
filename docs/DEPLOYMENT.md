# Calitho Suite - Deployment Guide

This guide explains how to deploy Calitho Suite to production with AWS Secrets Manager integration.

## Overview

Calitho Suite uses a hybrid approach for secrets management:

- **Local Development**: Secrets stored in `.env` file
- **Production**: Secrets fetched from AWS Secrets Manager at runtime

## Prerequisites

1. AWS Account with appropriate permissions
2. AWS CLI configured (`aws configure`)
3. Neon PostgreSQL database
4. AWS S3 bucket created
5. Redis instance (AWS ElastiCache or Upstash)

---

## Step 1: Store Secrets in AWS Secrets Manager

Run the interactive setup script:

```bash
pnpm secrets:setup
```

This will create the following secrets in AWS Secrets Manager:
- `calitho-suite/database` - Database connection string
- `calitho-suite/nextauth` - NextAuth JWT secret
- `calitho-suite/redis` - Redis connection string

### Manual Setup (Alternative)

If you prefer to create secrets manually:

```bash
# Database secret
aws secretsmanager create-secret \
  --name calitho-suite/database \
  --secret-string '{"DATABASE_URL":"postgresql://..."}' \
  --region us-west-1

# NextAuth secret
aws secretsmanager create-secret \
  --name calitho-suite/nextauth \
  --secret-string '{"NEXTAUTH_SECRET":"your-secret-here"}' \
  --region us-west-1

# Redis secret
aws secretsmanager create-secret \
  --name calitho-suite/redis \
  --secret-string '{"REDIS_URL":"redis://..."}' \
  --region us-west-1
```

---

## Step 2: Configure IAM Permissions

Your application needs permissions to read secrets from AWS Secrets Manager.

### For EC2/ECS/Lambda (Recommended)

Attach this IAM policy to your instance/task role:

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
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::calitho-suite1/*",
        "arn:aws:s3:::calitho-suite1"
      ]
    }
  ]
}
```

### Quick Setup with Script

```bash
./scripts/setup-iam-permissions.sh
```

---

## Step 3: Environment Configuration

### Production Environment Variables

Create a `.env.production` file (or configure in your deployment platform):

```bash
# Node environment
NODE_ENV=production

# Enable AWS Secrets Manager
USE_AWS_SECRETS=true

# AWS Region
AWS_REGION=us-west-1

# Public URLs
NEXTAUTH_URL=https://your-domain.com

# AWS S3
S3_BUCKET=calitho-suite1
S3_REGION=us-west-1

# AWS Secrets Manager secret names
AWS_SECRET_DATABASE=calitho-suite/database
AWS_SECRET_NEXTAUTH=calitho-suite/nextauth
AWS_SECRET_REDIS=calitho-suite/redis
```

**Important**: Do NOT include `DATABASE_URL`, `NEXTAUTH_SECRET`, or `REDIS_URL` in production env files. These will be fetched from AWS Secrets Manager.

---

## Step 4: Build and Deploy

### Build the Application

```bash
# Install dependencies
pnpm install

# Generate Prisma Client
pnpm db:generate

# Build all apps
pnpm build
```

### Run Database Migrations

```bash
# Apply migrations to production database
DATABASE_URL="your-neon-url" pnpm db:migrate
```

### Start the Application

```bash
# Start with AWS Secrets Manager
pnpm start:prod
```

---

## Deployment Platforms

### AWS EC2

1. Launch EC2 instance with appropriate IAM role
2. Install Node.js 20+
3. Clone repository
4. Run build and start commands
5. Use PM2 for process management:

```bash
npm install -g pm2
pm2 start "pnpm start:prod" --name calitho-suite
pm2 save
pm2 startup
```

### AWS ECS (Fargate)

Example `docker-compose.yml`:

```yaml
version: '3.8'
services:
  web:
    build: ./apps/web
    environment:
      - NODE_ENV=production
      - USE_AWS_SECRETS=true
      - AWS_REGION=us-west-1
    ports:
      - "3000:3000"

  worker:
    build: ./apps/worker
    environment:
      - NODE_ENV=production
      - USE_AWS_SECRETS=true
      - AWS_REGION=us-west-1
```

### Vercel (Web App Only)

1. Connect GitHub repository to Vercel
2. Add environment variables in Vercel dashboard:
   - `DATABASE_URL` (from Neon)
   - `NEXTAUTH_SECRET` (generate new)
   - `REDIS_URL` (from Upstash)
   - `S3_BUCKET`
   - `S3_REGION`
   - `NEXTAUTH_URL`

3. Deploy:

```bash
vercel --prod
```

**Note**: Vercel doesn't support AWS Secrets Manager directly. Use Vercel environment variables instead.

### Railway/Render

1. Connect repository
2. Add environment variables in dashboard
3. Deploy automatically on push

---

## How It Works

### Local Development

When `NODE_ENV !== 'production'`, the app uses values from `.env`:

```typescript
// lib/secrets.ts
export async function getDatabaseUrl(): Promise<string> {
  if (process.env.NODE_ENV === 'development' && process.env.DATABASE_URL) {
    return process.env.DATABASE_URL // Uses .env file
  }
  // ... AWS Secrets Manager logic
}
```

### Production

When `NODE_ENV === 'production'` or `USE_AWS_SECRETS === 'true'`:

1. App starts
2. Secrets utility fetches from AWS Secrets Manager
3. Values cached in memory for performance
4. Prisma connects using fetched DATABASE_URL

---

## Verification

### Test AWS Secrets Manager Connection

```bash
# Test fetching a secret
aws secretsmanager get-secret-value \
  --secret-id calitho-suite/database \
  --region us-west-1
```

### Test Application

```bash
# Run locally with AWS Secrets Manager
USE_AWS_SECRETS=true pnpm dev
```

---

## Troubleshooting

### Error: "Secret not found"

- Verify secret exists: `aws secretsmanager list-secrets`
- Check secret name matches exactly
- Verify AWS region is correct

### Error: "Access Denied"

- Check IAM permissions
- Verify IAM role is attached to EC2/ECS
- For local testing, ensure AWS CLI is configured

### Database Connection Fails

- Verify Neon database allows connections from your deployment IP
- Check DATABASE_URL format in secrets
- Ensure SSL mode is set: `?sslmode=require`

### Prisma Client Errors

- Regenerate Prisma client: `pnpm db:generate`
- Ensure DATABASE_URL is available before Prisma initializes

---

## Security Best Practices

1. ✅ **Never commit** `.env` files to version control
2. ✅ **Use IAM roles** instead of access keys in production
3. ✅ **Rotate secrets** every 90 days
4. ✅ **Use different secrets** for dev/staging/prod
5. ✅ **Enable CloudTrail** for audit logging
6. ✅ **Use least privilege** IAM policies
7. ✅ **Enable MFA** on AWS account

---

## Cost Estimation

### AWS Secrets Manager
- $0.40/secret/month × 3 secrets = **$1.20/month**
- $0.05 per 10,000 API calls (cached in app, minimal cost)

### Neon PostgreSQL
- Free tier: 0.5 GB storage
- Paid: Starting at $19/month for 10 GB

### AWS S3
- First 50 TB: $0.023 per GB/month
- PUT requests: $0.005 per 1,000 requests

### Total Estimated Cost
- **Development**: Free (using free tiers)
- **Small Production**: ~$25-50/month
- **Medium Production**: ~$100-200/month

---

## Monitoring

### CloudWatch Logs

Enable logging for debugging:

```javascript
// Add to your app
import winston from 'winston'

const logger = winston.createLogger({
  transports: [
    new winston.transports.CloudWatchLogs({
      logGroupName: '/calitho-suite/app',
      logStreamName: process.env.HOSTNAME
    })
  ]
})
```

### Secrets Access Monitoring

View who accessed secrets:

```bash
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=calitho-suite/database
```

---

## Rollback Plan

If deployment fails:

1. Keep previous deployment running
2. Revert to previous version
3. Check CloudWatch logs for errors
4. Verify secrets are accessible
5. Test database connectivity

---

## Support

For issues:
- Check logs: `pm2 logs` or CloudWatch
- Review [AWS_SECRETS_MANAGER.md](./AWS_SECRETS_MANAGER.md)
- Verify IAM permissions
- Test secrets access with AWS CLI

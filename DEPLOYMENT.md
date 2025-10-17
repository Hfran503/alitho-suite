# Deployment Guide - Dokploy VPS

This guide walks you through deploying the CRM/ERP system to a VPS using Dokploy.

## Prerequisites

- A VPS (minimum 4GB RAM, 2 CPU cores, 50GB storage)
- Dokploy installed on your VPS
- Domain name with DNS access
- SSH access to your VPS

## Step-by-Step Deployment

### 1. VPS Setup

**Install Dokploy:**

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Install Dokploy (follow official docs)
curl -sSL https://dokploy.com/install.sh | sh
```

**Configure DNS:**

Add A records pointing to your VPS IP:
- `app.yourdomain.com`
- `storage.yourdomain.com`
- `s3.yourdomain.com`

### 2. Prepare Environment Variables

On your local machine, create `.env.production`:

```bash
# Generate strong secrets
POSTGRES_PASSWORD=$(openssl rand -base64 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
S3_ACCESS_KEY_ID=minioadmin  # Change this
S3_SECRET_ACCESS_KEY=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)

# Construct DATABASE_URL
DATABASE_URL=postgresql://app:${POSTGRES_PASSWORD}@postgres:5432/app

# Construct REDIS_URL
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# Set your domains
NEXTAUTH_URL=https://app.yourdomain.com
WEB_DOMAIN=app.yourdomain.com
STORAGE_DOMAIN=storage.yourdomain.com
STORAGE_API_DOMAIN=s3.yourdomain.com

# S3 Configuration
S3_BUCKET=crm-uploads
S3_REGION=us-east-1
S3_ENDPOINT=http://minio:9000
```

### 3. Deploy to Dokploy

**Option A: Using Dokploy UI**

1. Open Dokploy dashboard: `https://your-vps-ip:3000`
2. Create new application
3. Select "Docker Compose" deployment
4. Connect your Git repository
5. Set build context to root directory
6. Upload `docker-compose.yml`
7. Add environment variables from `.env.production`
8. Click "Deploy"

**Option B: Using Git Integration**

1. Push code to GitHub/GitLab
2. In Dokploy, create new app from Git
3. Configure:
   - Repository URL
   - Branch: `main`
   - Docker Compose file: `docker-compose.yml`
4. Add environment variables
5. Enable auto-deploy on push
6. Deploy

### 4. Post-Deployment Setup

**Wait for deployment to complete:**

```bash
# SSH into VPS
ssh root@your-vps-ip

# Check containers are running
docker compose ps

# Expected output:
# web         Up      Healthy
# worker      Up
# postgres    Up      Healthy
# redis       Up      Healthy
# minio       Up      Healthy
```

**Initialize MinIO:**

```bash
# Create buckets and set policies
docker compose exec web bash -c "cd /app && bash scripts/setup-minio.sh"
```

**Verify database migrations:**

```bash
# Migrations should run automatically via migrator service
# Check logs:
docker compose logs migrator

# If needed, run manually:
docker compose exec web bash -c "cd /app && pnpm db:migrate"
```

**Seed initial data (optional):**

```bash
docker compose exec web bash -c "cd /app && pnpm db:seed"
```

**Run health check:**

```bash
docker compose exec web bash /app/scripts/health-check.sh
```

### 5. Configure SSL/TLS

Dokploy with Traefik automatically provisions Let's Encrypt certificates.

**Verify HTTPS is working:**

```bash
curl https://app.yourdomain.com/api/healthz
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-10-16T...",
  "services": {
    "database": "up",
    "redis": "up"
  }
}
```

### 6. Set Up Cloudflare (Recommended)

1. **Add site to Cloudflare:**
   - Add your domain
   - Update nameservers at your registrar

2. **Configure DNS:**
   - Set all records to "Proxied" (orange cloud)
   - This enables CDN, DDoS protection, and WAF

3. **SSL/TLS Settings:**
   - SSL/TLS mode: "Full (strict)"
   - Enable "Always Use HTTPS"
   - Enable HSTS

4. **Security Settings:**
   - Enable WAF (Web Application Firewall)
   - Set Security Level: "Medium" or "High"
   - Enable Bot Fight Mode

5. **Performance:**
   - Enable Auto Minify (JS, CSS, HTML)
   - Enable Brotli compression
   - Set caching rules for static assets

### 7. Configure Automated Backups

**Set up cron job for daily backups:**

```bash
# Edit crontab on VPS
crontab -e

# Add this line (runs daily at 2 AM):
0 2 * * * cd /path/to/app && docker compose exec -T web bash /app/scripts/backup-postgres.sh >> /var/log/postgres-backup.log 2>&1
```

**Verify backups are created:**

```bash
# Check MinIO for backups
docker compose exec minio mc ls local/crm-uploads/db-backups/
```

### 8. Monitoring Setup

**View logs:**

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f web
docker compose logs -f worker
```

**Set up log rotation:**

```bash
# Create logrotate config
sudo tee /etc/logrotate.d/docker-compose <<EOF
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    delaycompress
    copytruncate
}
EOF
```

### 9. First Login

1. **Access application:**
   ```
   https://app.yourdomain.com
   ```

2. **Login with seeded credentials (if you ran seed):**
   - Email: `demo@example.com`
   - Password: `password123`

3. **Change password immediately** and create your real admin account

4. **Delete demo account** after setting up production users

### 10. Update & Maintenance

**Update application:**

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose up -d --build

# Run migrations if needed
docker compose exec web bash -c "cd /app && pnpm db:migrate"
```

**Zero-downtime deployments:**

Dokploy supports rolling updates. Configure in UI:
- Health check grace period: 30s
- Rolling update strategy
- Keep old containers until new ones are healthy

**Database maintenance:**

```bash
# Vacuum and analyze
docker compose exec postgres psql -U app -d app -c "VACUUM ANALYZE;"

# Check database size
docker compose exec postgres psql -U app -d app -c "SELECT pg_size_pretty(pg_database_size('app'));"
```

## Troubleshooting

### Deployment fails

**Check build logs:**
```bash
docker compose logs --tail=100
```

**Common issues:**
- Missing environment variables → Check Dokploy secrets
- Port conflicts → Ensure ports 3000, 5432, 6379, 9000 are free
- Memory issues → Upgrade VPS or reduce worker concurrency

### Application crashes

**Check web logs:**
```bash
docker compose logs web --tail=100
```

**Common causes:**
- Database connection failed → Verify DATABASE_URL
- Redis connection failed → Verify REDIS_URL
- Missing Prisma client → Run `pnpm db:generate`

### Slow performance

**Optimize database:**
```bash
# Add indexes (already in schema)
# Analyze query performance
docker compose exec postgres psql -U app -d app

# In psql:
EXPLAIN ANALYZE SELECT * FROM "Order" WHERE "tenantId" = 'xxx';
```

**Scale web service:**

In `docker-compose.yml`:
```yaml
web:
  deploy:
    replicas: 3  # Run 3 instances
```

**Enable Redis caching:**

Caching is already implemented. Adjust TTL in `lib/redis.ts` as needed.

### Worker jobs stuck

**Check worker logs:**
```bash
docker compose logs worker --tail=100
```

**Inspect Redis queues:**
```bash
docker compose exec redis redis-cli

# In redis-cli:
KEYS bull:*
LLEN bull:exports:wait
```

**Clear failed jobs:**
```bash
# From web container
docker compose exec web node
> const { exportQueue } = require('./lib/queue')
> await exportQueue.clean(0, 1000, 'failed')
```

## Security Checklist

- [ ] Strong passwords for all services
- [ ] HTTPS enabled with valid certificates
- [ ] Firewall configured (only 80, 443, 22 open)
- [ ] PostgreSQL not exposed publicly
- [ ] Redis password set
- [ ] Regular security updates
- [ ] Backup encryption enabled
- [ ] Cloudflare WAF configured
- [ ] Rate limiting enabled
- [ ] Audit logs reviewed regularly

## Performance Checklist

- [ ] Database indexes optimized
- [ ] Redis caching enabled
- [ ] Cloudflare CDN configured
- [ ] Static assets compressed
- [ ] Worker concurrency tuned
- [ ] Database connection pooling configured
- [ ] Next.js image optimization enabled
- [ ] Logs rotated automatically

## Next Steps

- Set up monitoring (Sentry, Prometheus, etc.)
- Configure email service for notifications
- Implement additional features
- Set up staging environment
- Configure CI/CD pipeline
- Add automated tests
- Document custom workflows
- Train team members

## Support

For deployment issues:
- Check Dokploy documentation
- Review application logs
- Open GitHub issue
- Contact VPS provider support

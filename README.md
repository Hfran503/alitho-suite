# CRM/ERP System - Dokploy VPS Deployment

A production-ready, full-stack TypeScript CRM/ERP system built with Next.js 15, designed for deployment on a single VPS using Dokploy.

## Architecture Overview

```
Internet / CDN (Cloudflare)
        ↓
    Traefik (TLS)
        ↓
   ┌────┴─────┐
   ↓          ↓
  Web      MinIO
(Next.js)  (S3 Storage)
   ↓
   ├─→ PostgreSQL
   ├─→ Redis (Cache + Queues)
   └─→ Worker (BullMQ)
```

## Tech Stack

### Frontend & API
- **Next.js 15** - App Router, Server Components, Server Actions
- **React 18** - UI library
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **TanStack Table** - Data tables

### Backend
- **PostgreSQL 16** - Primary database
- **Prisma** - ORM and migrations
- **Redis 7** - Cache, sessions, job queues
- **BullMQ** - Job queue processing
- **NextAuth** - Authentication

### Storage & Processing
- **MinIO** - S3-compatible object storage
- **Playwright** - PDF generation
- **ExcelJS** - Excel exports
- **csv-writer** - CSV exports

### Infrastructure
- **Docker** - Containerization
- **Dokploy** - Deployment platform
- **Traefik** - Reverse proxy (via Dokploy)
- **pnpm** - Package manager
- **Turbo** - Monorepo build system

## Project Structure

```
.
├── apps/
│   ├── web/                # Next.js application
│   │   ├── app/           # App Router pages
│   │   │   ├── api/       # API routes
│   │   │   └── (dashboard)/ # Dashboard pages
│   │   ├── lib/           # Utilities (auth, s3, queue, redis)
│   │   └── Dockerfile     # Web service Docker build
│   └── worker/            # BullMQ worker service
│       ├── jobs/          # Job processors
│       │   ├── export.ts  # CSV/Excel exports
│       │   ├── pdf.ts     # PDF generation
│       │   ├── email.ts   # Email sending
│       │   └── webhook.ts # Webhook delivery
│       └── Dockerfile     # Worker service Docker build
├── packages/
│   ├── database/          # Prisma schema & client
│   ├── types/             # Shared Zod schemas & types
│   └── ui/                # Shared UI components
├── prisma/
│   └── schema.prisma      # Database schema
├── scripts/
│   ├── backup-postgres.sh # Database backup script
│   ├── restore-postgres.sh # Database restore script
│   ├── setup-minio.sh     # MinIO initialization
│   └── health-check.sh    # Service health checks
└── docker-compose.yml     # Production deployment config
```

## Features

### Multi-Tenancy
- Tenant isolation at database level
- User memberships with RBAC (owner, admin, member, viewer)
- Tenant-scoped data access

### Order Management
- Full CRUD operations
- Server-side pagination and filtering
- Order items with flexible schema
- Status tracking (pending, processing, shipped, delivered, cancelled)

### File Uploads
- Direct-to-S3 presigned URLs
- Support for any file type
- Metadata tracking in PostgreSQL
- Attachment linking to entities (orders, etc.)

### Background Jobs
- CSV/Excel/PDF export generation
- Email sending queue
- Webhook delivery with retries
- Customizable job processors

### Audit Logging
- Comprehensive activity tracking
- User attribution
- IP address and user agent capture
- Metadata storage for detailed context

### Authentication
- Email/password authentication
- Session management
- Extensible for SSO (OIDC, SAML)

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- A VPS with Dokploy installed

### Local Development

1. **Clone and install dependencies:**

```bash
pnpm install
```

2. **Set up environment variables:**

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start local database:**

```bash
docker compose up -d postgres redis minio
```

4. **Run database migrations:**

```bash
pnpm db:migrate
pnpm db:generate
```

5. **Seed database (optional):**

```bash
pnpm db:seed
```

6. **Start development servers:**

```bash
pnpm dev
```

This starts:
- Web app: http://localhost:3000
- Worker: Running in background

### Production Deployment (Dokploy)

1. **Prepare environment variables:**

Create a `.env.production` file based on `.env.production.example`:

```bash
POSTGRES_PASSWORD=your-strong-password
NEXTAUTH_SECRET=$(openssl rand -base64 32)
S3_ACCESS_KEY_ID=your-minio-key
S3_SECRET_ACCESS_KEY=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)

WEB_DOMAIN=app.yourdomain.com
STORAGE_DOMAIN=storage.yourdomain.com
STORAGE_API_DOMAIN=s3.yourdomain.com
```

2. **Deploy to Dokploy:**

In your Dokploy dashboard:
- Create a new application
- Connect to your Git repository
- Set environment variables from `.env.production`
- Deploy using the `docker-compose.yml` configuration

3. **Run initial setup:**

```bash
# SSH into your VPS
ssh user@your-vps

# Setup MinIO buckets
docker compose exec web bash /app/scripts/setup-minio.sh

# Verify health
docker compose exec web bash /app/scripts/health-check.sh
```

4. **Configure DNS:**

Point your domains to your VPS IP:
- `app.yourdomain.com` → Web application
- `storage.yourdomain.com` → MinIO console
- `s3.yourdomain.com` → MinIO S3 API

Traefik (via Dokploy) will automatically provision Let's Encrypt SSL certificates.

## Database Management

### Migrations

```bash
# Create a new migration
pnpm db:migrate:dev

# Deploy migrations in production
pnpm db:migrate
```

### Backups

Automated backups to S3/MinIO:

```bash
# Manual backup
docker compose exec web bash /app/scripts/backup-postgres.sh

# Restore from backup
docker compose exec web bash /app/scripts/restore-postgres.sh pg-backup-20241016-120000.sql.gz
```

Set up a cron job for automated daily backups:

```bash
0 2 * * * docker compose exec -T web bash /app/scripts/backup-postgres.sh
```

### Database Studio

```bash
pnpm db:studio
```

Access Prisma Studio at http://localhost:5555

## API Endpoints

### Authentication
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/session` - Get current session

### Orders
- `GET /api/orders` - List orders (paginated)
- `GET /api/orders/[id]` - Get single order
- `POST /api/orders` - Create order
- `PATCH /api/orders/[id]` - Update order
- `DELETE /api/orders/[id]` - Delete order
- `POST /api/orders/export` - Export orders (queued)

### Uploads
- `POST /api/uploads/presign` - Get presigned upload URL

### Health
- `GET /api/healthz` - Health check

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://app:pass@postgres:5432/app` |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` |
| `NEXTAUTH_SECRET` | NextAuth encryption key | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Application URL | `https://app.yourdomain.com` |
| `S3_ACCESS_KEY_ID` | MinIO/S3 access key | `your-access-key` |
| `S3_SECRET_ACCESS_KEY` | MinIO/S3 secret key | `your-secret-key` |
| `S3_BUCKET` | S3 bucket name | `crm-uploads` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `S3_REGION` | S3 region | `us-east-1` |
| `S3_ENDPOINT` | S3 endpoint URL | `http://minio:9000` |
| `REDIS_PASSWORD` | Redis password | - |
| `SENTRY_DSN` | Sentry error tracking | - |

## Monitoring & Observability

### Health Checks

All services have health checks configured:
- Web: `/api/healthz`
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`
- MinIO: `/minio/health/live`

### Logs

View logs for each service:

```bash
# Web logs
docker compose logs -f web

# Worker logs
docker compose logs -f worker

# All logs
docker compose logs -f
```

### Metrics (Optional)

For production monitoring, consider adding:
- **Sentry** - Error tracking
- **OpenTelemetry** - Distributed tracing
- **Grafana + Loki** - Log aggregation
- **Prometheus** - Metrics collection

## Security Best Practices

1. **Keep services internal:**
   - PostgreSQL and Redis should NOT be exposed publicly
   - Use VPN or SSH tunnels for admin access

2. **Use strong secrets:**
   - Generate all secrets with `openssl rand -base64 32`
   - Rotate secrets regularly

3. **Configure Cloudflare:**
   - Enable WAF (Web Application Firewall)
   - Set up rate limiting
   - Enable DDoS protection

4. **Regular updates:**
   - Keep Docker images updated
   - Apply security patches promptly

5. **Backup encryption:**
   - Consider encrypting backups at rest

## Performance Optimization

### Caching Strategy

- **Redis caching** for frequently accessed data
- **Next.js ISR** for static content
- **CDN** via Cloudflare for static assets

### Database Optimization

- Indexes on frequently queried columns (see Prisma schema)
- Connection pooling via Prisma
- Regular VACUUM and ANALYZE

### Scaling

When you outgrow a single VPS:

1. **Horizontal scaling:**
   - Run multiple `web` replicas
   - Use external managed PostgreSQL (e.g., Neon, Supabase)
   - Use Redis Cloud or AWS ElastiCache

2. **Vertical scaling:**
   - Upgrade VPS resources
   - Optimize queries and indexes

## Troubleshooting

### Application won't start

```bash
# Check logs
docker compose logs web

# Verify database connection
docker compose exec web node -e "require('@repo/database').db.\$connect()"

# Check environment variables
docker compose exec web env | grep DATABASE_URL
```

### Worker jobs not processing

```bash
# Check worker logs
docker compose logs worker

# Verify Redis connection
docker compose exec redis redis-cli ping

# Check queue status (from web container)
docker compose exec web node -e "require('./lib/redis').redis.keys('bull:*')"
```

### File uploads failing

```bash
# Check MinIO status
docker compose exec minio mc admin info local

# Verify bucket exists
docker compose exec minio mc ls local/

# Check S3 credentials
docker compose exec web env | grep S3_
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `pnpm test` (when implemented)
4. Submit a pull request

## License

MIT

## Support

For issues and questions:
- Open an issue on GitHub
- Check the documentation
- Review the example code

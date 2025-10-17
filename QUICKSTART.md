# Quick Start Guide

Get your CRM/ERP system up and running in minutes.

## Prerequisites

- Node.js 20+ installed
- pnpm 9+ installed (`npm install -g pnpm`)
- Docker Desktop running

## Local Development (5 minutes)

### 1. Install Dependencies

```bash
pnpm install
```

This installs all dependencies for the monorepo (web, worker, and shared packages).

### 2. Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, and MinIO (dev version with port mappings)
docker compose -f docker-compose.dev.yml up -d
```

Wait about 30 seconds for services to be ready.

> **Note:** We use `docker-compose.dev.yml` for local development which maps ports to localhost. Port 5433 is used for PostgreSQL to avoid conflicts with local PostgreSQL installations.

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env
```

The default `.env.example` works for local development. No changes needed!

### 4. Set Up Database

```bash
# Push schema to database (for development)
npx prisma db push --schema=./prisma/schema.prisma

# Generate Prisma Client
pnpm db:generate

# Seed demo data (run from root)
cd packages/database && npx tsx src/seed.ts
```

This creates:
- Demo tenant: "Demo Company"
- Demo user: `demo@example.com` / `password123`
- 5 sample orders

### 5. Start Development Servers

```bash
# Start web and worker in development mode
pnpm dev
```

This starts:
- **Web app**: http://localhost:3000
- **Worker**: Background job processor

### 6. Access the Application

Open http://localhost:3000 in your browser.

**Login with:**
- Email: `demo@example.com`
- Password: `password123`

You should see the dashboard with sample orders!

## What You Get

After setup, you'll have:

✅ **Multi-tenant CRM/ERP** with user authentication
✅ **Order management** with full CRUD operations
✅ **File uploads** to S3/MinIO
✅ **Background jobs** for exports and PDF generation
✅ **Audit logging** for all actions
✅ **PostgreSQL** database with Prisma ORM
✅ **Redis** for caching and queues
✅ **MinIO** S3-compatible storage

## Testing Features

### Create a New Order

1. Go to "Create New Order" from dashboard
2. Fill in customer details and add items
3. Submit - watch it appear in the orders list

### Export Orders

1. Navigate to orders list
2. Click "Export" button
3. Choose CSV or Excel
4. Worker processes the job in background
5. Download link appears when ready

### Generate PDF Invoice

1. Open any order
2. Click "Generate Invoice"
3. PDF is created via Playwright
4. Download from S3/MinIO

### Upload Attachments

1. Open any order
2. Click "Add Attachment"
3. Select file
4. File uploads directly to MinIO via presigned URL
5. Metadata stored in PostgreSQL

## Development Workflow

### Making Changes

```bash
# Edit code in apps/web or apps/worker
# Changes auto-reload in dev mode

# Add new API route
touch apps/web/app/api/customers/route.ts

# Add new worker job
touch apps/worker/jobs/send-invoice.ts
```

### Database Changes

```bash
# Edit schema
vim prisma/schema.prisma

# Create migration
pnpm db:migrate:dev --name add_customers

# Apply migration
pnpm db:migrate
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f minio
```

### Database Admin

```bash
# Prisma Studio (GUI)
pnpm db:studio
# Opens at http://localhost:5555

# psql CLI
docker compose exec postgres psql -U app -d app
```

### MinIO Console

Open http://localhost:9001

**Login:**
- Username: `minioadmin`
- Password: `minioadmin`

Browse uploaded files and backups.

## Stopping Services

```bash
# Stop dev servers
# Press Ctrl+C in terminal running pnpm dev

# Stop infrastructure
docker compose down

# Stop and remove volumes (deletes data!)
docker compose down -v
```

## Next Steps

- [ ] Read [README.md](README.md) for full documentation
- [ ] Check [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- [ ] Customize Prisma schema for your needs
- [ ] Build custom features in Next.js
- [ ] Add more worker job types
- [ ] Set up CI/CD pipeline

## Troubleshooting

### Port Already in Use

If ports 3000, 5432, 6379, or 9000 are in use:

```bash
# Stop conflicting services
docker ps  # Find conflicting containers
docker stop <container-id>

# Or change ports in docker-compose.yml
```

### Database Connection Error

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# View logs
docker compose logs postgres

# Restart service
docker compose restart postgres
```

### "Prisma Client not generated"

```bash
# Generate Prisma Client
pnpm db:generate

# Restart dev server
pnpm dev
```

### Worker Not Processing Jobs

```bash
# Check worker logs
# Look for connection errors

# Verify Redis is running
docker compose ps redis

# Test Redis connection
docker compose exec redis redis-cli ping
# Should return "PONG"
```

## Development Tips

1. **Use Prisma Studio** for quick data inspection
2. **Check Redis queues** to debug job processing
3. **Monitor MinIO console** to see uploaded files
4. **Use health check** endpoint: http://localhost:3000/api/healthz
5. **Read API responses** in browser DevTools Network tab

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [BullMQ Docs](https://docs.bullmq.io)
- [MinIO Docs](https://min.io/docs/minio/linux/index.html)
- [NextAuth Docs](https://next-auth.js.org)

## Getting Help

- Check logs: `docker compose logs -f`
- Review API responses in browser DevTools
- Read error messages carefully
- Check environment variables in `.env`
- Verify all services are running: `docker compose ps`

Happy coding! 🚀

# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Internet / Users                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Cloudflare  │  ← CDN, WAF, DDoS Protection
                    │   (Optional)  │
                    └───────┬───────┘
                            │ HTTPS
                            ▼
                    ┌───────────────┐
                    │    Traefik    │  ← Reverse Proxy + SSL/TLS
                    │  (via Dokploy)│
                    └───────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  Web (Next.js)│  │   MinIO       │  │  (Optional)   │
│  Port 3000    │  │  Console 9001 │  │  WebSocket    │
└───────┬───────┘  └───────────────┘  └───────────────┘
        │
        │ Connects to:
        ├─────────────────────┐
        │                     │
        ▼                     ▼
┌───────────────┐    ┌───────────────┐
│  PostgreSQL   │    │     Redis     │
│  Port 5432    │    │   Port 6379   │
│  (Primary DB) │    │ (Cache+Queue) │
└───────────────┘    └───────┬───────┘
                             │
                             │ Consumes jobs
                             ▼
                    ┌───────────────┐
                    │    Worker     │
                    │   (BullMQ)    │
                    └───────┬───────┘
                            │
                            │ Uploads to
                            ▼
                    ┌───────────────┐
                    │     MinIO     │
                    │  S3 API 9000  │
                    └───────────────┘
```

## Component Responsibilities

### Web (Next.js 15)
**Role**: Main application server

**Responsibilities:**
- Serve UI (React Server Components)
- Handle API requests
- Authenticate users (NextAuth)
- Query database (Prisma)
- Enqueue background jobs
- Generate presigned URLs for uploads

**Technology:**
- Next.js 15 App Router
- React 18
- NextAuth for authentication
- Prisma ORM
- BullMQ for job enqueueing

**Port:** 3000 (internal), exposed via Traefik

---

### Worker (Node.js)
**Role**: Background job processor

**Responsibilities:**
- Process export jobs (CSV, Excel, PDF)
- Generate PDF invoices with Playwright
- Send emails (when configured)
- Deliver webhooks with retries
- Upload results to S3/MinIO

**Technology:**
- BullMQ workers
- Playwright (Chromium)
- ExcelJS, csv-writer
- AWS SDK v3

**Concurrency:** Configurable per job type

---

### PostgreSQL 16
**Role**: Primary database

**Responsibilities:**
- Store all relational data
- Tenants, users, memberships
- Orders, order items
- Attachments metadata
- Audit logs
- Session data

**Technology:**
- PostgreSQL 16 Alpine
- Managed by Prisma migrations

**Port:** 5432 (internal only)

---

### Redis 7
**Role**: Cache and job queue

**Responsibilities:**
- Session cache
- Application data cache
- BullMQ job queues
- Rate limiting counters
- Pub/Sub for realtime (optional)

**Technology:**
- Redis 7 Alpine
- AOF persistence enabled

**Port:** 6379 (internal only)

---

### MinIO
**Role**: Object storage (S3-compatible)

**Responsibilities:**
- Store uploaded files
- Store generated exports
- Store PDF invoices
- Store database backups

**Technology:**
- MinIO latest stable
- S3-compatible API

**Ports:**
- 9000: S3 API (internal)
- 9001: Web console (exposed via Traefik)

---

## Data Flow Diagrams

### User Request Flow

```
┌──────┐
│ User │
└───┬──┘
    │ 1. HTTPS Request
    ▼
┌─────────┐
│Cloudflare│
└────┬────┘
     │ 2. Forward
     ▼
┌─────────┐
│ Traefik │
└────┬────┘
     │ 3. Route to web:3000
     ▼
┌──────────┐
│   Next   │ 4. Check session (Redis)
│   Auth   │◄────────────┐
└────┬─────┘             │
     │ 5. Verify          │
     ▼                   │
┌──────────┐            │
│  Server  │            │
│Component │            │
└────┬─────┘            │
     │ 6. Query          │
     ▼                   │
┌──────────┐   ┌────────┴────┐
│PostgreSQL│   │    Redis    │
└────┬─────┘   └─────────────┘
     │ 7. Data
     ▼
┌──────────┐
│  Render  │
│   HTML   │
└────┬─────┘
     │ 8. Response
     ▼
┌──────┐
│ User │
└──────┘
```

### File Upload Flow

```
┌──────┐
│ User │ 1. Request presigned URL
└───┬──┘
    │
    ▼
┌──────────┐
│   Next   │ 2. Verify auth
│  /api/   │
│ uploads/ │
│ presign  │
└────┬─────┘
     │ 3. Generate presigned URL
     ▼
┌──────────┐
│ AWS SDK  │
│    +     │
│  MinIO   │
└────┬─────┘
     │ 4. Return presigned URL + metadata
     ▼
┌──────────┐
│PostgreSQL│ 5. Save attachment metadata
└──────────┘
     │ 6. Return to client
     ▼
┌──────┐
│ User │ 7. Upload directly to MinIO
└───┬──┘    (bypassing server)
    │
    ▼
┌──────────┐
│  MinIO   │ 8. Store file
└──────────┘
```

### Background Job Flow

```
┌──────────┐
│   User   │ 1. Request export
└────┬─────┘
     │
     ▼
┌──────────┐
│   Next   │ 2. Authenticate & validate
│  /api/   │
│ orders/  │
│  export  │
└────┬─────┘
     │ 3. Enqueue job
     ▼
┌──────────┐
│  BullMQ  │◄────┐
│   +      │     │
│  Redis   │     │ 4. Store job
└────┬─────┘     │
     │           │
     │ 5. Return job ID
     │           │
     ▼           │
┌──────────┐    │
│   User   │    │
└──────────┘    │
                │
     ┌──────────┘
     │ 6. Worker polls queue
     ▼
┌──────────┐
│  Worker  │ 7. Process job
│  Process │
└────┬─────┘
     │ 8. Query data
     ▼
┌──────────┐
│PostgreSQL│
└────┬─────┘
     │ 9. Generate file (CSV/Excel/PDF)
     ▼
┌──────────┐
│ Playwright│ (for PDFs)
│ ExcelJS  │ (for Excel)
│csv-writer│ (for CSV)
└────┬─────┘
     │ 10. Upload to storage
     ▼
┌──────────┐
│  MinIO   │
└────┬─────┘
     │ 11. Update job status
     ▼
┌──────────┐
│  Redis   │ 12. Job complete
└──────────┘
```

## Network Topology

### Production (Single VPS)

```
┌─────────────────────────────────────────────────────┐
│                    VPS Server                       │
│                                                     │
│  ┌────────────────────────────────────────────┐   │
│  │         Docker Network (bridge)            │   │
│  │                                            │   │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │   │
│  │  │ web  │  │worker│  │postgres│ │redis│ │   │
│  │  └───┬──┘  └───┬──┘  └───┬──┘  └───┬─┘ │   │
│  │      │         │         │          │    │   │
│  │      └─────────┴─────────┴──────────┘    │   │
│  │              Internal network             │   │
│  │         (services access via names)       │   │
│  │                                            │   │
│  │  ┌──────┐                                 │   │
│  │  │minIO │                                 │   │
│  │  └───┬──┘                                 │   │
│  │      │                                     │   │
│  └──────┼─────────────────────────────────────┘   │
│         │                                         │
│         ▼                                         │
│  ┌─────────────┐                                 │
│  │   Traefik   │ ← Dokploy managed              │
│  └──────┬──────┘                                 │
│         │                                         │
└─────────┼─────────────────────────────────────────┘
          │
          │ Ports 80, 443
          ▼
     Internet
```

### Development (Local)

```
┌─────────────────────────────────────────────────────┐
│              Your Computer                          │
│                                                     │
│  ┌────────────────────────────────────────────┐   │
│  │    Docker Desktop Network                  │   │
│  │                                            │   │
│  │  ┌──────┐  ┌──────┐  ┌──────┐            │   │
│  │  │postgres│ │redis │  │minIO │            │   │
│  │  └───┬──┘  └───┬──┘  └───┬──┘            │   │
│  │      │         │          │                │   │
│  │      │    Port mappings:                   │   │
│  │      │    5432, 6379, 9000, 9001          │   │
│  └──────┼─────────┼──────────┼────────────────┘   │
│         │         │          │                     │
│         ▼         ▼          ▼                     │
│  ┌──────────────────────────────────┐             │
│  │       localhost:5432, etc        │             │
│  └──────────────────────────────────┘             │
│                                                     │
│  ┌────────────────────────────────────────────┐   │
│  │   Native Node.js Processes (pnpm dev)      │   │
│  │                                            │   │
│  │  ┌──────────┐       ┌──────────┐         │   │
│  │  │   Next   │       │  Worker  │         │   │
│  │  │  :3000   │       │  (BG)    │         │   │
│  │  └──────────┘       └──────────┘         │   │
│  │      ▲                    ▲               │   │
│  │      │                    │               │   │
│  │      └────────┬───────────┘               │   │
│  │         Connects to Docker services       │   │
│  └────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Scaling Strategies

### Vertical Scaling (Single VPS)
**Good for**: 0-10k users

```
Upgrade VPS resources:
- 4GB → 8GB → 16GB RAM
- 2 → 4 → 8 CPU cores
- 50GB → 100GB → 200GB storage
```

### Horizontal Scaling (Multiple Services)
**Good for**: 10k-100k+ users

```
┌──────────────┐
│ Load Balancer│
└──────┬───────┘
       │
   ┌───┴────┐
   ▼        ▼
┌─────┐  ┌─────┐
│Web 1│  │Web 2│  ← Multiple Next.js instances
└──┬──┘  └──┬──┘
   │        │
   └────┬───┘
        ▼
   ┌─────────────┐
   │ Managed DB  │  ← External PostgreSQL
   │   (Neon,    │     (horizontal read replicas)
   │  Supabase)  │
   └─────────────┘

   ┌─────────────┐
   │ Redis Cloud │  ← Managed Redis cluster
   └─────────────┘

   ┌─────────────┐
   │  Worker 1   │  ← Multiple workers
   │  Worker 2   │
   │  Worker 3   │
   └─────────────┘

   ┌─────────────┐
   │  AWS S3 /   │  ← Managed object storage
   │Cloudflare R2│
   └─────────────┘
```

## Security Zones

```
┌─────────────────────────────────────────┐
│         Public Zone (Internet)          │
│  - Cloudflare CDN                       │
│  - Public IP                            │
└────────────┬────────────────────────────┘
             │ Firewall: 80, 443, 22 only
             ▼
┌─────────────────────────────────────────┐
│         DMZ (Traefik)                   │
│  - SSL/TLS termination                  │
│  - Request routing                      │
│  - Rate limiting                        │
└────────────┬────────────────────────────┘
             │ Internal network only
             ▼
┌─────────────────────────────────────────┐
│    Application Zone (Docker Network)    │
│  - Web (Next.js)                        │
│  - Worker                               │
│  - MinIO console (via Traefik)          │
└────────────┬────────────────────────────┘
             │ No external access
             ▼
┌─────────────────────────────────────────┐
│      Data Zone (Internal Only)          │
│  - PostgreSQL (no public port)          │
│  - Redis (no public port)               │
│  - MinIO API (internal only)            │
└─────────────────────────────────────────┘
```

## Monitoring & Observability

```
┌──────────────────────────────────────────┐
│           Application Layer              │
│  - Next.js (structured logs)             │
│  - Worker (job logs)                     │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│         Container Layer                  │
│  - Docker logs                           │
│  - Health checks                         │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│      Infrastructure Layer                │
│  - VPS metrics (CPU, RAM, disk)          │
│  - Network metrics                       │
└──────────────┬───────────────────────────┘
               │
               ▼  (Optional integrations)
┌──────────────────────────────────────────┐
│      Observability Tools                 │
│  - Sentry (errors)                       │
│  - Grafana (metrics)                     │
│  - Loki (logs)                           │
└──────────────────────────────────────────┘
```

## Deployment Pipeline

```
┌──────────────┐
│ Git Push     │
│ (GitHub/Lab) │
└──────┬───────┘
       │ Webhook
       ▼
┌──────────────┐
│   Dokploy    │ 1. Pull code
└──────┬───────┘ 2. Build images
       │         3. Run migrations
       ▼         4. Deploy containers
┌──────────────┐ 5. Health check
│ Docker Build │ 6. Route traffic
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Production  │
│   Running    │
└──────────────┘
```

This architecture provides:
- ✅ High availability with health checks
- ✅ Horizontal scalability ready
- ✅ Security through network isolation
- ✅ Monitoring and observability
- ✅ Automated deployments
- ✅ Disaster recovery via backups

# syntax=docker/dockerfile:1

# Stage 1: Dependencies
FROM node:20-bookworm AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/
COPY packages/shared/package.json ./packages/shared/

# Copy Prisma schema (needed for postinstall)
COPY prisma ./prisma

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-bookworm AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy all dependencies from deps stage (includes workspace packages)
COPY --from=deps /app ./

# Copy source code (will override package.json files with full source)
COPY . .

# Generate Prisma Client
RUN pnpm --filter @repo/database db:generate

# Build workspace packages (shared, types) before building worker
RUN pnpm --filter @repo/shared build
RUN pnpm --filter @repo/types build || true

# Build worker
RUN pnpm --filter worker build

# Stage 3: Runner
FROM node:20-bookworm AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install Playwright dependencies for PDF generation
RUN apt-get update && \
    apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# Copy application
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy templates and fonts for PDF generation
COPY --from=builder /app/apps/web/public/templates ./apps/web/public/templates
COPY --from=builder /app/apps/web/public/fonts ./apps/web/public/fonts

# Install Playwright browsers
RUN npx playwright install chromium --with-deps

# Create user matching web container (nextjs user with UID 1001)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create atlassian-pdfs directory and set ownership
RUN mkdir -p /app/apps/web/public/atlassian-pdfs && \
    chown -R nextjs:nodejs /app/apps/web/public/atlassian-pdfs

WORKDIR /app/apps/worker

USER nextjs

CMD ["node", "dist/index.js"]

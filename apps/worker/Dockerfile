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

# Install dependencies with BuildKit cache mount for faster builds
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-bookworm AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy all dependencies from deps stage (includes workspace packages)
COPY --from=deps /app ./

# Copy source code (will override package.json files with full source)
COPY . .

# Build workspace packages in dependency order
RUN pnpm --filter @repo/database build
RUN pnpm --filter @repo/shared build
RUN pnpm --filter @repo/types build || true
RUN pnpm --filter @repo/ui build || true

# Build worker
RUN pnpm --filter worker build

# Build web (needed for combined deployments using start.sh)
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

# Stage 3: Runner
FROM node:20-bookworm AS runner
WORKDIR /app

ENV NODE_ENV=production

# Enable pnpm (needed for playwright install)
RUN corepack enable && corepack prepare pnpm@9 --activate

# Install Playwright system dependencies for PDF generation
# Using --no-install-recommends to minimize layer size
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
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

# Copy the full application structure (not using standalone to preserve pnpm structure)
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules

# Copy workspace packages
COPY --from=builder /app/packages ./packages

# Copy worker application
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/

# Copy web build (using built files, not standalone)
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/package.json ./apps/web/
COPY --from=builder /app/apps/web/public ./apps/web/public

# Copy Prisma schema (needed for prisma generate at runtime)
COPY --from=builder /app/prisma ./prisma

# Copy pnpm lock (already have workspace.yaml from above)
COPY --from=builder /app/pnpm-lock.yaml ./

# Copy scripts directory (for load-secrets.sh used by start.sh)
COPY --from=builder /app/scripts ./scripts

# Copy start.sh (for combined web+worker deployments)
COPY --from=builder /app/start.sh ./

# Copy templates and fonts for PDF generation
COPY --from=builder /app/apps/web/public/templates ./apps/web/public/templates
COPY --from=builder /app/apps/web/public/fonts ./apps/web/public/fonts

# Install Playwright browsers BEFORE setting up users
# Cache Playwright browsers between builds using BuildKit cache mount
# This is the biggest time saver - downloads ~200MB browser once instead of every build
RUN --mount=type=cache,id=playwright,target=/root/.cache/ms-playwright \
    bash -c 'node node_modules/.pnpm/playwright@*/node_modules/playwright/cli.js install chromium --with-deps'

# Create user matching web container (nextjs user with UID 1001)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create directories and set permissions EFFICIENTLY
# IMPORTANT: Avoid chown -R on large directories like node_modules (1GB+)
# Only change ownership on specific directories that need write access at runtime
RUN mkdir -p /app/apps/web/public/atlassian-pdfs /app/node_modules/.prisma && \
    chmod +x /app/start.sh && \
    chown -R nextjs:nodejs /app/apps/web/public/atlassian-pdfs && \
    chown -R nextjs:nodejs /app/prisma && \
    chown -R nextjs:nodejs /app/node_modules/.prisma

USER nextjs

WORKDIR /app

# Expose port for web server
EXPOSE 3000

# Use start.sh for combined web+worker deployment
CMD ["./start.sh"]

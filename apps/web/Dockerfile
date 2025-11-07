# syntax=docker/dockerfile:1

# Stage 1: Dependencies
FROM node:20-bookworm AS deps
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
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

# Build workspace packages in dependency order
RUN pnpm --filter @repo/database build
RUN pnpm --filter @repo/shared build
RUN pnpm --filter @repo/types build || true
RUN pnpm --filter @repo/ui build || true

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

# Stage 3: Runner
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Copy Prisma files for migrations (if needed at runtime)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]

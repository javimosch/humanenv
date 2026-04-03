# HumanEnv Server Dockerfile
# Multi-stage build for production-ready deployment

# ============================================================
# Stage 1: Dependencies
# ============================================================
FROM node:20-alpine AS deps

RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy workspace configuration
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install all dependencies (including devDeps for TypeScript types)
RUN npm ci --include=dev || npm install

# ============================================================
# Stage 2: Builder
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY --from=deps /app/packages/shared/package.json ./packages/shared/
COPY --from=deps /app/packages/server/package.json ./packages/server/

# Copy source code
COPY tsconfig.json ./
COPY packages/shared/src ./packages/shared/src
COPY packages/server/src ./packages/server/src

# Build is not needed as we use tsx for runtime compilation
# But we validate TypeScript
RUN npm run typecheck --workspace=packages/server || true

# ============================================================
# Stage 3: Production
# ============================================================
FROM node:20-alpine AS production

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache libc6-compat

# Create non-root user for security
RUN addgroup -g 1001 -S humanenv && \
    adduser -S humanenv -u 1001 -G humanenv

WORKDIR /app

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/server ./packages/server

# Copy source code
COPY --from=builder /app/packages/server/src ./packages/server/src
COPY --from=builder /app/packages/shared/src ./packages/shared/src

# Create data directory for SQLite and credentials
RUN mkdir -p /data/humanenv && \
    chown -R humanenv:humanenv /data

# Switch to non-root user
USER humanenv

# Expose port
EXPOSE 3056

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3056/health || exit 1

# Start server
CMD ["node", "--import", "tsx", "packages/server/src/index.ts"]

# ============================================================
# Stage 4: Development (optional, use with --target=development)
# ============================================================
FROM node:20-alpine AS development

RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Create data directory
RUN mkdir -p /root/.humanenv

ENV NODE_ENV=development

EXPOSE 3056

# Enable tsx for hot reload
CMD ["npm", "run", "server"]

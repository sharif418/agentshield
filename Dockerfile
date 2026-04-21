# ---- Stage 1: Dependencies ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy package files
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/tsconfig.json ./packages/core/
COPY packages/core/src ./packages/core/src/
COPY packages/sdk/package.json packages/sdk/tsconfig.json ./packages/sdk/
COPY packages/sdk/src ./packages/sdk/src/
COPY packages/langchain/package.json packages/langchain/tsconfig.json ./packages/langchain/
COPY packages/langchain/src ./packages/langchain/src/
COPY prisma ./prisma/

# Install dependencies
RUN bun install --frozen-lockfile

# Build the core package to JS (needed by the app and other packages)
RUN cd packages/core && bun run build

# Generate Prisma client
RUN bun run db:generate

# ---- Stage 2: Build ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g bun

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the Next.js standalone output
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client again for the builder context
RUN bun run db:generate

# Build the application
RUN bun run build

# ---- Stage 3: Production ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema and database directory
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/db ./db

# Copy Prisma runtime dependencies from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy packages directory for SDK
COPY --from=builder /app/packages ./packages

# Copy mini-services
COPY --from=builder /app/mini-services ./mini-services

# Create db directory if it doesn't exist and set ownership
RUN mkdir -p /app/db && chown nextjs:nodejs /app/db

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

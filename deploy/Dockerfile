# syntax=docker/dockerfile:1.7
# Production image for the app. Build from the repository root:
#   docker build -f deploy/Dockerfile -t larder-app .

ARG NODE_IMAGE=node:22-alpine

# ---- base: pnpm via corepack (version pinned by package.json "packageManager")
FROM ${NODE_IMAGE} AS base
RUN apk add --no-cache libc6-compat openssl && corepack enable
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- deps: install once, cached until the lockfile changes
FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN pnpm install --frozen-lockfile

# ---- builder: Prisma client (musl engine) and the standalone Next.js build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate && pnpm build

# ---- runner: only the standalone server, static assets, and the migration CLI
FROM ${NODE_IMAGE} AS runner
RUN apk add --no-cache openssl tini
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Prisma CLI for `prisma migrate deploy` at start-up. Keep in sync with
# package.json (a unit test checks this).
ARG PRISMA_VERSION=6.19.3
RUN npm install -g prisma@${PRISMA_VERSION} && npm cache clean --force

RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/prisma ./prisma
COPY --chown=app:app deploy/entrypoint.sh ./entrypoint.sh

ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}

USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--", "/app/entrypoint.sh"]

#!/bin/sh
# Applies pending migrations, then starts the Next.js standalone server.
# Never `migrate dev` or `db push` in production (CLAUDE.md).
set -eu

echo "Applying database migrations..."
prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "Starting server on port ${PORT:-3000}..."
exec node server.js

#!/bin/sh
set -e

# Apply pending Prisma migrations before serving traffic (uses DIRECT_DATABASE_URL via prisma.config.ts).
if [ -n "${DIRECT_DATABASE_URL:-}" ] || [ -n "${DATABASE_URL:-}" ]; then
  npx prisma migrate deploy
fi

exec node dist/main.js

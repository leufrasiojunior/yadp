#!/bin/sh

set -eu

MAX_ATTEMPTS="${YAPD_DB_MIGRATION_MAX_ATTEMPTS:-30}"
RETRY_DELAY_SECONDS="${YAPD_DB_MIGRATION_RETRY_DELAY_SECONDS:-2}"
ATTEMPT=1

echo "[yapd-api] Checking pending Prisma migrations before startup..."

while [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; do
  if prisma migrate deploy --config prisma.config.ts; then
    echo "[yapd-api] Prisma migrations are up to date. Starting API..."
    exec node dist/main.js
  fi

  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "[yapd-api] Failed to apply Prisma migrations after ${MAX_ATTEMPTS} attempts." >&2
    exit 1
  fi

  echo "[yapd-api] Migration attempt ${ATTEMPT}/${MAX_ATTEMPTS} failed. Retrying in ${RETRY_DELAY_SECONDS}s..."
  ATTEMPT=$((ATTEMPT + 1))
  sleep "$RETRY_DELAY_SECONDS"
done

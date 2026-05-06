#!/usr/bin/env bash

set -euo pipefail

export PATH="/app/node_modules/.bin:${PATH}"

MAX_ATTEMPTS="${YAPD_DB_MIGRATION_MAX_ATTEMPTS:-30}"
RETRY_DELAY_SECONDS="${YAPD_DB_MIGRATION_RETRY_DELAY_SECONDS:-2}"
API_READY_MAX_ATTEMPTS="${YAPD_API_READY_MAX_ATTEMPTS:-30}"
API_READY_RETRY_DELAY_SECONDS="${YAPD_API_READY_RETRY_DELAY_SECONDS:-1}"
ATTEMPT=1
API_PID=""
WEB_PID=""
PRISMA_BIN="/app/node_modules/.bin/prisma"
API_HEALTH_URL="http://127.0.0.1:${API_PORT:-3001}/api/health"

shutdown() {
  if [[ -n "${API_PID}" ]] && kill -0 "${API_PID}" 2>/dev/null; then
    kill "${API_PID}" 2>/dev/null || true
  fi

  if [[ -n "${WEB_PID}" ]] && kill -0 "${WEB_PID}" 2>/dev/null; then
    kill "${WEB_PID}" 2>/dev/null || true
  fi
}

trap shutdown EXIT INT TERM

echo "[yapd-app] Checking pending Prisma migrations before startup..."

if [[ ! -x "${PRISMA_BIN}" ]]; then
  echo "[yapd-app] Prisma CLI not found at ${PRISMA_BIN}." >&2
  exit 1
fi

pushd /app/apps/api >/dev/null
while [[ "${ATTEMPT}" -le "${MAX_ATTEMPTS}" ]]; do
  if "${PRISMA_BIN}" migrate deploy --config prisma.config.ts; then
    break
  fi

  if [[ "${ATTEMPT}" -ge "${MAX_ATTEMPTS}" ]]; then
    echo "[yapd-app] Failed to apply Prisma migrations after ${MAX_ATTEMPTS} attempts." >&2
    exit 1
  fi

  echo "[yapd-app] Migration attempt ${ATTEMPT}/${MAX_ATTEMPTS} failed. Retrying in ${RETRY_DELAY_SECONDS}s..."
  ATTEMPT=$((ATTEMPT + 1))
  sleep "${RETRY_DELAY_SECONDS}"
done
popd >/dev/null

echo "[yapd-app] Starting API..."
node /app/apps/api/dist/main.js &
API_PID=$!

echo "[yapd-app] Waiting for API health at ${API_HEALTH_URL}..."
ATTEMPT=1
while [[ "${ATTEMPT}" -le "${API_READY_MAX_ATTEMPTS}" ]]; do
  if wget -qO- "${API_HEALTH_URL}" >/dev/null 2>&1; then
    break
  fi

  if ! kill -0 "${API_PID}" 2>/dev/null; then
    wait "${API_PID}"
    exit $?
  fi

  if [[ "${ATTEMPT}" -ge "${API_READY_MAX_ATTEMPTS}" ]]; then
    echo "[yapd-app] API did not become ready after ${API_READY_MAX_ATTEMPTS} attempts." >&2
    exit 1
  fi

  ATTEMPT=$((ATTEMPT + 1))
  sleep "${API_READY_RETRY_DELAY_SECONDS}"
done

echo "[yapd-app] Starting web..."
npm run start --workspace @yapd/web -- --hostname 0.0.0.0 --port 3000 &
WEB_PID=$!

wait -n "${API_PID}" "${WEB_PID}"

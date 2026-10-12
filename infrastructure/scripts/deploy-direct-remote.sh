#!/usr/bin/env bash
set -euo pipefail

release=${1:-}
archive=${2:-}

if [[ ! "$release" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid release" >&2
  exit 64
fi
if [[ ! -f "$archive" ]]; then
  echo "Image archive not found" >&2
  exit 66
fi

cd /srv/cobranzapp
umask 077
timestamp=$(date -u +%Y%m%d%H%M%S)
previous=""
if [[ -f .release.env ]]; then
  previous=$(sed -n 's/^IMAGE_TAG=//p' .release.env | head -n1)
  cp .release.env ".release.env.before-direct-${timestamp}"
fi

docker load < "$archive"
printf 'IMAGE_TAG=%s\n' "$release" > .release.env
chmod 600 .release.env

compose=(docker compose --env-file .env --env-file .release.env -f compose.yaml)

rollback() {
  if [[ -n "$previous" ]]; then
    printf 'Direct deployment failed; rolling back to %s\n' "$previous" >&2
    printf 'IMAGE_TAG=%s\n' "$previous" > .release.env
    "${compose[@]}" up -d --remove-orphans || true
  fi
}
trap rollback ERR

set -a
source .env
set +a

# Strict production order: database -> migrations -> application -> smoke tests.
"${compose[@]}" up -d --wait postgres
"${compose[@]}" run --rm --no-deps \
  -e "MIGRATION_DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
  -e "MIGRATIONS_DIR=/app/database/migrations" \
  -e "WORKER_DATABASE_USER=${WORKER_DATABASE_USER}" \
  -e "WORKER_DATABASE_PASSWORD=${WORKER_DATABASE_PASSWORD}" \
  api node dist/database/migrate.js
"${compose[@]}" up -d --wait --remove-orphans
./smoke-test.sh http://127.0.0.1:13200 http://127.0.0.1:18200

printf '%s\n' "$release" > .deployed-release
chmod 600 .deployed-release
rm -f "$archive"
trap - ERR
printf 'Deployed cobranzapp release %s directly\n' "$release"

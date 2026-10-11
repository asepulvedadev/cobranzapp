#!/usr/bin/env bash
set -euo pipefail

release=${1:-}
actor=${2:-}
if [[ ! "$release" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid release" >&2
  exit 64
fi
if [[ "$actor" != "asepulvedadev" ]]; then
  echo "Actor is not authorized" >&2
  exit 65
fi

token=$(cat)
if [[ -z "$token" ]]; then
  echo "Missing registry token" >&2
  exit 66
fi

cd /srv/cobranzapp
umask 077
docker_config=$(mktemp -d)
trap 'rm -rf "$docker_config"' EXIT
export DOCKER_CONFIG="$docker_config"
printf '%s' "$token" | docker login ghcr.io --username "$actor" --password-stdin >/dev/null
unset token

previous=""
if [[ -f .release.env ]]; then
  previous=$(sed -n 's/^IMAGE_TAG=//p' .release.env | head -n1)
fi
printf 'IMAGE_TAG=%s\n' "$release" > .release.env
chmod 600 .release.env

compose=(docker compose --env-file .env --env-file .release.env -f compose.yaml)

rollback() {
  if [[ -n "$previous" ]]; then
    printf 'Deployment failed; rolling back to %s\n' "$previous" >&2
    printf 'IMAGE_TAG=%s\n' "$previous" > .release.env
    "${compose[@]}" up -d --remove-orphans || true
  fi
}
trap rollback ERR

set -a
# This root-owned file only contains deployment environment assignments.
source .env
set +a

"${compose[@]}" pull
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
docker image prune -f --filter 'until=168h' >/dev/null
trap - ERR
printf 'Deployed cobranzapp release %s\n' "$release"

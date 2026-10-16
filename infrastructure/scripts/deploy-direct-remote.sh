#!/usr/bin/env bash
set -euo pipefail

release=${1:-}
archive=${2:-}
backup_script=${3:-}
backup_service=${4:-}
backup_timer=${5:-}
backup_verify_script=${6:-}
backup_verify_service=${7:-}
backup_verify_timer=${8:-}
compose_file=${9:-}
routes_profile_archive=${10:-}
routes_service=${11:-}

if [[ ! "$release" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid release" >&2
  exit 64
fi
if [[ ! -f "$archive" ]]; then
  echo "Image archive not found" >&2
  exit 66
fi
for file in "$backup_script" "$backup_service" "$backup_timer" \
  "$backup_verify_script" "$backup_verify_service" "$backup_verify_timer"; do
  if [[ ! -f "$file" ]]; then
    echo "Required backup file not found: $file" >&2
    exit 66
  fi
done
if [[ ! -f "$compose_file" ]]; then
  echo "Compose file not found: $compose_file" >&2
  exit 66
fi
if [[ ! -f "$routes_profile_archive" || ! -f "$routes_service" ]]; then
  echo "Hermes routes profile files are missing" >&2
  exit 66
fi

cd /srv/cobranzapp
umask 077
install -m 0700 "$backup_script" /srv/cobranzapp/backup-cobranzapp.sh
install -m 0644 "$backup_service" /etc/systemd/system/cobranzapp-backup.service
install -m 0644 "$backup_timer" /etc/systemd/system/cobranzapp-backup.timer
install -m 0700 "$backup_verify_script" /srv/cobranzapp/verify-cobranzapp-backup.sh
install -m 0644 "$backup_verify_service" /etc/systemd/system/cobranzapp-backup-verify.service
install -m 0644 "$backup_verify_timer" /etc/systemd/system/cobranzapp-backup-verify.timer
install -m 0600 "$compose_file" /srv/cobranzapp/compose.yaml
routes_home=/root/.hermes-cobranzapp/profiles/cobranzapp-routes
install -d -m 0700 "$routes_home"
tar -xzf "$routes_profile_archive" -C "$routes_home"
chmod 0600 "$routes_home/config.yaml" "$routes_home/SOUL.md"
find "$routes_home/skills" -type d -exec chmod 0700 {} +
find "$routes_home/skills" -type f -exec chmod 0600 {} +
touch "$routes_home/.no-bundled-skills"
chmod 0600 "$routes_home/.no-bundled-skills"

openai_key=$(sed -n 's/^OPENAI_API_KEY=//p' /root/.hermes-cobranzapp/profiles/cobranzapp-ocr/.env | head -n1)
if [[ -z "$openai_key" ]]; then
  echo "The existing OCR profile has no OpenAI key" >&2
  exit 78
fi
routes_api_key=$(sed -n 's/^HERMES_ROUTES_API_KEY=//p' /srv/cobranzapp/.env | head -n1)
if [[ -z "$routes_api_key" ]]; then
  routes_api_key=$(openssl rand -hex 32)
  printf '\nHERMES_ROUTES_API_KEY=%s\n' "$routes_api_key" >> /srv/cobranzapp/.env
fi
grep -q '^HERMES_ROUTES_URL=' /srv/cobranzapp/.env || \
  printf 'HERMES_ROUTES_URL=http://host.docker.internal:8651/v1/chat/completions\n' >> /srv/cobranzapp/.env
grep -q '^HERMES_ROUTES_TIMEOUT_MS=' /srv/cobranzapp/.env || \
  printf 'HERMES_ROUTES_TIMEOUT_MS=30000\n' >> /srv/cobranzapp/.env
{
  printf 'OPENAI_API_KEY=%s\n' "$openai_key"
  printf 'API_SERVER_ENABLED=true\nAPI_SERVER_HOST=0.0.0.0\nAPI_SERVER_PORT=8651\n'
  printf 'API_SERVER_MODEL_NAME=cobranzapp-routes\nAPI_SERVER_KEY=%s\n' "$routes_api_key"
} > "$routes_home/.env"
chmod 0600 "$routes_home/.env"
install -m 0644 "$routes_service" /etc/systemd/system/hermes-cobranzapp-routes.service
systemctl daemon-reload
systemctl enable hermes-cobranzapp-routes.service >/dev/null
systemctl restart hermes-cobranzapp-routes.service
for _ in $(seq 1 60); do
  if curl -sS -o /dev/null --connect-timeout 1 http://127.0.0.1:8651/; then
    break
  fi
  sleep 1
done
systemctl is-active --quiet hermes-cobranzapp-routes.service
curl -sS -o /dev/null --connect-timeout 2 http://127.0.0.1:8651/
systemctl enable cobranzapp-backup.timer >/dev/null
systemctl enable cobranzapp-backup-verify.timer >/dev/null
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
if command -v ufw >/dev/null && ufw status | grep -q '^Status: active'; then
  while IFS= read -r subnet; do
    [[ -n "$subnet" ]] || continue
    if ! ufw status | grep -Eq "8651/tcp[[:space:]]+ALLOW IN[[:space:]]+${subnet//./\\.}"; then
      ufw allow from "$subnet" to any port 8651 proto tcp comment 'CobranzApp worker to route agent' >/dev/null
    fi
  done < <(
    docker network ls --filter label=com.docker.compose.project=cobranzapp -q |
      xargs -r docker network inspect --format '{{range .IPAM.Config}}{{println .Subnet}}{{end}}'
  )
fi
"${compose[@]}" run --rm --no-deps \
  -e "MIGRATION_DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
  -e "MIGRATIONS_DIR=/app/database/migrations" \
  -e "WORKER_DATABASE_USER=${WORKER_DATABASE_USER}" \
  -e "WORKER_DATABASE_PASSWORD=${WORKER_DATABASE_PASSWORD}" \
  api node dist/database/migrate.js
# Named volumes are created as root by Docker. Prepare the private document store
# for the non-root API user before the application starts writing profile photos.
"${compose[@]}" run --rm --no-deps --user 0 api sh -lc \
  'mkdir -p /var/lib/cobranzapp/documents && chown -R 10001:10001 /var/lib/cobranzapp/documents && chmod 750 /var/lib/cobranzapp/documents'
"${compose[@]}" up -d --wait --remove-orphans
./smoke-test.sh http://127.0.0.1:13200 http://127.0.0.1:18200
systemctl start cobranzapp-backup.timer
systemctl start cobranzapp-backup-verify.timer

printf '%s\n' "$release" > .deployed-release
chmod 600 .deployed-release
rm -f "$archive"
trap - ERR
printf 'Deployed cobranzapp release %s directly\n' "$release"

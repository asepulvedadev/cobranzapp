#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${COBRANZAPP_DIR:-/srv/cobranzapp}
BACKUP_DIR=${COBRANZAPP_BACKUP_DIR:-${APP_DIR}/backups}
RETENTION_DAYS=${COBRANZAPP_BACKUP_RETENTION_DAYS:-14}

cd "$APP_DIR"
umask 077
mkdir -p "$BACKUP_DIR"

if [[ ! -f .env || ! -f .release.env ]]; then
  echo "CobranzApp production environment is incomplete" >&2
  exit 66
fi

compose=(docker compose --env-file .env --env-file .release.env -f compose.yaml)
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
database_tmp=$(mktemp "${BACKUP_DIR}/.cobranzapp-${timestamp}.XXXXXX.dump")
documents_tmp=$(mktemp "${BACKUP_DIR}/.cobranzapp-${timestamp}.XXXXXX.tar.gz")
cleanup() {
  rm -f "$database_tmp" "$documents_tmp"
}
trap cleanup EXIT

"${compose[@]}" up -d --wait postgres >/dev/null
"${compose[@]}" exec -T postgres sh -lc \
  'pg_dump --format=custom --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  > "$database_tmp"
"${compose[@]}" run --rm --no-deps --user 0 api sh -lc \
  'tar -czf - -C /var/lib/cobranzapp documents' \
  > "$documents_tmp"

database_backup="${BACKUP_DIR}/cobranzapp-${timestamp}.dump"
documents_backup="${BACKUP_DIR}/cobranzapp-${timestamp}-documents.tar.gz"
mv "$database_tmp" "$database_backup"
mv "$documents_tmp" "$documents_backup"
sha256sum "$database_backup" "$documents_backup" > "${BACKUP_DIR}/cobranzapp-${timestamp}.sha256"

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'cobranzapp-*.dump' -o -name 'cobranzapp-*-documents.tar.gz' -o -name 'cobranzapp-*.sha256' \) \
  -mtime "+${RETENTION_DAYS}" -delete

printf 'CobranzApp backup completed: %s\n' "$timestamp"

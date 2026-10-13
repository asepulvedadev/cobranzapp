#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${COBRANZAPP_DIR:-/srv/cobranzapp}
BACKUP_DIR=${COBRANZAPP_BACKUP_DIR:-${APP_DIR}/backups}
POSTGRES_IMAGE=${COBRANZAPP_BACKUP_POSTGRES_IMAGE:-postgres:17.7-alpine3.23@sha256:bb377b7239d2774ac8cc76f481596ce96c5a6b5e9d141f6d0a0ee371a6e7c0f2}

latest_dump=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'cobranzapp-*.dump' -printf '%T@ %p\n' | sort -nr | head -n1 | cut -d' ' -f2-)
latest_documents=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'cobranzapp-*-documents.tar.gz' -printf '%T@ %p\n' | sort -nr | head -n1 | cut -d' ' -f2-)
if [[ -z "$latest_dump" || -z "$latest_documents" ]]; then
  echo "No hay un respaldo completo de CobranzApp para verificar" >&2
  exit 66
fi

checksum_file="${latest_dump%.dump}.sha256"
if [[ ! -f "$checksum_file" ]]; then
  echo "Falta el checksum del respaldo: $checksum_file" >&2
  exit 66
fi
(cd "$BACKUP_DIR" && sha256sum -c "$(basename "$checksum_file")") >/dev/null
tar -tzf "$latest_documents" >/dev/null

container="cobranzapp-backup-verify-$$"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --rm --name "$container" \
  -e POSTGRES_PASSWORD=verify-only \
  "$POSTGRES_IMAGE" >/dev/null
for _ in $(seq 1 30); do
  if docker exec "$container" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker exec "$container" pg_isready -U postgres -d postgres >/dev/null
docker exec -i "$container" pg_restore \
  --exit-on-error --no-owner --no-privileges --username=postgres --dbname=postgres < "$latest_dump"
table_count=$(docker exec "$container" psql -U postgres -d postgres -Atc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
if [[ ! "$table_count" =~ ^[1-9][0-9]*$ ]]; then
  echo "El respaldo restaurado no contiene tablas públicas" >&2
  exit 1
fi

printf 'CobranzApp backup restore verified: %s tables from %s\n' "$table_count" "$(basename "$latest_dump")"

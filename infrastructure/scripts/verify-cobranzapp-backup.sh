#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${COBRANZAPP_DIR:-/srv/cobranzapp}
BACKUP_DIR=${COBRANZAPP_BACKUP_DIR:-${APP_DIR}/backups}
POSTGRES_IMAGE=${COBRANZAPP_BACKUP_POSTGRES_IMAGE:-postgres:17.7-alpine3.23@sha256:bb377b7239d2774ac8cc76f481596ce96c5a6b5e9d141f6d0a0ee371a6e7c0f2}

# Policies in the dump reference the least-privilege application roles. The
# isolated verifier has no application migrations, so create matching empty
# roles before restoring the schema. Names come from the production env when
# available and are validated before being used as SQL identifiers.
if [[ -f "${APP_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${APP_DIR}/.env"
  set +a
fi
APP_DATABASE_USER=${APP_DATABASE_USER:-cobranzapp_app}
WORKER_DATABASE_USER=${WORKER_DATABASE_USER:-cobranzapp_worker}
for role in "$APP_DATABASE_USER" "$WORKER_DATABASE_USER"; do
  if [[ ! "$role" =~ ^[a-z_][a-z0-9_]{0,62}$ ]]; then
    echo "Nombre de rol PostgreSQL inválido para verificación: $role" >&2
    exit 64
  fi
done
if [[ "$APP_DATABASE_USER" == "$WORKER_DATABASE_USER" ]]; then
  echo "Los roles PostgreSQL de API y worker deben ser distintos" >&2
  exit 64
fi

latest_dump=
latest_documents=
checksum_file=
while IFS= read -r candidate; do
  candidate_name=$(basename "$candidate")
  if [[ ! "$candidate_name" =~ ^cobranzapp-([0-9]{8}T[0-9]{6}Z)\.dump$ ]]; then
    continue
  fi
  candidate_timestamp=${BASH_REMATCH[1]}
  candidate_documents="${BACKUP_DIR}/cobranzapp-${candidate_timestamp}-documents.tar.gz"
  candidate_checksum="${BACKUP_DIR}/cobranzapp-${candidate_timestamp}.sha256"
  if [[ -f "$candidate_documents" && -f "$candidate_checksum" ]]; then
    latest_dump=$candidate
    latest_documents=$candidate_documents
    checksum_file=$candidate_checksum
    break
  fi
done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'cobranzapp-*.dump' -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)

if [[ -z "$latest_dump" || -z "$latest_documents" || -z "$checksum_file" ]]; then
  echo "No hay un respaldo completo de CobranzApp para verificar" >&2
  exit 66
fi

verify_checksum() {
  local file=$1
  local filename expected actual
  filename=$(basename "$file")
  expected=$(awk -v target="$filename" '
    {
      path = $2
      sub(/^\*/, "", path)
      sub(/^.*\//, "", path)
      if (path == target) {
        print $1
        exit
      }
    }
  ' "$checksum_file")
  if [[ ! "$expected" =~ ^[a-fA-F0-9]{64}$ ]]; then
    echo "Falta el checksum de ${filename} en $(basename "$checksum_file")" >&2
    exit 66
  fi
  actual=$(sha256sum "$file" | cut -d' ' -f1)
  if [[ "$actual" != "$expected" ]]; then
    echo "El checksum de ${filename} no coincide" >&2
    exit 1
  fi
}

verify_checksum "$latest_dump"
verify_checksum "$latest_documents"
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
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "CREATE ROLE \"${APP_DATABASE_USER}\"; CREATE ROLE \"${WORKER_DATABASE_USER}\";" >/dev/null
docker exec -i "$container" pg_restore \
  --exit-on-error --no-owner --no-privileges --username=postgres --dbname=postgres < "$latest_dump"
table_count=$(docker exec "$container" psql -U postgres -d postgres -Atc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
if [[ ! "$table_count" =~ ^[1-9][0-9]*$ ]]; then
  echo "El respaldo restaurado no contiene tablas públicas" >&2
  exit 1
fi

printf 'CobranzApp backup restore verified: %s tables from %s\n' "$table_count" "$(basename "$latest_dump")"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$ROOT_DIR"

host=${COBRANZAPP_VPS_HOST:-2.24.115.58}
user=${COBRANZAPP_VPS_USER:-root}
password_file=${COBRANZAPP_VPS_PASSWORD_FILE:-$HOME/.autoking-vps-password}
release=$(git rev-parse HEAD)

if [[ -n "$(git status --short)" ]]; then
  echo "Working tree must be clean before a direct deployment" >&2
  exit 65
fi
if [[ ! -r "$password_file" ]]; then
  echo "Missing VPS password file: $password_file" >&2
  exit 66
fi
command -v docker >/dev/null || { echo "Docker is required" >&2; exit 69; }
command -v sshpass >/dev/null || { echo "sshpass is required" >&2; exit 69; }

echo "Running quality gate before deploying ${release}"
pnpm check

export SSHPASS
SSHPASS=$(cat "$password_file")
ssh_opts=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)
remote_tmp="/tmp/cobranzapp-direct-${release}"
archive="${remote_tmp}.tar.gz"
local_archive=$(mktemp "${TMPDIR:-/tmp}/cobranzapp-direct.XXXXXX.tar.gz")
routes_profile_archive=$(mktemp "${TMPDIR:-/tmp}/cobranzapp-routes.XXXXXX.tar.gz")
cleanup() {
  rm -f "$local_archive" "$routes_profile_archive"
}
trap cleanup EXIT

services=(api worker web)
declare -A dockerfiles=(
  [api]=infrastructure/docker/Dockerfile.api
  [worker]=infrastructure/docker/Dockerfile.worker
  [web]=infrastructure/docker/Dockerfile.web
)
images=()

for service in "${services[@]}"; do
  image="ghcr.io/asepulvedadev/cobranzapp-${service}:${release}"
  images+=("$image")
  echo "Building ${service}"
  docker buildx build \
    --platform linux/amd64 \
    --file "${dockerfiles[$service]}" \
    --tag "$image" \
    --load \
    .
done

echo "Transferring immutable images to ${user}@${host}"
docker save "${images[@]}" | gzip -1 > "$local_archive"
tar -czf "$routes_profile_archive" -C infrastructure/hermes-routes .
sshpass -e scp "${ssh_opts[@]}" "$local_archive" "${user}@${host}:${archive}"
sshpass -e scp "${ssh_opts[@]}" \
  infrastructure/scripts/deploy-direct-remote.sh \
  "${user}@${host}:${remote_tmp}.sh"
sshpass -e scp "${ssh_opts[@]}" \
  infrastructure/scripts/backup-cobranzapp.sh \
  "${user}@${host}:${remote_tmp}.backup.sh"
sshpass -e scp "${ssh_opts[@]}" \
  infrastructure/systemd/cobranzapp-backup.service \
  "${user}@${host}:${remote_tmp}.backup.service"
sshpass -e scp "${ssh_opts[@]}" \
  infrastructure/systemd/cobranzapp-backup.timer \
  "${user}@${host}:${remote_tmp}.backup.timer"
sshpass -e scp "${ssh_opts[@]}" \
  infrastructure/scripts/verify-cobranzapp-backup.sh \
  "${user}@${host}:${remote_tmp}.backup-verify.sh"
sshpass -e scp "${ssh_opts[@]}" \
  infrastructure/systemd/cobranzapp-backup-verify.service \
  "${user}@${host}:${remote_tmp}.backup-verify.service"
sshpass -e scp "${ssh_opts[@]}" \
  infrastructure/systemd/cobranzapp-backup-verify.timer \
  "${user}@${host}:${remote_tmp}.backup-verify.timer"
sshpass -e scp "${ssh_opts[@]}" \
  infrastructure/compose.production.yaml \
  "${user}@${host}:${remote_tmp}.compose.yaml"
sshpass -e scp "${ssh_opts[@]}" \
  "$routes_profile_archive" \
  "${user}@${host}:${remote_tmp}.routes-profile.tar.gz"
sshpass -e scp "${ssh_opts[@]}" \
  infrastructure/systemd/hermes-cobranzapp-routes.service \
  "${user}@${host}:${remote_tmp}.routes.service"

sshpass -e ssh "${ssh_opts[@]}" "${user}@${host}" \
  "chmod 700 '${remote_tmp}.sh' '${remote_tmp}.backup.sh' '${remote_tmp}.backup-verify.sh' && '${remote_tmp}.sh' '${release}' '${archive}' '${remote_tmp}.backup.sh' '${remote_tmp}.backup.service' '${remote_tmp}.backup.timer' '${remote_tmp}.backup-verify.sh' '${remote_tmp}.backup-verify.service' '${remote_tmp}.backup-verify.timer' '${remote_tmp}.compose.yaml' '${remote_tmp}.routes-profile.tar.gz' '${remote_tmp}.routes.service' && rm -f '${remote_tmp}.sh' '${remote_tmp}.backup.sh' '${remote_tmp}.backup.service' '${remote_tmp}.backup.timer' '${remote_tmp}.backup-verify.sh' '${remote_tmp}.backup-verify.service' '${remote_tmp}.backup-verify.timer' '${remote_tmp}.compose.yaml' '${remote_tmp}.routes-profile.tar.gz' '${remote_tmp}.routes.service'"

echo "Direct deployment completed: ${release}"

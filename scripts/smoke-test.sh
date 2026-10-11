#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-http://127.0.0.1:13200}"
api_url="${2:-http://127.0.0.1:18200}"

curl --fail --silent --show-error --max-time 15 "${base_url}/health" >/dev/null
curl --fail --silent --show-error --max-time 15 "${api_url}/health" >/dev/null
curl --fail --silent --show-error --max-time 15 "${api_url}/ready" >/dev/null
curl --fail --silent --show-error --max-time 15 "${api_url}/v1/status" >/dev/null
printf 'cobranzapp smoke tests passed: %s %s\n' "$base_url" "$api_url"

#!/usr/bin/env bash
# Poll a URL until it returns HTTP 200, or fail after a timeout.
# Usage: wait-health.sh <url> [timeout_seconds]
set -euo pipefail

URL="${1:?usage: wait-health.sh <url> [timeout_seconds]}"
TIMEOUT="${2:-90}"
elapsed=0

echo "Waiting for ${URL} (timeout ${TIMEOUT}s)…"
until curl -sf -o /dev/null "${URL}"; do
  if [ "${elapsed}" -ge "${TIMEOUT}" ]; then
    echo "ERROR: ${URL} not healthy after ${TIMEOUT}s" >&2
    exit 1
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done
echo "OK: ${URL} is healthy."

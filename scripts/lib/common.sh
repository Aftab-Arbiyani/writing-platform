# shellcheck shell=bash
# ══════════════════════════════════════════════════════════════════════════
# scripts/lib/common.sh — shared helpers for Qalam ops scripts (P7.1)
#
# This file is SOURCED, never executed. Source it from every script:
#
#     SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#     # shellcheck source=../lib/common.sh
#     . "${SCRIPT_DIR}/../lib/common.sh"
#
# Provides:
#   log / warn / err / die   timestamped structured logging (all to stderr)
#   require_cmd              hard-fail if a command is missing
#   confirm                  interactive y/N guard (skipped when ASSUME_YES=1)
#   load_env                 source an env file if present (exported)
#   mask / redact_dsn        redact secrets before logging — NEVER log raw creds
#   retry                    retry a command N times with a fixed delay
#   http_code / http_body    curl helpers (status code / body, connection-safe)
#   json_field               read a top-level JSON string field (jq or sed)
#   dc                       docker compose wrapper (auto-detects v1/v2 + files)
#   record_deploy            append an audit line to the deploy history
#   git_sha / utc_stamp      small utilities
#
# Config (env — all optional, sane defaults):
#   ASSUME_YES=1        skip interactive confirm() prompts (CI / automation)
#   COMPOSE_FILE        prod compose file      (default: <repo>/docker-compose.prod.yml)
#   ENV_FILE            env file for compose   (default: <repo>/.env.production)
#   DOCKER_COMPOSE_BIN  force compose binary   ("docker compose" | "docker-compose")
#   DEPLOY_LOG          deploy audit log path  (default: <repo>/.deploy-history)
#   DEPLOY_OPERATOR     operator name recorded in audit lines (default: $USER)
#
# GOLDEN RULE: never echo a secret value. DSNs, tokens and keys go through
# mask()/redact_dsn() before they touch a log line.
# ══════════════════════════════════════════════════════════════════════════

# Idempotent source guard — safe to `.` this file more than once.
if [ -n "${__QALAM_COMMON_SH:-}" ]; then
  return 0 2>/dev/null || true
fi
__QALAM_COMMON_SH=1

COMMON_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# scripts/lib -> scripts -> repo root
REPO_ROOT="$(cd "${COMMON_LIB_DIR}/../.." && pwd)"
export REPO_ROOT

COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env.production}"
DEPLOY_LOG="${DEPLOY_LOG:-${REPO_ROOT}/.deploy-history}"

# ── Timestamps ───────────────────────────────────────────────────────────
_ts()       { date -u +'%Y-%m-%dT%H:%M:%SZ'; }
utc_stamp() { date -u +'%Y%m%dT%H%M%SZ'; }

# ── Logging (all to stderr so stdout stays clean for captured values) ──────
log()  { printf '%s [INFO ] %s\n' "$(_ts)" "$*" >&2; }
warn() { printf '%s [WARN ] %s\n' "$(_ts)" "$*" >&2; }
err()  { printf '%s [ERROR] %s\n' "$(_ts)" "$*" >&2; }
die()  { err "$*"; exit 1; }

# ── Preconditions ──────────────────────────────────────────────────────────
# require_cmd cmd [cmd...] — die listing every missing command.
require_cmd() {
  local c missing=0
  for c in "$@"; do
    if ! command -v "$c" >/dev/null 2>&1; then
      err "required command not found on PATH: ${c}"
      missing=1
    fi
  done
  [ "${missing}" -eq 0 ] || die "missing required command(s) — install them and retry"
}

# has_cmd cmd — true if present (for optional/guarded features).
has_cmd() { command -v "$1" >/dev/null 2>&1; }

# ── Interactive confirmation (destructive-op guard) ─────────────────────────
# confirm "prompt"  → returns 0 on yes, 1 on no. Auto-yes when ASSUME_YES=1.
confirm() {
  local prompt="${1:-Proceed?}" reply=""
  if [ "${ASSUME_YES:-0}" = "1" ]; then
    log "ASSUME_YES=1 — auto-confirming: ${prompt}"
    return 0
  fi
  if [ -t 0 ]; then
    printf '%s [y/N] ' "${prompt}" >&2
    read -r reply
  elif [ -e /dev/tty ]; then
    printf '%s [y/N] ' "${prompt}" >&2
    read -r reply </dev/tty
  else
    die "confirmation required (\"${prompt}\") but no TTY is attached — set ASSUME_YES=1 to run non-interactively"
  fi
  case "${reply}" in
    [yY] | [yY][eE][sS]) return 0 ;;
    *) return 1 ;;
  esac
}

# ── Env loading ─────────────────────────────────────────────────────────────
# load_env /path/to/file — source & export every var it defines (if present).
load_env() {
  local f="${1:?load_env: file path required}"
  if [ -f "${f}" ]; then
    log "loading env file: ${f}"
    set -a
    # shellcheck disable=SC1090  # path is caller-supplied and dynamic
    . "${f}"
    set +a
  else
    warn "env file not found (skipping): ${f}"
  fi
}

# ── Secret redaction (logging-safe) ─────────────────────────────────────────
# mask <value> — show only the first/last 2 chars; short values become ***.
mask() {
  local v="${1:-}" n
  n=${#v}
  if [ "${n}" -eq 0 ]; then printf '<empty>'; return 0; fi
  if [ "${n}" -le 8 ]; then printf '***'; return 0; fi
  printf '%s***%s' "${v:0:2}" "${v: -2}"
}

# redact_dsn <url> — replace the password segment of a connection URI with ***.
# postgresql://user:secret@host:5432/db  ->  postgresql://user:***@host:5432/db
redact_dsn() {
  local dsn="${1:-}"
  printf '%s' "${dsn}" | sed -E 's#(://[^:/@]+:)[^@/]+@#\1***@#'
}

# ── Retry ────────────────────────────────────────────────────────────────────
# retry <max_attempts> <delay_seconds> -- <command...>
retry() {
  local max="${1:?}" delay="${2:?}"
  shift 2
  [ "${1:-}" = "--" ] && shift
  local attempt=1
  while true; do
    if "$@"; then return 0; fi
    if [ "${attempt}" -ge "${max}" ]; then
      return 1
    fi
    warn "attempt ${attempt}/${max} failed; retrying in ${delay}s — $*"
    sleep "${delay}"
    attempt=$((attempt + 1))
  done
}

# ── HTTP helpers ─────────────────────────────────────────────────────────────
# http_code <url> [timeout_s]  → prints HTTP status (000 on connection failure).
http_code() {
  local url="${1:?}" timeout="${2:-5}"
  curl -sS -o /dev/null -w '%{http_code}' --max-time "${timeout}" "${url}" 2>/dev/null || printf '000'
}

# http_body <url> [timeout_s]  → prints response body ("" on failure).
http_body() {
  local url="${1:?}" timeout="${2:-5}"
  curl -sS --max-time "${timeout}" "${url}" 2>/dev/null || true
}

# json_field <field> <json>  → prints the value of a top-level string field.
# Uses jq when available, otherwise a best-effort sed extractor.
json_field() {
  local field="${1:?}" json="${2:-}"
  if has_cmd jq; then
    printf '%s' "${json}" | jq -r --arg f "${field}" '.[$f] // empty' 2>/dev/null
  else
    printf '%s' "${json}" | sed -n "s/.*\"${field}\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n1
  fi
}

# ── docker compose wrapper (v1 / v2 auto-detect + standard flags) ────────────
_compose_bin() {
  if [ -n "${DOCKER_COMPOSE_BIN:-}" ]; then printf '%s' "${DOCKER_COMPOSE_BIN}"; return 0; fi
  if docker compose version >/dev/null 2>&1; then printf 'docker compose'; return 0; fi
  if command -v docker-compose >/dev/null 2>&1; then printf 'docker-compose'; return 0; fi
  die "neither the 'docker compose' plugin nor 'docker-compose' is available"
}

# dc <compose args...> — runs compose against COMPOSE_FILE (+ ENV_FILE if present).
dc() {
  local bin
  bin="$(_compose_bin)"
  if [ -f "${ENV_FILE}" ]; then
    # shellcheck disable=SC2086  # bin may legitimately be two words ("docker compose")
    ${bin} -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" "$@"
  else
    # shellcheck disable=SC2086
    ${bin} -f "${COMPOSE_FILE}" "$@"
  fi
}

# ── Deploy audit trail ───────────────────────────────────────────────────────
git_sha() { git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || printf 'unknown'; }

# record_deploy <event> <image> <version> <git_sha> <result>
# Appends a TSV line: ts, event, result, image, version, sha, operator, host.
record_deploy() {
  local event="${1:?}" image="${2:-}" version="${3:-}" sha="${4:-}" result="${5:?}"
  local operator host
  operator="${DEPLOY_OPERATOR:-${SUDO_USER:-${USER:-unknown}}}"
  host="$(hostname 2>/dev/null || printf 'unknown')"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$(_ts)" "${event}" "${result}" "${image}" "${version}" "${sha}" "${operator}" "${host}" \
    >>"${DEPLOY_LOG}"
  log "audit: ${event}/${result} image=${image} version=${version} sha=${sha} -> ${DEPLOY_LOG}"
}

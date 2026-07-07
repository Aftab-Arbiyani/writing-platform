#!/usr/bin/env bash
#
# lint-changed.sh — run ESLint on the file Claude just edited, using the correct
# per-package flat config. Fired as a PostToolUse hook on Edit|Write.
#
# ESLint's flat config resolves from the CWD (not the file's directory), so we cd
# into the owning workspace before linting. Advisory: prints findings, exits 0.
set -uo pipefail

INPUT="${CLAUDE_TOOL_INPUT:-$(cat 2>/dev/null || true)}"
FILE=$(printf '%s' "$INPUT" | jq -r '.file_path // .tool_input.file_path // empty' 2>/dev/null || true)

[ -z "${FILE:-}" ] && exit 0
[ -f "$FILE" ] || exit 0
case "$FILE" in *.ts|*.tsx) : ;; *) exit 0 ;; esac

REPO="${CLAUDE_PROJECT_DIR:-$(git -C "$(dirname "$FILE")" rev-parse --show-toplevel 2>/dev/null || echo .)}"

# Pick the workspace that owns the file so its eslint.config.mjs is used.
case "$FILE" in
  */backend/*)       DIR="$REPO/backend" ;;
  */frontend/*)      DIR="$REPO/frontend" ;;
  */admin/*)         DIR="$REPO/admin" ;;
  */packages/*)      DIR=$(printf '%s' "$FILE" | sed -E 's#(.*/packages/[^/]+)/.*#\1#') ;;
  *)                 DIR="$REPO" ;;
esac
[ -d "$DIR" ] || DIR="$REPO"

OUT=$(cd "$DIR" && npx --no-install eslint "$FILE" 2>&1) || true
CLEAN=$(printf '%s\n' "$OUT" | grep -vE '^[[:space:]]*$' | tail -n 15)

if [ -n "$CLEAN" ]; then
  printf '🔎 [qalam-eslint] %s\n' "$(basename "$FILE")"
  printf '%s\n' "$CLEAN" | sed 's/^/       /'
fi
exit 0

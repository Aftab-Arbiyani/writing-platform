#!/usr/bin/env bash
#
# remind-tests.sh — Stop hook. When a session touched backend service/controller
# files, list the affected modules and their test command, then ask before
# writing specs. Advisory only (exits 0 — never blocks stopping).
#
# Convention (CLAUDE.md): services, guards, and utils must be tested (80% target).
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

CHANGED=$( { git diff --name-only; git diff --name-only --cached; } 2>/dev/null )
MODS=$(printf '%s\n' "$CHANGED" \
  | grep -E 'backend/src/modules/[^/]+/[^/]+\.(service|controller)\.ts$' \
  | sed -E 's#.*/modules/([^/]+)/.*#\1#' | sort -u)

[ -z "$MODS" ] && exit 0

printf '\n🧪 [qalam] Backend modules changed this session — tests may need updating:\n'
for M in $MODS; do
  printf '     pnpm --filter backend test -- --testPathPattern=%s\n' "$M"
done
printf '\nASK THE USER before writing any .spec.ts files. If they say yes, use /jest-test-generator.\n'
exit 0

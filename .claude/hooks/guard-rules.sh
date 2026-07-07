#!/usr/bin/env bash
#
# guard-rules.sh — advisory enforcement of the Qalam CLAUDE.md "Hard rules".
#
# Fired as a PostToolUse hook on Edit|Write. It NEVER blocks (always exits 0):
# it prints '⚠️  [qalam-rules] …' lines that Claude sees in the transcript, so the
# model self-corrects. Blocking heuristic regex checks would produce false
# positives; the real gate is code review + `pnpm lint`/`typecheck` in CI.
#
# Rule numbers below refer to the "Hard rules" list in CLAUDE.md.
set -uo pipefail

# Hook payload arrives either in $CLAUDE_TOOL_INPUT (the tool_input object) or on
# stdin (full hook JSON). Handle both shapes.
INPUT="${CLAUDE_TOOL_INPUT:-$(cat 2>/dev/null || true)}"
FILE=$(printf '%s' "$INPUT" | jq -r '.file_path // .tool_input.file_path // empty' 2>/dev/null || true)

[ -z "${FILE:-}" ] && exit 0
[ -f "$FILE" ] || exit 0

warn() { printf '⚠️  [qalam-rules] %s\n' "$1"; }
show() { grep -nE "$1" "$FILE" | head -5 | sed 's/^/       /'; }

base=$(basename "$FILE")

is_test=false
case "$base" in
  *.spec.ts|*.spec.tsx|*.test.ts|*.test.tsx|*.e2e-spec.ts) is_test=true ;;
esac

# ── Rule 7: migrations are immutable once merged ────────────────────────────
case "$FILE" in
  */backend/src/database/migrations/*)
    warn "Migration files are immutable once merged (rule 7). Do NOT edit — create a NEW migration:"
    printf '       pnpm --filter backend migration:generate src/database/migrations/<Name>\n'
    ;;
esac

# ── Rule 7: entity changed → generate a migration (synchronize:false forever) ─
if printf '%s' "$FILE" | grep -qE 'backend/src/modules/.+/entities/.+\.entity\.ts$'; then
  warn "Entity changed — generate a migration (never synchronize):"
  printf '       pnpm --filter backend migration:generate src/database/migrations/<Name>\n'
fi

# ── Rule 1: no `any` (use `unknown` + narrowing) ─────────────────────────────
# Skips tests, generated wire types (api-types), and declaration files.
skip_any=false
$is_test && skip_any=true
case "$FILE" in
  *.d.ts|*/packages/api-types/*) skip_any=true ;;
esac
case "$FILE" in
  *.ts|*.tsx)
    if ! $skip_any; then
      any_re='(:[[:space:]]*any\b|\bas[[:space:]]+any\b|<any>|Array<any>|Promise<any>|Record<[^,>]+,[[:space:]]*any>)'
      if grep -qE "$any_re" "$FILE"; then
        warn "\`any\` detected (rule 1) — use \`unknown\` + narrowing:"
        show "$any_re"
      fi
    fi
    ;;
esac

# ── Frontend / admin surface rules ───────────────────────────────────────────
case "$FILE" in
  */frontend/*|*/admin/*|*/packages/ui/*)
    case "$FILE" in
      *.tsx|*.ts|*.css)
        # Rule 2: RTL — physical direction utilities/properties are banned.
        rtl_re='\b(ml|mr|pl|pr)-[0-9a-z]|\b(left|right)-[0-9]|\btext-(left|right)\b|(margin|padding|border|inset)-(left|right)'
        if grep -qE "$rtl_re" "$FILE"; then
          warn "Physical direction found (rule 2 — RTL is day one). Use logical: ms-/me-/ps-/pe-/start-/end-, margin-inline-*, inset-inline-*:"
          show "$rtl_re"
        fi
        ;;
    esac
    # Rule 3: tokens only — no raw hex in components (skip token/theme sources).
    case "$FILE" in
      *.tsx)
        case "$FILE" in
          */packages/ui/*|*token*|*theme*) : ;;  # legitimate hex homes
          *)
            if grep -qE '#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?\b' "$FILE"; then
              warn "Raw hex color in a component (rule 3) — use --q-* tokens (Tailwind theme / AntD theme):"
              show '#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?\b'
            fi
            ;;
        esac
        ;;
    esac
    # Rule 5: all HTTP goes through the centralized api-client, never raw fetch.
    case "$FILE" in
      */lib/*) : ;;  # api-client lives here
      *.ts|*.tsx)
        if grep -qE '\bfetch\(' "$FILE"; then
          warn "Raw \`fetch(\` in a component/feature (rule 5) — route all HTTP through src/lib/api-client.ts."
          show '\bfetch\('
        fi
        ;;
    esac
    ;;
esac

# ── Rule 6: no cross-module repository imports (modules talk via services/events)
case "$FILE" in
  */backend/src/modules/*)
    mod=$(printf '%s' "$FILE" | sed -E 's#.*/backend/src/modules/([^/]+)/.*#\1#')
    if grep -nE "from[[:space:]]+['\"][^'\"]*modules/[^/'\"]+/" "$FILE" \
        | grep -vE "modules/${mod}/" \
        | grep -qiE '\.repository|repository[\"'\'']'; then
      warn "Cross-module repository import (rule 6). Modules talk only via exported services or events/queues:"
      grep -nE "from[[:space:]]+['\"][^'\"]*modules/[^/'\"]+/" "$FILE" \
        | grep -vE "modules/${mod}/" | grep -iE 'repository' | head -5 | sed 's/^/       /'
    fi
    ;;
esac

exit 0

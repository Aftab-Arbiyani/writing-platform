#!/usr/bin/env bash
#
# guard-rules.sh — advisory enforcement of the Qalam CLAUDE.md "Hard rules".
#
# Fired as a PostToolUse hook on Edit|Write. It is ADVISORY (exit 0) for every
# rule — it prints '⚠️  [qalam-rules] …' lines Claude sees, so the model
# self-corrects — with ONE exception: a migration file with an INVENTED
# timestamp is a HARD BLOCK (exit 2). That signal is precise, not heuristic: a
# real timestamp is Date.now() (13 digits); a round/trailing-zeros prefix means
# someone typed it by hand, which risks mis-ordering migrations.
#
# Rule numbers below refer to the "Hard rules" list in CLAUDE.md.
#
# Migration workflow in THIS repo: `migration:generate` is UNUSABLE here — the
# entities use plain FK columns with no relations (docs 16 §3.1), so generate
# tries to drop every foreign key. Instead scaffold with the CLI
# `pnpm --filter backend migration:create src/database/migrations/<Name>` (which
# stamps a real Date.now() prefix) and author the DDL in the skeleton. The block
# below targets INVENTED timestamps, not authored DDL on a CLI-stamped file.
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

# ── Rule 7: migrations are CLI-GENERATED, never hand-authored (HARD BLOCK) ────
case "$FILE" in
  */backend/src/database/migrations/*.ts)
    ts=$(printf '%s' "$base" | grep -oE '^[0-9]+')
    # A genuine `migration:generate` prefix is Date.now() (13 digits, not round).
    # A trailing run of zeros (or a non-13-digit prefix) means the timestamp was
    # invented — i.e. the migration was hand-authored instead of generated.
    if printf '%s' "$ts" | grep -qE '0{5,}$' || [ "${#ts}" -ne 13 ]; then
      {
        printf '\xe2\x9b\x94  [qalam-rules] BLOCKED (rule 7 / docs 04 §1.6): migration "%s" has an invented timestamp.\n' "$base"
        printf '   "%s" is hand-picked — a real prefix is Date.now() (13 digits, not round).\n' "$ts"
        printf '   NEVER hand-pick a timestamp. Delete this file and scaffold via the CLI (real Date.now()):\n'
        printf '     pnpm --filter backend migration:create src/database/migrations/<Name>\n'
        printf '   then author the DDL in the skeleton. (migration:generate is unusable here — plain FK\n'
        printf '   columns/no relations mean it would drop every foreign key, docs 16 §3.1.)\n'
      } >&2
      exit 2
    fi
    # Real (CLI-stamped) timestamp: authoring DDL in it is fine; just never EDIT a
    # MERGED migration — scaffold a new one instead (advisory).
    warn "Real timestamp OK. Never EDIT a merged migration — scaffold a NEW one via the CLI (real Date.now()):"
    printf '       pnpm --filter backend migration:create src/database/migrations/<Name>\n'
    ;;
esac

# ── Rule 7: entity changed → author a migration (synchronize:false forever) ───
if printf '%s' "$FILE" | grep -qE 'backend/src/modules/.+/entities/.+\.entity\.ts$'; then
  warn "Entity changed — a migration is needed (never synchronize). Scaffold via the CLI, then author the DDL:"
  printf '       pnpm --filter backend migration:create src/database/migrations/<Name>\n'
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

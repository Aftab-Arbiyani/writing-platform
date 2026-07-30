# `.claude/` — Qalam project rules for Claude Code

This folder turns the **Hard rules** in the root `CLAUDE.md` into automation that
runs while Claude Code works in this repo. It is committed and shared by the whole
team (`settings.local.json` is per-developer and git-ignored).

> These are _guardrails_, not the source of truth. The canonical rules live in
> `CLAUDE.md` and `docs/00_ArchitectureDecisions.md`. The real gate is code review
>
> - `pnpm lint` / `pnpm typecheck` / CI.

## Layout

```
.claude/
├── settings.json          # permission allowlist + hook wiring (committed)
├── .gitignore             # ignores settings.local.json
├── README.md              # this file
└── hooks/
    ├── guard-rules.sh      # advisory checks for the automatable hard rules
    ├── lint-changed.sh     # ESLint the edited file with its workspace config
    └── remind-tests.sh     # Stop hook: nudge tests for changed backend modules
```

## Hooks — what fires, and which rule it backs

All hooks are **advisory**: they print to the transcript and always exit `0`. They
never block an edit or stop, because regex heuristics produce false positives.

| Hook              | Event                     | Backs (CLAUDE.md rule)                                                                                                                                                                     |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `guard-rules.sh`  | PostToolUse `Edit\|Write` | 1 no `any` · 2 RTL / no physical CSS · 3 tokens-only (no raw hex) · 5 no `fetch` in components · 6 no cross-module repository imports · 7 migrations immutable + entity→migration reminder |
| `lint-changed.sh` | PostToolUse `Edit\|Write` | 1 & 16 — runs the correct per-workspace ESLint (`backend/`, `frontend/`, `admin/`, `packages/*`) on the file just touched                                                                  |
| `remind-tests.sh` | Stop                      | Testing convention — lists changed backend modules + their `pnpm --filter backend test` command and asks before writing specs                                                              |

Rules that can't be reliably caught by a hook (e.g. server state in Zustand vs
TanStack Query, permanent-username invariant, clap cap, "one language per piece")
remain **review-time** checks — see `CLAUDE.md` and the domain docs.

These are tuned to _this_ repo: `pnpm` (not `npm`), migrations at
`backend/src/database/migrations/`, and the pnpm monorepo ESLint layout. The global
`~/.claude` hooks are more generic and may also fire — that's harmless, just noisier.

## Permissions

`settings.json` auto-allows only **safe, read-only or quality** commands: read-only
git (`status`/`diff`/`log`/`show`/`branch`), and workspace tasks
(`lint`/`typecheck`/`test`/`build`/`format`, incl. `--filter`), plus `eslint`/`tsc`
and read-only `docker compose`.

**Intentionally NOT auto-allowed** (they will always prompt for confirmation):

- `git commit` / `git push` — no unattended commits or pushes.
- `pnpm --filter backend migration:run` / `migration:revert` — no migrations run
  against a database from here.
- Anything destructive (`rm`, `git reset --hard`, `docker compose down -v`, …).

To grant yourself extra permissions locally without touching the shared file,
create `.claude/settings.local.json` (git-ignored) — e.g.:

```json
{ "permissions": { "allow": ["Bash(docker compose up:*)"] } }
```

## Extending

- New rule worth automating → add a check to `hooks/guard-rules.sh` (keep it
  advisory: `warn "…"` + `exit 0`).
- Reuse the global specialist skills/agents/commands (`~/.claude`) as-is; only add a
  project-level override here if this repo needs to diverge from that generic base.

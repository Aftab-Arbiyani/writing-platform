# 17 — Git Workflow

> **Status:** Binding. Derives from `00_ArchitectureDecisions.md` §2 (husky + lint-staged
>
> - commitlint, conventional commits) and §9 (CI, deploy on tag). The workflow is
>   deliberately boring: trunk-based, squash-merged, linear. Every rule below is enforced
>   by tooling or CI — a workflow that depends on memory decays in a month.

---

## 1. Model — Trunk-Based Development

```
main ──●──●──●──●──●──●──●──●──●──▶  (always releasable; staging auto-deploys)
        \      \        \
         \      \        └─ fix/pieces-slug-collision ──▶ squash-merge (<1 day)
          \      └─ feat/auth-refresh-rotation ─────────▶ squash-merge (<3 days)
           └─ tag v0.3.0 ──▶ production (manual approval)
```

- **One long-lived branch: `main`.** It is protected, always green, always deployable.
  Staging deploys automatically from `main`; production deploys from tags (ADR §9).
- **Short-lived branches off `main`**, merged back within **3 days** of first commit.
  If a branch is alive on day 3, it's too big — split the work (feature-flag the
  incomplete half if needed) or pair to land it.
- **No `develop` branch. Why:** git-flow's `develop` exists to batch releases; we
  release continuously to staging and by tag to production, so `develop` would only add
  a second integration point where conflicts hide and "works on develop" diverges from
  "works on main". Two sources of truth is one too many.
- Rebase your branch on `main` when it falls behind; never merge `main` _into_ a feature
  branch with a merge commit (squash-merge erases it anyway, but the noise pollutes
  review diffs).

## 2. Branch Naming

`<type>/<scope>-<short-description>` — type from the Conventional Commit types, scope
from the scope list (§3.2), kebab-case description:

| Pattern                              | Examples                                                  |
| ------------------------------------ | --------------------------------------------------------- |
| `feat/<scope>-<desc>`                | `feat/pieces-scheduled-publish`, `feat/auth-google-oauth` |
| `fix/<scope>-<desc>`                 | `fix/feeds-cursor-duplication`                            |
| `chore/<scope>-<desc>`               | `chore/deps-nestjs-11-1`                                  |
| `docs/<desc>`                        | `docs/git-workflow`                                       |
| `refactor/`, `perf/`, `test/`, `ci/` | `perf/search-fts-ranking`, `ci/turbo-remote-cache`        |

No personal-name branches (`aftab/stuff`), no ticket-number-only branches — the name
should say what changes without opening the diff.

### 2.1 Daily flow

```bash
git switch main && git pull --ff-only          # start clean; --ff-only catches local drift
git switch -c feat/pieces-scheduled-publish    # branch off fresh main
# … work, commit early and often (WIP commits fine — squash erases them) …
git fetch origin && git rebase origin/main     # stay current; resolve conflicts locally
git push --force-with-lease                    # only ever force-push YOUR feature branch
gh pr create --fill                            # open as Draft until review-ready
```

Rules embedded in that flow:

- `git pull --ff-only` on `main` — if it can't fast-forward, you committed to `main`
  locally; move the commit to a branch, never merge.
- **`--force-with-lease`, never `--force`** — it refuses to clobber a colleague's push
  to the same branch. Force-pushing anything other than your own feature branch is
  never acceptable; `main` rejects it via protection anyway.
- Rebase conflicts are resolved by the branch author (they have the context); if a
  rebase conflicts in 3+ files repeatedly, the branch has lived too long — see §1.

### 2.2 Commit granularity

- Commit at every coherent checkpoint — a compiling state with one logical change.
  On-branch history is your undo stack; squash-merge means nobody else ever sees it.
- The **PR title** carries the conventional-commit burden (§4); branch commits should
  still be honest one-liners ("wip" is tolerated, `git commit -m .` is not — you will
  need to bisect your own branch someday).
- Generated files (`pnpm-lock.yaml`, `openapi.json`, `@qalam/api-types` output) commit
  **in the same commit** as the change that regenerated them — a lockfile-only follow-up
  commit means CI was red in between.

## 3. Conventional Commits

### 3.1 Format

```
<type>(<scope>): <subject — imperative, lowercase, no trailing period, ≤ 72 chars>

[optional body — what & why, wrapped at 100]

[optional footer — BREAKING CHANGE:, Refs:, Reverts:]
```

**Types:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `ci`, `build`,
`revert`. `feat` and `fix` drive the changelog and version bumps; use them honestly
(a dependency bump is `chore(deps)`, not `fix`, unless it fixes a user-facing bug).

### 3.2 Scope list (enforced by commitlint — closed set)

| Scopes                                                                                                                                                         | Covers                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `auth`, `users`, `pieces`, `taxonomy`, `engagement`, `collections`, `feeds`, `search`, `notifications`, `analytics`, `moderation`, `media`, `prompts`, `admin` | Backend modules (ADR §3 module list)     |
| `frontend`, `admin-app`                                                                                                                                        | The two React apps                       |
| `ui`, `shared`, `api-types`, `utils`, `config`                                                                                                                 | `@qalam/*` packages                      |
| `infra`                                                                                                                                                        | Docker, nginx, compose, deploy workflows |
| `docs`                                                                                                                                                         | `docs/**`, `CLAUDE.md`, READMEs          |
| `deps`                                                                                                                                                         | Dependency updates                       |

A commit spanning scopes usually means it should be two commits. Backend + frontend
halves of one feature land as two commits (or two PRs) with the same story reference.

### 3.3 Examples

```
✅ feat(pieces): add scheduled publish via BullMQ delayed job
✅ fix(feeds): dedupe cursor page boundary when pieces share published_at
✅ feat(auth)!: rotate refresh tokens on every use

   BREAKING CHANGE: previously issued refresh tokens are invalidated at deploy.
✅ chore(deps): bump typeorm to 0.3.21
✅ docs(docs): add coding standards and git workflow

❌ fix: stuff                              (no scope, subject says nothing)
❌ feat(Pieces): Added Scheduling.         (case, tense, trailing period)
❌ update code                             (not conventional at all)
❌ feat(backend): everything for auth      (invalid scope; "everything" = split it)
```

## 4. Enforcement — Three Layers

| Layer            | Hook / job                           | What it does                                                                                                                                                                                    |
| ---------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local, on commit | husky `pre-commit` → **lint-staged** | `prettier --write` + `eslint --fix` on staged files only. Broken style never enters history.                                                                                                    |
| Local, on commit | husky `commit-msg` → **commitlint**  | Rejects non-conventional messages and out-of-catalogue scopes at write time.                                                                                                                    |
| CI, on PR        | `ci.yml`                             | Re-runs lint + typecheck + test + build on the full graph (turbo-cached). **Why re-verify:** hooks are advisory — `--no-verify` exists, fresh clones miss hooks. CI is the actual gate.         |
| CI, on PR        | PR-title check                       | The **PR title must itself be a valid conventional commit**, because squash-merge (§5) turns the title into the commit that lands on `main`. Branch commits can be messy WIP; the title cannot. |

Reference configs (live in the repo root / `@qalam/config`):

```jsonc
// .lintstagedrc.json — staged files only; full-repo checks belong to CI
{
  "*.{ts,tsx}": ["prettier --write", "eslint --fix --max-warnings 0"],
  "*.{json,md,yml,yaml}": ["prettier --write"],
}
```

```js
// commitlint.config.js — types + the closed scope list from §3.2
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'auth',
        'users',
        'pieces',
        'taxonomy',
        'engagement',
        'collections',
        'feeds',
        'search',
        'notifications',
        'analytics',
        'moderation',
        'media',
        'prompts',
        'admin',
        'frontend',
        'admin-app',
        'ui',
        'shared',
        'api-types',
        'utils',
        'config',
        'infra',
        'docs',
        'deps',
      ],
    ],
    'scope-empty': [2, 'never'],
    'subject-case': [2, 'always', 'lower-case'],
  },
};
```

### 4.1 Branch protection on `main` (repo settings — the rules with teeth)

| Setting                         | Value                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Require PR before merging       | ✅ (no direct pushes, including admins)                                               |
| Required status checks          | `lint`, `typecheck`, `test`, `build`, `pr-title` — all must pass on the latest commit |
| Required approvals              | 1 (2 on paths matched by auth/migrations CODEOWNERS rules)                            |
| Require branches up to date     | ✅ (merge queue once PR volume justifies it)                                          |
| Allowed merge methods           | Squash only                                                                           |
| Force pushes / deletions        | ❌                                                                                    |
| Require conversation resolution | ✅ — unresolved review threads block merge                                            |

## 5. Pull Request Process

### 5.1 Template sections (`.github/PULL_REQUEST_TEMPLATE.md`)

```
## What            — one paragraph, user/system-visible outcome
## Why             — link to epic/task (docs/18) or issue; the problem, not the diff
## How             — design notes reviewers need; call out anything non-obvious
## Screenshots     — UI changes: BOTH themes; RTL (dir="rtl") when layout is touched
## Migrations      — yes/no; if yes: /migration-check output + rollback note
## Testing         — what's covered, what's deliberately not, how to verify locally
## Checklist       — Definition of Done boxes (16_CodingStandards.md §8)
```

### 5.2 Rules

| Rule              | Standard                                                                                                                       | Why                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Size              | **< 400 lines of diff** (excluding lockfiles, generated types, snapshots). Larger → split into stacked PRs.                    | Review quality collapses past ~400 lines; big PRs get "LGTM"-rubber-stamped, small ones get read.                                                                   |
| Self-review first | Author reviews their own diff in the GitHub UI **before** requesting review, leaving comments on anything surprising.          | Catches the 30% of issues that need no second brain, and pre-answers reviewer questions.                                                                            |
| Review SLA        | First response within **1 business day**; re-review within half a day. Blocked-on-review is the team's top interrupt priority. | Short-lived branches (§1) die without fast review.                                                                                                                  |
| Merge gate        | CI green + **1 approval** (2 for auth/security-touching and migration PRs).                                                    | One reviewer is the sweet spot for our team size; sensitive surfaces get two.                                                                                       |
| Merge method      | **Squash-merge only.** Merge commits and rebase-merge are disabled in repo settings.                                           | Linear history: `git log --oneline` on `main` reads as a changelog, `git bisect` works, reverts are single commits, and WIP noise ("fix typo", "wip2") never lands. |
| Draft PRs         | Open early as Draft for visibility/CI; convert when review-ready.                                                              | CI feedback before human feedback.                                                                                                                                  |
| Stale branches    | Deleted on merge (auto); branches idle > 7 days are flagged in standup.                                                        | Dead branches are unmerged risk.                                                                                                                                    |

## 6. CODEOWNERS Strategy

`.github/CODEOWNERS` routes review by ownership surface, not by file count. Keep it
coarse — over-granular ownership creates review bottlenecks:

```
# Fallback — lead reviews anything unclaimed
*                                   @qalam/lead

# Contract surfaces — changes here ripple to every consumer
/packages/shared/                   @qalam/lead @qalam/backend
/packages/api-types/                @qalam/backend @qalam/frontend
/packages/ui/                       @qalam/frontend

# Apps
/backend/                           @qalam/backend
/frontend/                          @qalam/frontend
/admin/                             @qalam/frontend

# High-blast-radius surfaces — 2 approvals via branch protection
/backend/src/modules/auth/          @qalam/lead @qalam/backend
/backend/src/database/migrations/   @qalam/lead @qalam/backend
/infrastructure/ /.github/          @qalam/lead
/docs/                              @qalam/lead
```

Teams (`@qalam/backend`, `@qalam/frontend`) rather than individuals, so vacations don't
stall merges. The lead owns contracts (`shared`, `api-types`) because those are the
places where a "small" change breaks three consumers.

## 7. Releases

### 7.1 Release flow

```
main (staging auto-deploy) ──●──●──●──┬──●──●──▶
                                      │
                              tag v0.4.0 ──▶ changelog job ──▶ production deploy
                                                                (manual approval, ADR §9)
```

1. Releases are **tags on `main`**: `vX.Y.Z` (SemVer: X breaking/product-milestone,
   Y features, Z fixes-only). No release branches — if `main` isn't releasable, that's
   the bug to fix, not a process to add.
2. Tagging triggers the release workflow: build → **auto-changelog generated from
   conventional commits** since the previous tag (`feat` → Features, `fix` → Fixes,
   `BREAKING CHANGE` → highlighted) → GitHub Release → production deploy gate.
   The changelog is free _because_ §3 and §4 made commit messages trustworthy — this is
   the payoff for the ceremony.
3. Migrations run as a deploy step before the new code serves traffic (ADR §9), never at
   app boot.

### 7.2 Hotfix flow

No hotfix branches off tags in Phase 1 — we deploy from `main`, so the fix path is the
normal path, accelerated:

1. `fix/<scope>-<desc>` off `main` → minimal diff (fix + test only, zero opportunistic
   refactoring) → expedited review (SLA: hours, 1 approval, CI green non-negotiable).
2. Squash-merge → verify on staging → tag `vX.Y.Z+1` → production.
3. If `main` has unreleased work that must not ship yet, that work should have been
   feature-flagged (§1). A hotfix discovering un-flagged unreleasable work on `main` is
   a process failure — capture it in the post-incident note.

### 7.3 Migration PRs — special rules

Schema changes have the highest blast radius in the repo (ADR §4: migrations are
generated, reviewed, immutable once merged):

| Rule          | Detail                                                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Isolation     | A migration PR contains the migration + the entity change that generated it + directly dependent code. Never bundled into a feature mega-PR.                                                                                   |
| Review        | `/migration-check` output pasted into the PR **Migrations** section; **2 approvals** including the lead (per CODEOWNERS + branch protection).                                                                                  |
| Immutability  | **Never edit a merged migration.** Wrong migration on `main`? Write a new corrective migration. Editing history breaks every environment that already ran it — there is no exception to this rule.                             |
| Safety bar    | Destructive changes (drop column/table) ship in two releases: release N deprecates (code stops reading/writing), release N+1 drops. Backfills that scan large tables run as BullMQ jobs, not inside the migration transaction. |
| Rollback note | Every migration PR states the rollback strategy (down-migration tested locally, or "roll-forward only" with justification).                                                                                                    |

## 8. Reverts & Recovery

- **Broken `main` outranks everything.** The break is either fixed or reverted within
  one hour; when in doubt, revert — squash-merge makes every landed change a single
  commit, so `git revert <sha>` is clean and mechanical. Re-land later via a fresh PR
  (`revert:` type on the revert, original title reused on the re-land).
- Reverting a PR that included a migration does **not** revert the schema (§7.3
  immutability): the revert PR must add a corrective migration if the schema change
  itself must be undone. This asymmetry is why migration PRs stay isolated.
- Never rewrite `main` history — no `git commit --amend` + force, no interactive rebase
  on anything already pushed to `main`. Wrong commit on `main` = revert, always.
- Accidentally committed secret: revert is **not** enough (history retains it). Rotate
  the secret immediately, then scrub (`git filter-repo`) with the lead — this is the
  only sanctioned history rewrite, and it's an incident, not a workflow.

## 9. Quick Reference

| I want to…        | Do                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------- |
| Start work        | `git switch main && git pull --ff-only && git switch -c feat/<scope>-<desc>`           |
| Sync my branch    | `git fetch origin && git rebase origin/main && git push --force-with-lease`            |
| Open a PR         | `gh pr create --fill` (Draft until ready); title = conventional commit                 |
| Land it           | CI green + approval → **Squash and merge** (verify title/scope in the merge box)       |
| Undo a landed PR  | `git revert <squash-sha>` via a `revert:`-typed PR                                     |
| Ship a release    | Tag `vX.Y.Z` on `main` → changelog + release job → approve production deploy           |
| Fix production    | `fix/` branch off `main` → expedited review → merge → tag patch release                |
| Change the schema | Isolated migration PR + `/migration-check` + 2 approvals; never edit merged migrations |

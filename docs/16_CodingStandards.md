# 16 — Coding Standards

> **Status:** Binding. Derives from `00_ArchitectureDecisions.md`. Where this document and
> the ADR ever disagree, the ADR wins and this file gets fixed. Everything here is
> enforceable: by the compiler, by ESLint rules exported from `@qalam/config`, or by
> review checklist. A standard that cannot be enforced is a suggestion — we don't ship
> suggestions.

---

## 1. TypeScript Standards

`strict: true` in every tsconfig, no exceptions, no per-file opt-outs. The shared bases
live in `@qalam/config` (`tsconfig/base`, `tsconfig/nest`, `tsconfig/react`) — apps and
packages extend, never redefine.

### 1.1 The `any` ban

`any` is banned repo-wide (`@typescript-eslint/no-explicit-any: error`). When a type is
genuinely unknown at a boundary (webhook payloads, `JSON.parse`, third-party callbacks),
use `unknown` and **narrow** before touching it:

```ts
// ❌ Banned
function handleWebhook(payload: any) {
  return payload.event.type;
}

// ✅ unknown + narrowing (Zod at boundaries, type guards internally)
function handleWebhook(payload: unknown): WebhookEvent {
  return webhookEventSchema.parse(payload); // Zod throws with a real error
}
```

**Why:** `any` doesn't disable checking for one variable — it poisons every expression it
flows through. `unknown` keeps the compiler honest and forces the narrowing to be written
down where the uncertainty actually lives.

### 1.2 Explicit return types on exports

Every **exported** function, method, and public class member declares its return type
(`@typescript-eslint/explicit-module-boundary-types: error`). Local helpers inside a file
may rely on inference.

```ts
// ✅ The contract is visible without reading the body
export function computeReadingTime(wordCount: number): ReadingTime { … }
```

**Why:** inferred return types on exports make refactors silently change public
contracts. An explicit annotation turns an accidental contract change into a compile
error at the source, not at the seventeen call sites.

### 1.3 Discriminated unions over enums-as-flags

When a value carries _shape_ along with _kind_, model it as a discriminated union — never
an enum plus optional fields:

```ts
// ❌ Enum-as-flag: which fields are valid when?
interface Notification {
  type: NotificationType;
  pieceId?: string;
  followerId?: string;
}

// ✅ Discriminated union: the compiler knows
type Notification =
  | { type: 'piece.liked'; pieceId: string; actorId: string }
  | { type: 'user.followed'; actorId: string }
  | { type: 'piece.response'; pieceId: string; responsePieceId: string };
```

Plain enums remain fine for closed value sets with no attached shape (`PieceStatus`,
`Visibility`, `Role` — these live in `@qalam/shared` and map to DB values). Prefer
`as const` object literals + union types over `enum` for new code in packages consumed
by Vite apps (enums generate runtime code; const objects tree-shake).

### 1.4 `import type`

Type-only imports use `import type` (enforced by
`@typescript-eslint/consistent-type-imports`). **Why:** it makes erasure explicit,
prevents accidental runtime circular imports (a classic NestJS DI failure mode), and
lets bundlers drop the import entirely.

```ts
import type { CreatePieceDto } from './dto/create-piece.dto';
import { PiecesService } from './pieces.service';
```

### 1.5 Non-null assertions

`!` is banned in production code (`@typescript-eslint/no-non-null-assertion: error`).
Handle the null: early-return, throw a domain `AppException`, or restructure so the type
is narrow. The single exception: **test files**, where a fixture is known-present and the
assertion keeps arrange blocks readable. The lint rule is relaxed to `warn` for
`*.spec.ts` / `*.e2e-spec.ts` only.

### 1.6 Miscellaneous hard rules

| Rule                           | Standard                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `as` casts                     | Last resort; never `as unknown as T` outside tests. Prefer type guards/Zod.                          |
| `@ts-ignore`                   | Banned. `@ts-expect-error` allowed **with a trailing reason comment**.                               |
| Optional chaining to hide bugs | `a?.b?.c ?? fallback` is not error handling. If absence is exceptional, throw.                       |
| `null` vs `undefined`          | DB/API nullable fields are `null` (matches JSON/Postgres); "not provided" is `undefined`. Don't mix. |
| Exhaustiveness                 | `switch` on unions ends with `default: assertNever(x)` (helper in `@qalam/utils`).                   |
| Dates                          | Timestamps cross the wire as ISO-8601 UTC strings; `Date` objects only at the edges.                 |

---

## 2. Naming Conventions

One table, no local dialects. ESLint `@typescript-eslint/naming-convention` enforces the
identifier rows; `unicorn/filename-case` enforces the file row.

| Thing                                           | Convention                                        | Examples                                                                                 |
| ----------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Files (all)                                     | `kebab-case`                                      | `piece-card.tsx`, `pieces.service.ts`, `use-autosave.ts`                                 |
| Backend file suffixes                           | NestJS role suffixes                              | `pieces.controller.ts`, `pieces.repository.ts`, `create-piece.dto.ts`, `piece.entity.ts` |
| Classes / interfaces / types / React components | `PascalCase`                                      | `PiecesService`, `PieceCard`, `CreatePieceDto`                                           |
| Functions / methods / variables                 | `camelCase`                                       | `computeTrendingScore`, `pieceStats`                                                     |
| Constants (true module-level constants)         | `SCREAMING_SNAKE_CASE`                            | `MAX_CLAPS_PER_USER`, `USERNAME_REGEX`                                                   |
| Database tables / columns                       | `snake_case`, tables plural                       | `piece_tags`, `reading_time_seconds`                                                     |
| Booleans                                        | `is` / `has` / `can` prefix                       | `isPrivate`, `hasPublished`, `canModerate`                                               |
| Event names (domain events, queues, analytics)  | `dot.case`, `noun.verb-past`                      | `piece.published`, `user.followed`, `report.resolved`                                    |
| BullMQ queue names                              | `kebab-case` (per ADR §3)                         | `scheduled-publish`, `trending-score`                                                    |
| React hooks                                     | `use` prefix, camelCase file kebab                | `useAutosave` in `use-autosave.ts`                                                       |
| Zustand stores                                  | `use<X>Store`                                     | `useEditorUiStore`, `useThemeStore`                                                      |
| CSS tokens                                      | `--q-` prefix (per ADR §7)                        | `--q-bg-canvas`, `--q-accent`                                                            |
| Env vars                                        | `SCREAMING_SNAKE_CASE`; frontend prefixed `VITE_` | `JWT_ACCESS_SECRET`, `VITE_API_URL`                                                      |
| Generics                                        | Descriptive when non-trivial                      | `T` fine for one; `TEntity`, `TCursor` otherwise                                         |

**Why kebab-case files:** case-insensitive filesystems (macOS default) make
`PieceCard.tsx` vs `piececard.tsx` a git landmine; kebab-case removes the class of bug.

---

## 3. Backend Standards (NestJS)

### 3.1 Module boundaries — the prime directive

The layering is **controller → service → repository**, and module boundaries are walls:

```
┌────────────── pieces module ──────────────┐   ┌────────── engagement module ─────────┐
│ pieces.controller ─▶ pieces.service ─▶ pieces.repository │   │ engagement.service ─▶ …repos │
└───────────────────────────▲───────────────┘   └───────────┬──────────────────────────┘
                            └──────── exported service only ─┘
```

1. **Controllers** never touch repositories or `DataSource`. They translate HTTP ⇄ DTOs
   and delegate. No business logic — no conditionals beyond guard-style input shaping.
2. **Services** hold all business logic. A service may inject **its own module's
   repositories** and **other modules' exported services** — never another module's
   repository, entity manager, or query builder.
3. **Repositories** (custom classes over `DataSource`, per ADR §3) are the only layer
   that touches TypeORM query builders. One repository per aggregate root.
4. **Cross-module communication:** synchronous needs → the other module's exported
   service; asynchronous/fan-out needs (notifications, analytics, feed invalidation) →
   emit a domain event or enqueue a BullMQ job. If module A needs module B's _data
   shape_, B exposes a method returning it — A never reaches into B's tables.

**Why:** these walls are our microservice extraction seams (`workers`, `search`,
`analytics` per ADR §1). Every cross-module repository import is a weld across a seam we
paid for.

Enforced by `eslint-plugin-boundaries` config in `@qalam/config`: imports matching
`modules/*/repositories/**` or `modules/*/entities/**` from a different module fail lint.

### 3.2 DTO rules — the three-DTO pattern

Every module with CRUD ships three DTOs per resource:

| DTO            | Purpose    | Notes                                                                                                   |
| -------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| `Create<X>Dto` | POST body  | Full validation; no `id`, no server-computed fields                                                     |
| `Update<X>Dto` | PATCH body | `PartialType(Create<X>Dto)` + immutable fields stripped (e.g. `username` — permanent per ADR §4)        |
| `Filter<X>Dto` | GET query  | Pagination params + filters; `@Type`/`@Transform` for query-string coercion (booleans, arrays, numbers) |

- **All validation lives in DTOs** via `class-validator` decorators. Services assume
  their inputs are valid-shaped and enforce _business_ rules only (e.g. "schedule date is
  in the future" → `PIECE_SCHEDULE_IN_PAST`, not an `@IsDate` re-check).
- Nested objects use `@ValidateNested() @Type(() => ChildDto)` — always both.
- Swagger decorators (`@ApiProperty`) on every DTO field: the OpenAPI spec is a build
  artifact feeding `@qalam/api-types` codegen (ADR §3), so an undocumented field is a
  missing field for every frontend consumer.
- Response shaping uses dedicated response DTO/serializer classes — never return
  entities raw (leaks `deleted_at`, internal FKs, and future columns you forgot about).

**Why validation-in-DTOs:** one boundary, one vocabulary. If validation leaks into
services, the same rule ends up written twice and drifting.

### 3.3 Repository rules

- Only repositories construct query builders or call `dataSource.query`. Grep-able
  invariant: `createQueryBuilder` appears **only** in `*.repository.ts`.
- Raw SQL is allowed inside repositories where TypeORM fights us (FTS `tsvector` ranking,
  cursor pagination over composite keys) — parameterized always, never interpolated
  (ADR §8).
- Repositories return entities or purpose-built read models; they never return
  `SelectQueryBuilder` for a service to "finish".
- Soft-delete awareness lives here: repositories on soft-deleted aggregates (`users`,
  `pieces`, `collections`) filter `deleted_at IS NULL` by default and expose explicit
  `withDeleted` variants for admin/moderation paths.
- Visibility guards (private accounts, `Visibility` enum) are applied in repository query
  methods via a shared scope helper — enforcement in the query layer per ADR §4, so a
  forgotten `WHERE` is a code-review catch in exactly one layer.

### 3.4 Error handling

- Domain errors extend **`AppException`** (in `backend/src/common`), constructed with a
  code from the `@qalam/shared` error-code catalogue:

  ```ts
  export class PieceNotFoundException extends AppException {
    constructor(slug: string) {
      super(ErrorCode.PIECE_NOT_FOUND, `Piece "${slug}" not found`, HttpStatus.NOT_FOUND);
    }
  }
  ```

- **Never throw raw `Error` across a module boundary.** Inside a private helper, fine —
  but anything that can escape a service method must be an `AppException` subclass so
  the global exception filter can produce the ADR §5 error envelope with a stable `code`.
- Never `catch (e) {}` — swallow nothing. Catch to translate (wrap driver/library errors
  into domain exceptions) or to compensate; otherwise let it propagate to the filter.
- Codes follow `DOMAIN_REASON` (`AUTH_INVALID_CREDENTIALS`, `PIECE_SCHEDULE_IN_PAST`).
  Adding a code = one PR touching `@qalam/shared` first; the catalogue is the contract
  the frontends switch on.
- Log at the throw site only when you add context the filter can't know; the filter logs
  every 5xx once with the request ID. **Why:** double-logging turns incident triage into
  archaeology.

### 3.5 Transactions policy

- A transaction wraps every multi-write invariant: piece publish + `piece_stats` row +
  `piece_tags` sync; follow + notification row; clap increment + stats update.
- Transactions are **owned by services**, executed via a `TransactionRunner` helper
  wrapping `dataSource.transaction`, passing the `EntityManager` down into repository
  methods that accept an optional manager parameter. Repositories never _start_
  transactions.
- Keep transactions short: no HTTP calls, no queue publishes, no `sharp` work inside.
  Enqueue jobs **after** commit (or use an outbox row inside the transaction when
  delivery must be guaranteed — scheduled publish does this).
- Denormalized counters (`piece_stats`) update in the same transaction as the source row
  (ADR §4); the nightly reconciliation job is a safety net, not the mechanism.

### 3.6 Controllers — the thin list

A controller method is: decorators → DTO in → service call → response mapping. If you
are writing an `if` that compares domain values, you're in the wrong file. Controllers
also own: route versioning (`/api/v1`), guards/roles decorators, `Idempotency-Key`
handling wiring (publish endpoint, ADR §5), Swagger operation decorators.

---

## 4. Frontend Standards (React, frontend + admin)

### 4.1 Feature-first structure

Per ADR §6: `app/` (providers, router) · `features/<name>/{api,components,hooks,stores}`
· `components/` (app-wide composites) · primitives in `@qalam/ui`.

- A feature owns everything about itself. Test: `rm -rf features/collections` should
  break only the router entry and explicit cross-feature imports — nothing silent.
- Cross-feature imports go through the feature's `index.ts` (its public surface). Deep
  imports into another feature's internals fail lint.
- Something used by 2+ features graduates: composite → `components/`, primitive →
  `@qalam/ui`, pure logic → `@qalam/utils`. Don't create `features/common` — that's a
  junk drawer with a nicer name.

### 4.2 Components

- **< 200 lines** including JSX. Approaching it? Extract child components, or extract
  logic into a hook — a component's job is rendering, not orchestration.
- Function components only; props destructured in the signature; props type declared
  above the component (`interface PieceCardProps { … }`).
- No data fetching in components: components call feature query hooks
  (`usePiece(slug)`), hooks call the feature's `api/` layer, which calls the central
  api-client. Three layers, each mockable.
- No `export default` except route-level lazy components (React Router `lazy` needs it).
  Named exports keep renames honest and auto-import predictable.

### 4.3 Hooks rules

- Custom hooks for: any `useEffect` with 3+ dependencies, any state machine
  (autosave, publish flow), anything reused twice. Name says what it returns/does:
  `useAutosave`, `usePieceStats`, `useDebouncedValue`.
- Server-state hooks are thin TanStack Query wrappers with **centralized query keys** per
  feature (`piecesKeys.detail(slug)`) — key drift is cache-invalidation drift.
- No conditional hooks, no hooks in loops — `eslint-plugin-react-hooks` at `error`.

### 4.4 State discipline

| State kind                                        | Home                           | Never                                                                        |
| ------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| Server data (pieces, feeds, profiles)             | TanStack Query v5              | Copied into Zustand — **banned** (ADR §6: one cache, one invalidation model) |
| Client/UI state (theme, editor UI, session flags) | Zustand v5 slices              | Grown into a server-data mirror                                              |
| Form state                                        | React Hook Form + Zod resolver | Hand-rolled `useState` forms                                                 |
| Tabs / filters / search / pagination              | URL (React Router v7)          | Component state — the URL is shareable truth (ADR §6)                        |

### 4.5 API layer

All HTTP goes through `lib/api-client.ts` — the single typed `fetch` wrapper that owns:
base URL (`VITE_API_URL`), auth header/refresh-retry, ADR §5 envelope unwrapping, error
normalization (envelope `error.code` → typed `ApiError`), request-ID propagation. Types
come from `@qalam/api-types`. **Raw `fetch`/`axios` in components or hooks fails
review** — lint restricts `fetch` imports outside `lib/`.

### 4.6 CSS — Tailwind + tokens, RTL-safe from day one

- Tailwind 4 utilities + `--q-*` tokens only. AntD covers complex widgets; do not
  restyle AntD internals with Tailwind overrides — theme it through `ConfigProvider`
  fed by the same tokens (ADR §6 conflict rule).
- **HARD BAN on physical direction classes.** Urdu is RTL on day one (ADR §0, §6), and
  a retrofit costs 10×. Enforced by a custom ESLint rule + Stylelint in `@qalam/config`;
  CI fails on any occurrence:

  | ❌ Banned                     | ✅ Use instead                |
  | ----------------------------- | ----------------------------- |
  | `ml-*` / `mr-*`               | `ms-*` / `me-*`               |
  | `pl-*` / `pr-*`               | `ps-*` / `pe-*`               |
  | `left-*` / `right-*`          | `start-*` / `end-*`           |
  | `text-left` / `text-right`    | `text-start` / `text-end`     |
  | `border-l-*` / `border-r-*`   | `border-s-*` / `border-e-*`   |
  | `rounded-l-*` / `rounded-r-*` | `rounded-s-*` / `rounded-e-*` |

  The only exemption: geometry that is genuinely physical, not directional (e.g. a
  cursor-position popover) — requires an inline
  `// eslint-disable-next-line qalam/no-physical-direction -- reason` with the reason.

- **Dark mode via tokens only.** Components reference `--q-*` variables (through the
  Tailwind theme mapping); the `data-theme` attribute flip does the rest. Raw hex values
  in component code fail review — a hex literal in a `.tsx` file is a bug even when it
  looks right in both themes today.
- No inline `style={{}}` except values that are computed at runtime (progress widths,
  virtualized offsets).

### 4.7 Where each value lives (frontend placement)

The package graph (`03` §4–5) dictates placement; a value has exactly one home. This is the
table reviewers hold frontend PRs against:

| Kind                                                                     | Home                                  | Rule                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------- |
| Wire request/response types                                              | `@qalam/api-types`                    | Generated from `openapi.json`; never hand-duplicated.                                   |
| Domain enums (`PieceStatus`, `Visibility`, `Role`, `NotificationType`…)  | `@qalam/shared`                       | Imported, never re-declared; `as const` object + union in Vite packages (§1.3).         |
| Domain constants/limits/regex (`MAX_CLAPS_PER_USER`, `USERNAME_REGEX`…)  | `@qalam/shared`                       | The one source both FE and BE import.                                                   |
| Error codes / permissions catalogue                                      | `@qalam/shared`                       | `ERROR_CODES`, `PERMISSIONS`, `DEFAULT_ROLE_PERMISSIONS`, `permissionSatisfies`.        |
| Pure functions (`slugify`, `readingTime`, cursor helpers, `assertNever`) | `@qalam/utils`                        | No I/O, no domain constants, no framework.                                              |
| Design tokens / theme / motion variants                                  | `@qalam/ui`                           | Single token source (`07` §1, §12).                                                     |
| Query-key factory                                                        | `src/lib/query-keys.ts` (`qk.*`)      | Data-shaped, one factory per app; ad-hoc string keys banned (`12` §2.1).                |
| App-local types (props, view models)                                     | `features/<name>/types` / `src/types` | Feature-local unless used by 2+ features → move down. Never a `features/common` drawer. |

Client permission gating decodes `role` from the JWT and derives capabilities from
`@qalam/shared` `DEFAULT_ROLE_PERMISSIONS` — a **UX hint only**; the server is authoritative
(`12` §7, `26` §8).

### 4.8 Frontend performance rules

- **Route-group `lazy()`** is the unit of code-splitting; `React.lazy` for below-route heavy
  islands (TipTap editor, publish sheet, analytics charts) — the editor is **never** in the
  visitor-critical path (`11` §9).
- **Render discipline:** narrow Zustand selectors (bare `useStore()` re-renders on every slice
  change — banned); `useMemo`/`useCallback` only where a measured cost or dependency-identity
  demands it, not by reflex; stable list keys (never array index for dynamic lists).
- **TanStack does caching/dedup** — never reimplement with `useEffect`+`useState`; `staleTime`
  tiers live in hooks, not components (`12` §2.2). Effects are a last resort: prefer deriving
  during render and event handlers over "sync X to Y" effects; never an effect to sync
  URL⇄state (the URL _is_ the state) or to fetch.
- **Editor:** TipTap owns the document; React reads on demand (`12` §5). **Images:** S3 keys →
  `mediaUrl()`; `loading="lazy"`, explicit dimensions, `max-width:100%`. **Fonts:** Nastaliq
  lazy-loaded on the Urdu reading surface only (`07` §3.3). **Motion:** shared variants only,
  all degrade under reduced motion (`07` §14).

---

## 5. Imports & Barrels

### 5.1 Import order

Enforced by `eslint-plugin-import` `order` with groups, blank line between groups,
alphabetized within:

```ts
// 1. Node builtins
import { randomUUID } from 'node:crypto';
// 2. External packages
import { Injectable } from '@nestjs/common';
// 3. @qalam/* workspace packages
import { ErrorCode, MAX_CLAPS_PER_USER } from '@qalam/shared';
// 4. Internal aliases (@/ → src/)
import { AppException } from '@/common/exceptions/app.exception';
// 5. Relative
import { PiecesRepository } from './pieces.repository';
```

Builtins use the `node:` protocol prefix. Path alias is `@/` → `src/` in every app;
no `../../..` climbing past two levels (use the alias).

### 5.2 Barrel-file policy

- **Packages:** every `@qalam/*` package exports through its root `index.ts` (tsup entry).
  Consumers import from `@qalam/shared`, never from `@qalam/shared/src/enums` — deep
  imports into packages fail lint.
- **Apps:** _avoid_ deep barrel chains. Allowed barrels: one `index.ts` per frontend
  feature (its public surface) and per backend module (module public surface: the module
  class + exported service tokens). No `index.ts` inside `components/`, `dto/`,
  `entities/` subfolders re-exporting everything.

**Why the asymmetry:** package barrels define a contract; app-internal barrels create
import cycles, defeat tree-shaking, and make "who uses this?" unanswerable.

---

## 6. Comments & TODOs

- Comments explain **why**, never what. If a comment paraphrases the next line, delete
  one of them. Good comments record: non-obvious constraints ("Nastaliq needs
  line-height ≥ 2 — see docs/00 §6"), links to decisions, warnings about tempting-but-wrong
  refactors, and the reasoning behind magic values.
- **JSDoc is required on every public API of every `@qalam/*` package** — these cross
  team boundaries and show up in editor tooltips. Apps' internal functions need JSDoc
  only when the signature can't carry the meaning.
- Commented-out code is deleted, not committed. Git remembers.
- TODO format — machine-greppable, owned, and never a substitute for a ticket on
  anything user-facing:

  ```ts
  // TODO(aftab): replace linear scan with GIN-backed lookup once piece_tags > 100k rows
  ```

  `TODO(username): description`. Bare `TODO`/`FIXME` without an owner fails lint
  (`unicorn/expiring-todo-comments` configured to require the owner pattern).

---

## 7. Testing Standards

### 7.1 What must be tested

| Layer                                    | Requirement                                                                                                    | Coverage target                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Backend services                         | **Mandatory** — every public method, happy + error paths                                                       | ≥ 80% (enforced in CI for `*.service.ts`) |
| Guards / interceptors / filters          | **Mandatory** — they are security surface                                                                      | Every branch                              |
| `@qalam/utils` + `@qalam/shared` helpers | **Mandatory** — pure functions, cheapest tests we own                                                          | ≥ 80%                                     |
| Repositories                             | Integration tests where queries have logic (FTS, cursors, visibility scopes); Testcontainers arrives Phase 1.5 | Query-logic paths                         |
| Controllers                              | e2e via Supertest per module — envelope shape, status codes, validation rejection                              | Per-endpoint smoke                        |
| Frontend hooks + utils                   | **Mandatory** (Vitest + Testing Library)                                                                       | Behavior, not snapshots                   |
| Frontend components                      | Test behavior/interaction for anything with logic; skip pure-presentational                                    | —                                         |

**Why services/utils/guards first:** they are where bugs cost the most and where tests
are cheapest to keep green. UI snapshot suites rot; behavior tests don't.

### 7.2 Naming & runners

- Unit tests: `<file>.spec.ts` colocated next to the source file.
- Backend e2e: `<module>.e2e-spec.ts` under `backend/test/`.
- **Backend: Jest 29** (ADR §3) · **Frontend/admin/packages: Vitest 3** (ADR §6 — native
  Vite pipeline). Don't import one's globals in the other's tests.

### 7.3 AAA pattern

Every test reads Arrange–Act–Assert, one behavior per test, name describes the behavior:

```ts
it('rejects scheduling a piece in the past with PIECE_SCHEDULE_IN_PAST', async () => {
  // Arrange
  const piece = pieceFactory.draft({ authorId: author.id });
  // Act
  const act = () => service.schedule(piece.id, { publishAt: yesterday() });
  // Assert
  await expect(act()).rejects.toMatchException(ErrorCode.PIECE_SCHEDULE_IN_PAST);
});
```

No logic in tests (loops/conditionals mean you're testing the test). One `expect`
cluster per behavior; multiple asserts on one result object are fine.

### 7.4 Factories & fixtures

- Factories live in `test/factories/` (backend) and `src/test/factories/` (frontend);
  named `<entity>.factory.ts`; built on plain functions returning valid objects with
  overridable fields: `pieceFactory.published({ language: 'ur' })`.
- Factories produce **valid-by-default** data (respecting `USERNAME_REGEX`, clap limits,
  UUIDv7 ids) so tests only state what they're about.
- No shared mutable fixtures between tests; no test depends on another's writes; e2e
  suites reset DB state per file (transaction rollback or truncate).
- Mock at the boundary you own: services mock repositories; hooks mock the api layer
  (MSW for frontend integration tests) — never mock the thing under test's internals.

---

## 8. Definition of Done

A change is **Done** when every box is checked — not when it demos:

```
□ Compiles with zero TS errors and zero new ESLint warnings (turbo lint + typecheck)
□ Follows layering: no cross-module repo imports, no logic in controllers,
  no query builders outside repositories
□ DTOs carry validation + Swagger decorators; error paths throw catalogued AppExceptions
□ New/changed behavior covered by tests per §7 (services/guards/utils mandatory);
  suite green locally
□ Frontend: no physical direction classes, no raw hex, no fetch outside api-client,
  no server state in Zustand; verified in BOTH themes and BOTH directions (dir="rtl")
□ DB changes: generated migration reviewed via /migration-check; merged migrations
  untouched
□ OpenAPI spec regenerated if API surface changed (@qalam/api-types stays in sync)
□ No secrets, no console.log left behind (Pino/structured logging only on backend)
□ Docs updated when a decision or contract changed (this file, ADR, or module README)
□ Self-reviewed diff before requesting review (see 17_GitWorkflow.md §5)
□ Conventional commit(s) with correct scope; PR under the size guideline
```

If a box can't be checked, the PR description says why — silence is not an exemption.

# E2E 04 — Test Data Strategy

> **Status:** Binding. Deterministic data is the difference between a suite you trust and one you
> disable. This document specifies the fixed **seeded baseline**, the **e2e-fixtures seed** (the one
> substantive backend change), the **unique-data factory** for per-test records, **isolation** rules,
> and **cleanup**. Grounded in the real seed runner (`backend/src/database/seeds/run-seeds.ts`), which
> today seeds only roles + PBAC + taxonomy + one super-admin.

---

## 1. Two tiers of data

| Tier                | Lifetime          | Who creates it                 | Mutable by tests?      |
| ------------------- | ----------------- | ------------------------------ | ---------------------- |
| **Baseline (seed)** | Whole run, stable | seed scripts (`stack-up`)      | **Read-only** (see §5) |
| **Per-test**        | One test          | `api` fixture + `data` factory | Yes — it's yours       |

**Why two tiers:** the baseline gives every test a known starting world (a verified writer exists, a
super-admin exists, taxonomy exists) without each test rebuilding it; the per-test tier gives each test
its _own_ records so parallel workers and three browser engines never fight over the same row.

---

## 2. The baseline — today vs what E2E needs

Today `run-seeds.ts` seeds:

- RBAC roles (`user`, `moderator`, `admin`, `super_admin`)
- PBAC permissions + role mappings
- Taxonomy (languages hi/ur/en, 8 genres)
- One super-admin (`admin@qalam.local` / `ChangeMe!SuperAdmin1`, env-gated, idempotent)

That is enough to log in as **admin**, but **not** as a **writer** — and the frontend suite needs a
verified writer whose login works without email-gating. Hence the one substantive backend change:

---

## 3. The e2e-fixtures seed (the only substantive backend change)

Add an **idempotent, non-production-guarded** seed that creates the fixtures E2E depends on. It runs as
an extra step in `stack-up.sh` (after `run-seeds`), never on a production deploy.

### 3.1 What it creates

| Fixture                                                     | Details                                                                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **E2E writer**                                              | `writer@qalam.local` / `ChangeMe!Writer1`, role `user`, **email pre-verified**, remember-eligible. This is the account `.auth/frontend.json` is minted from. |
| **A couple of sample pieces**                               | 1–2 published pieces by the writer, so read-only feed/profile/search specs have deterministic content to find.                                               |
| _(optional, phase-driven)_ a **reader** and a **moderator** | added only when a phase needs those permission levels (e.g. follow flow needs a second user).                                                                |

### 3.2 Rules (MUST)

1. **Idempotent** — insert-if-missing by natural key (email/username), like `super-admin.seed.ts`. Safe
   to re-run every `stack-up`.
2. **Non-prod guard** — refuse to run when `NODE_ENV === 'production'`; log-and-skip, like the
   super-admin seed's env gate. **Why:** a known-password writer must never land in prod by accident.
3. **Reuse existing services** — create users via `UsersService`/`PasswordService` (same argon2id
   policy), pieces via the pieces service, so fixtures are _real_ records indistinguishable from
   user-created ones. No raw SQL inserts. **Why:** raw inserts skip invariants (hashing, hooks, audit)
   and produce records the app can't actually use.
4. **Env-overridable creds** — `E2E_WRITER_EMAIL` / `E2E_WRITER_PASSWORD`, defaults in non-prod.
5. **Lives beside the others** — `backend/src/database/seeds/e2e-fixtures.seed.ts`, wired into a new
   `pnpm --filter backend seed:e2e` script (separate from the prod-safe `seed`), so it's never in the
   default deploy seed path.

### 3.3 Placement in the boot sequence

`stack-up.sh`: docker up → wait backend health → `migration:run` → `seed` (roles/PBAC/taxonomy/super-admin)
→ `seed:e2e` (writer + sample pieces). See [01 §3](./01_Architecture.md) and [08_Runbook](./08_Runbook.md).

---

## 4. Per-test data — the unique-data factory

Anything a test _creates_ must be unique so parallel workers/engines never collide. The `data` fixture
([02 §3](./02_Conventions.md)) builds unique values from **worker index + a monotonic per-test counter**
(not wall-clock alone — two workers can hit the same millisecond).

```ts
// fixtures/data.ts (design shape)
export class DataFactory {
  private n = 0;
  constructor(private readonly info: TestInfo) {}
  private uniq() {
    return `${this.info.workerIndex}-${this.info.parallelIndex}-${this.n++}-${this.info.testId.slice(0, 6)}`;
  }
  pieceTitle() {
    return `E2E Piece ${this.uniq()}`;
  }
  username() {
    return `e2e_${this.uniq()}`.replace(/[^a-z0-9_]/gi, '_');
  }
  email() {
    return `e2e+${this.uniq()}@qalam.local`;
  }
}
```

- **Rule (MUST):** never create a record with a fixed name/email in a test. Always via `data`.
- Titles/usernames carry an `E2E`/`e2e_` prefix so leftover records are recognizable and sweepable.

---

## 5. Isolation rules (the heart of parallel safety)

1. **Baseline is read-mostly.** Tests may _read_ the seeded writer/pieces/taxonomy. They **MUST NOT**
   mutate a seeded record another test relies on — e.g. don't publish/unpublish the sample pieces if a
   read-only feed test asserts they're present.
2. **Never mutate the shared auth account.** The writer behind `.auth/frontend.json` and the super-admin
   behind `.auth/admin.json` are shared across all specs and engines. A test that changes their
   password, email, roles, or status breaks every later test. **Use a throwaway user instead** (§6).
3. **Own what you create.** A test asserts only on records it created (by unique id/title), never on
   counts or "the first card" that depend on global state.
4. **No cross-test ordering.** ([02 §6](./02_Conventions.md).)

---

## 6. Throwaway users — for account-mutating and second-actor flows

When a test must **mutate an account** (change password, get suspended, delete account) or needs a
**second actor** (follow, report, collaborate), it creates a fresh user via the `api` fixture and, if it
needs to act as them in the browser, logs in within the test:

```ts
test('a user can change their own password and log in with the new one', async ({
  page,
  api,
  data,
}) => {
  const u = await api.createVerifiedUser({ email: data.email(), password: 'OldPass!123' });
  await new LoginPage(page).loginAs(u.email, 'OldPass!123');
  await new SettingsPage(page).changePassword('OldPass!123', 'NewPass!456');
  await new SettingsPage(page).logout();
  await new LoginPage(page).loginAs(u.email, 'NewPass!456'); // proves the change took
  await expect(page).toHaveURL('**/feed');
});
```

**Why not use the shared writer:** mutating the shared writer's password invalidates every other
frontend test's `storageState`. A throwaway user is disposable by definition.

---

## 7. Cleanup — soft-delete only, never hard-delete

> This section is governed by the binding data-safety guard rails in
> [09_DataSafetyGuardrails](./09_DataSafetyGuardrails.md). The short version: **the test suite never
> hard-deletes data and never issues destructive DDL.** Isolation comes from unique data, not deletion.

Default posture: **create-and-leave with unique data**. Per-test records carry unique suffixes (§4) and
tests assert only on records they created (§5), so accumulated data never causes collisions — which means
**no deletion is needed for isolation at all.** This is the primary mechanism.

- **When a test must remove a record** (e.g. testing the delete flow itself, or cleaning an expensive
  globally-visible artifact), it uses the app's **soft-delete** path only — the same `DELETE` endpoint a
  user hits, which sets `deletedAt` via TypeORM `softRemove`/`@DeleteDateColumn`
  (`backend/src/common/base/audit.entity.ts`). The row **stays** in the database, flagged deleted. A
  delete-flow test then _asserts_ the record is soft-deleted (gone from the default view, still present
  `withDeleted`), which is a stronger assertion than "the row vanished".
- **CI:** each run gets a **fresh ephemeral Postgres service container** — a throwaway container discarded
  when the job ends. The suite issues **no `DROP DATABASE`**; the clean slate comes from provisioning a
  new container, not from deleting data. (See [09 §4](./09_DataSafetyGuardrails.md) on the
  provisioning-vs-test-operation distinction.)
- **Local:** `pnpm e2e:reset` re-provisions a fresh local E2E container/volume (infra provisioning, not a
  test-issued delete) when local data gets noisy. It never runs against a shared DB.

**Rules (MUST NOT):**

- Never point E2E at a shared/staging/prod database. `stack-up.sh` uses a dedicated E2E `DATABASE_URL`;
  the e2e-fixtures seed refuses `NODE_ENV=production` ([§3.2](#32-rules-must)).
- Never hard-delete a record, never `TRUNCATE`, never `DROP`/`ALTER ... DROP COLUMN` from test or seed
  code. Full rationale and the enforced list: [09_DataSafetyGuardrails](./09_DataSafetyGuardrails.md).

---

## 8. Data the suite must NOT depend on

- **Exact counts** of feed items, search results, notifications — they shift as tests add data. Assert
  on _your_ unique record's presence, not on totals.
- **Ordering** of lists unless the feature guarantees it (and then assert the guarantee explicitly).
- **Timing-derived values** (relative timestamps like "2 minutes ago") — assert the record exists, not
  its humanized time string.
- **Wall clock** for uniqueness — use worker+counter (§4). **Why:** clock collisions under parallelism
  are the classic source of "passes alone, fails in CI".

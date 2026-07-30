# E2E 09 — Data-Safety Guard Rails

> **Status:** Binding — the strictest rules in this suite. The E2E suite exercises real workflows against
> a real database. This document sets the **non-negotiable guard rails** that keep it from ever
> destroying data or schema: **soft-delete only, never hard-delete; never destructive DDL (no dropped
> databases, tables, or columns).** A reviewer blocks any PR — spec, fixture, seed, script, or migration
> touched by the E2E effort — that violates a rule here. Grounded in the backend soft-delete convention:
> `@DeleteDateColumn`/`deletedAt` on `backend/src/common/base/audit.entity.ts`, `softRemove`/`softDelete`
> in repositories, `withDeleted` reads.

---

## 1. Why these guard rails exist

E2E is the one test layer that touches a real, persistent database through real destructive-looking
operations (delete a piece, remove a user, take down content). Two failure modes must be made
**impossible**, not merely unlikely:

1. **Silent data loss** — a test (or a careless cleanup helper) hard-deletes rows, so a bug where the app
   _should_ soft-delete but actually hard-deletes goes undetected, or real data disappears if the suite is
   ever mis-pointed.
2. **Schema destruction** — a test/seed/migration run during E2E drops a table or column, corrupting the
   database and, worse, normalizing "E2E drops things" as acceptable.

The project already mandates soft-delete and expand-contract migrations (`project-conventions`,
`docs/16`, the `migration-reviewer` gate). These guard rails make E2E **honor and verify** that policy
instead of quietly circumventing it.

---

## 2. The rules (MUST)

### 2.1 Soft-delete only — never hard-delete

- Test and fixture code **MUST NOT** hard-delete any record. Removal happens exclusively through the
  app's **soft-delete** path (the same `DELETE` endpoint a user hits → `softRemove`/`@DeleteDateColumn`),
  which sets `deletedAt` and leaves the row in place.
- The `api` fixture **MUST NOT** expose a hard-delete helper. Its delete methods call the app's real
  (soft) delete endpoints only. There is no `api.hardDelete(...)`.
- Direct SQL `DELETE` from test/seed/script code is **banned**. (Reads are fine; writes go through the
  app/services, never raw `DELETE`.)

### 2.2 No destructive DDL — never drop DB, table, or column

The following are **banned** anywhere in the E2E effort (specs, fixtures, seeds, `scripts/*.sh`, and any
migration authored to support E2E):

- `DROP DATABASE`, `DROP SCHEMA`
- `DROP TABLE`, `TRUNCATE`
- `ALTER TABLE ... DROP COLUMN`, column-type narrowing, `DROP CONSTRAINT` on populated tables
- Any TypeORM `synchronize: true` / `dropSchema: true` against the E2E database

**Why include `TRUNCATE`:** it is a hard, unrecoverable data wipe — the exact thing we're forbidding,
just table-wide. Isolation comes from unique data ([04 §5](./04_TestData.md)), never from truncation.

### 2.3 Delete flows are tested by asserting the soft-delete happened

A test for a delete/removal/takedown feature **MUST** assert the record is **soft-deleted**, not absent:

- gone from the default (non-deleted) view the user sees, **and**
- still retrievable `withDeleted` (via the `api` fixture) with a non-null `deletedAt`.

```ts
test('a writer deletes a draft and it is soft-deleted, not destroyed', async ({
  page,
  api,
  data,
}) => {
  const piece = await api.asWriter().createPiece({ title: data.pieceTitle(), status: 'draft' });
  await new DraftsPage(page).delete(piece.id); // app's soft-delete path
  await new DraftsPage(page).expectNotListed(piece.id); // gone from the user's view
  const row = await api.getPieceWithDeleted(piece.id); // still in the DB
  expect(row.deletedAt).not.toBeNull(); // soft-deleted, not hard-deleted
});
```

**Why this is stronger:** asserting "the row is gone" would _pass_ even if the app wrongly hard-deleted.
Asserting "gone from view **and** `deletedAt` set" proves the app did the right thing — this test would
**catch** a regression from soft- to hard-delete, which is exactly the class of bug we care about.

### 2.4 Migrations run during E2E are the real forward migrations only

`stack-up.sh` runs `migration:run` (the app's committed, expand-contract-safe migrations) and nothing
else. E2E **MUST NOT** author or run ad-hoc migrations that drop/narrow schema to "reset" state. If a
migration under review contains destructive DDL, that's a `migration-reviewer` concern
(`docs/e2e/07` defers to the existing migration gate), independent of E2E.

---

## 3. Isolation without deletion

Because deletion is off the table as an isolation mechanism, isolation rests entirely on:

1. **Unique per-test data** — every created record has a worker+counter suffix ([04 §4](./04_TestData.md)),
   so parallel workers and all three engines never touch the same row.
2. **Assert on your own records** — never on counts or "the first item", which drift as data accumulates
   ([04 §5, §8](./04_TestData.md)).
3. **Read-mostly baseline** — seeded records are read, never mutated in a way another test depends on
   ([04 §5](./04_TestData.md)).

Accumulated (never-deleted, sometimes soft-deleted) rows are **harmless** under this model — nothing keys
off totals, so growth doesn't cause failures. This is why "create-and-leave" is the default and deletion
is rare.

---

## 4. The one sanctioned clean slate: infra provisioning ≠ a test operation

There is a deliberate, bright line between two different things:

| Action                                                                   | Category               | Allowed?   |
| ------------------------------------------------------------------------ | ---------------------- | ---------- |
| A test/seed/script deleting rows, truncating, or dropping schema         | **Data operation**     | ❌ Banned  |
| Discarding a throwaway **container/volume** and provisioning a fresh one | **Infra provisioning** | ✅ Allowed |

- **CI** gets its clean database by starting a **fresh ephemeral Postgres service container** each run and
  discarding it when the job ends. The suite issues **no** `DROP DATABASE` — the clean slate is a _new
  container_, not a deletion we perform.
- **Local** `pnpm e2e:reset` re-provisions the local E2E container/volume for the same reason. It is a
  developer infra command, never invoked by test code, and never targets a shared DB.

**Why this line is safe:** the guard rails exist to protect _persistent data and schema_ from being
destroyed by test logic. A throwaway container that never held anything but disposable fixtures is not
persistent data — recreating it is provisioning, the same as `docker compose up`. What we forbid is any
operation that could destroy data **in a database we didn't just spin up for this run** — which is why
pointing E2E at a shared/staging/prod DB is itself banned ([04 §7](./04_TestData.md), [§2.4](#24-migrations-run-during-e2e-are-the-real-forward-migrations-only)).

> If you want even the ephemeral-container reset constrained further (e.g. keep volumes across runs and
> rely purely on unique data), that's a one-line change to `stack-up.sh`; flag it and we adjust. The
> guard rails above hold regardless.

---

## 5. Enforcement

- **Review checklist (blocking):** any diff in the E2E effort is scanned for `DELETE`/`DROP`/`TRUNCATE`/
  `ALTER ... DROP`/`synchronize`/`dropSchema`/`hardDelete`/`.remove(` (TypeORM hard remove). A hit
  requires either removal or a written, reviewer-approved justification (there is essentially never one
  for test code).
- **API-fixture shape:** the `api` fixture is authored with **no** hard-delete/truncate method, so tests
  physically cannot call one ([02 §3](./02_Conventions.md), [§2.1](#21-soft-delete-only--never-hard-delete)).
- **Seed guard:** the e2e-fixtures seed refuses `NODE_ENV=production` and performs inserts/upserts only —
  no deletes ([04 §3.2](./04_TestData.md)).
- **Optional lint (recommended):** an ESLint `no-restricted-syntax`/`no-restricted-properties` rule in the
  `e2e/` package flags `.remove(`, `hardDelete`, and raw `DELETE`/`DROP`/`TRUNCATE` string literals, so
  the ban is caught at author time, not just review.

---

## 6. Quick reference

```ts
// ✅ allowed — soft-delete via the app, then assert it soft-deleted
await new DraftsPage(page).delete(id); // app DELETE endpoint → softRemove
expect((await api.getPieceWithDeleted(id)).deletedAt).not.toBeNull();

// ❌ banned — hard delete / destructive DDL from test or seed code
await api.hardDelete(id); // no such helper exists (by design)
await db.query('DELETE FROM pieces WHERE ...'); // raw DELETE
await db.query('TRUNCATE pieces'); // hard wipe
await db.query('DROP TABLE pieces'); // schema destruction
await db.query('ALTER TABLE pieces DROP COLUMN body'); // column drop

// ✅ allowed — infra provisioning (not test code): fresh throwaway container per run
//    CI service container / `pnpm e2e:reset` — see §4
```

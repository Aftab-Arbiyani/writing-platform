# E2E 02 — Conventions & Rules

> **Status:** Binding. These are the enforceable house rules for writing E2E tests — the analog of
> `docs/16_CodingStandards.md` for the browser suite. A reviewer blocks a PR that violates a MUST.
> Selector rules are big enough to have their own home: [05_Selectors](./05_Selectors.md). Data rules:
> [04_TestData](./04_TestData.md). Auth rules: [03_AuthStrategy](./03_AuthStrategy.md).

---

## 1. Structure conventions

### 1.1 One spec file per workflow area, one `test()` per journey

`tests/frontend/writing.spec.ts` holds the writing journeys; each `test()` is one complete
user journey (draft → publish), not one assertion. Group related journeys with `test.describe`.

**Why:** a journey is the atomic unit of E2E value; splitting a journey across tests couples them
through shared state and order, which breaks parallelism.

### 1.2 The spec reads as intent; the page object holds the mechanics

```ts
// ✅ GOOD — the spec is a readable user story
test('writer publishes a draft and sees it in the feed', async ({ page, data }) => {
  const editor = new EditorPage(page);
  const title = data.pieceTitle(); // unique per test (04)
  await editor.goto();
  await editor.writePiece({ title, body: 'Hello world.' });
  await editor.publish();
  await new FeedPage(page).expectPieceVisible(title);
});
```

```ts
// ❌ BAD — mechanics leak into the spec; a UI change breaks every spec
test('publish', async ({ page }) => {
  await page.goto('/write');
  await page.locator('input.ant-input').first().fill('T');
  await page.locator('.ProseMirror').fill('body');
  await page.getByRole('button', { name: 'Publish' }).click();
  await page.waitForTimeout(2000); // ❌ sleep
  await page.goto('/feed');
  expect(await page.locator('.piece-card').count()).toBeGreaterThan(0); // ❌ not user-visible, not specific
});
```

**Rule (MUST):** no CSS/DOM selectors in `tests/**`. Selectors live only in `pages/**`.

### 1.3 Naming

- Spec files: `kebab-case.spec.ts` named by area (`moderation.spec.ts`).
- Page objects: `PascalCasePage` in `pages/<app>/` (`ModerationPage`), one class per screen/region.
- `test()` titles: a full sentence describing the user outcome — _"admin suspends a user and the user
  can no longer log in"_, not _"suspend test"_. **Why:** the title is what shows in the report and the
  failure notification; it must say what broke without opening the file.

---

## 2. Page Object rules

A Page Object (PO) is a class wrapping one screen or major region. It exposes **intent methods**
(`writePiece`, `publish`, `approveTopItem`) and **assertion helpers** (`expectPieceVisible`), and hides
all locators.

```ts
export class EditorPage {
  constructor(private readonly page: Page) {}

  // locators are private getters — defined once, reused
  private get titleInput() {
    return this.page.getByLabel('Title');
  }
  private get body() {
    return this.page.getByRole('textbox', { name: 'Story body' });
  }
  private get publishBtn() {
    return this.page.getByRole('button', { name: 'Publish' });
  }

  async goto() {
    await this.page.goto('/write');
    await expect(this.titleInput).toBeVisible();
  }

  async writePiece({ title, body }: { title: string; body: string }) {
    await this.titleInput.fill(title);
    await this.body.click();
    await this.body.pressSequentially(body); // TipTap needs real key events (05 §4)
  }

  async publish() {
    await this.publishBtn.click();
    await expect(this.page.getByText('Published')).toBeVisible(); // confirm the outcome
  }
}
```

Rules:

- **MUST** take `page` (or a `Locator` root for a region PO) in the constructor; never create its own.
- **MUST** define each locator once (private getter/field). No duplicated locator strings.
- **SHOULD** end an intent method by waiting for its own completion signal (a toast, a nav) so the
  caller doesn't have to. **Why:** callers can't know a method's internal timing; the method does.
- **MUST NOT** assert business logic beyond the screen's concern — cross-screen assertions belong in
  the spec (which composes multiple POs).
- **SHOULD** return a value or the next PO where it models a navigation (`return new FeedPage(page)`).

---

## 3. Fixtures — the shared harness

E2E extends Playwright's base `test` once, in `fixtures/test.ts`, adding project-wide fixtures. Specs
import `test`/`expect` **from `fixtures/test.ts`**, never from `@playwright/test` directly.

```ts
// fixtures/test.ts
import { test as base, expect } from '@playwright/test';
import { ApiHelper } from './api';
import { DataFactory } from './data';

export const test = base.extend<{ api: ApiHelper; data: DataFactory }>({
  api: async ({ request }, use) => {
    await use(new ApiHelper(request));
  },
  data: async ({}, use, testInfo) => {
    await use(new DataFactory(testInfo));
  }, // worker-index aware
});
export { expect };
```

| Fixture | Purpose                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page`  | Playwright's authed page (project supplies `storageState`) — starts logged in.                                                                    |
| `api`   | Typed REST helper to the backend — **arrange** state fast (create a piece to moderate) and **assert** side effects (entitlement granted). See §4. |
| `data`  | Unique-data factory (timestamp + worker index) so parallel runs never collide (04).                                                               |

**Rule (MUST):** all specs `import { test, expect } from '../../fixtures/test'` (relative). A spec that
imports from `@playwright/test` loses the fixtures and is rejected in review.

---

## 4. Arrange via API, act via UI, assert via UI (+ API for side effects)

The fastest, most stable pattern:

- **Arrange** preconditions through the **API** (`api.createPiece(...)`, `api.createReport(...)`) —
  _not_ by clicking through the UI to set up state. **Why:** setting up a moderation test by having a
  user write+publish+report through the UI is slow and couples the moderation test to the writing UI.
- **Act** through the **UI** — the behavior under test is always exercised in the browser.
- **Assert** on **UI** outcomes primarily; use the **API** to confirm server-side side effects the UI
  doesn't surface (e.g. after "suspend user", `api.getUser(id)` shows `status: suspended`).

```ts
test('admin approves a reported piece and it disappears from the queue', async ({
  page,
  api,
  data,
}) => {
  const piece = await api.asWriter().createPiece({ title: data.pieceTitle(), status: 'published' });
  await api.asReader().reportPiece(piece.id, 'spam'); // arrange via API
  const queue = new ModerationPage(page);
  await queue.goto();
  await queue.approve(piece.id); // act via UI
  await queue.expectNotInQueue(piece.id); // assert via UI
  expect((await api.getPiece(piece.id)).moderationStatus).toBe('approved'); // assert side effect via API
});
```

---

## 5. Waiting & assertions

- **MUST** use web-first, auto-retrying assertions: `await expect(locator).toBeVisible()`,
  `toHaveText`, `toHaveURL`, `toHaveCount`. **Never** `expect(await locator.count())` for presence.
- **MUST NOT** use `page.waitForTimeout()` / arbitrary sleeps. Wait for a _condition_
  (`await expect(...).toBeVisible()`, `await page.waitForURL('/feed')`,
  `await page.waitForResponse(...)`), never a duration.
- **SHOULD** assert the _specific_ outcome, not a generic one. `expectPieceVisible(title)` (by unique
  title) not `expect(cards).toHaveCount(1)` (brittle to seed data).
- **SHOULD** prefer asserting user-visible text/state over network. Assert on network
  (`waitForResponse`) only when there is no visible signal.

---

## 6. Isolation & parallelism rules

- Every test **MUST** pass in isolation and in any order. No test depends on another having run.
- Every test **MUST** create its own data with unique suffixes ([04](./04_TestData.md)); never rely on,
  or mutate, another test's records.
- The **seeded baseline is read-mostly**: tests may _read_ seeded users/pieces but **MUST NOT** mutate
  seeded records in a way another test depends on (e.g. don't suspend the shared writer — create a
  throwaway user to suspend).
- `test.describe.serial` is **banned** except with a written justification in a comment. **Why:** serial
  blocks reintroduce order-dependence and kill parallelism; they're a last resort for genuinely
  sequential UI (a multi-step wizard that can't be API-seeded mid-way).

---

## 7. Timeouts, retries, and flake

- Global timeouts are set in config ([01 §5](./01_Architecture.md)); a spec that needs more time
  **MUST** justify it inline (`test.setTimeout(60_000); // AI generation can take up to 45s`).
- **Retries are CI-only.** A test that only passes on retry is **flaky** and gets a `@flaky` tag +
  tracking issue, per [08_Runbook flake policy](./08_Runbook.md). Retries are a diagnostic safety net,
  not a fix.
- **No conditional skips based on data** (`if (!piece) test.skip()`) — that hides a broken arrange step.
  Arrange must be deterministic.

---

## 8. TypeScript & lint

- The `e2e/` package is `strict: true` like the rest of the monorepo (`docs/16 §1`). No `any`
  (`unknown` + narrow at boundaries). Explicit return types on exported PO methods.
- Reuse `@qalam/api-types` for API-helper request/response shapes so E2E breaks at compile time when the
  frozen `v1` contract changes. **Why:** a contract drift should fail `tsc`, not a mystery runtime 400.
- ESLint + Prettier from the shared config apply; the post-edit hook formats on save.

---

## 9. Anti-patterns (seen in real E2E suites — never ship these)

| Anti-pattern                                           | Instead                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `waitForTimeout(3000)`                                 | Wait for a condition (visible / URL / response).                                            |
| CSS/XPath selectors in specs                           | Role/label/test-id via a page object ([05](./05_Selectors.md)).                             |
| Logging in through the UI in every test                | `storageState` reuse ([03](./03_AuthStrategy.md)).                                          |
| Setting up state by clicking through unrelated UIs     | Arrange via `api` fixture (§4).                                                             |
| Asserting on `.count() > 0` or seed-dependent counts   | Assert on unique per-test data by its unique identifier.                                    |
| `test.only` committed                                  | `forbidOnly: CI` fails the build ([01 §5](./01_Architecture.md)).                           |
| One giant test doing five journeys                     | One `test()` per journey.                                                                   |
| Sharing a mutable variable across tests in a file      | Per-test `data` fixture; no module-level mutable state.                                     |
| Re-testing pure component logic already in Vitest      | Delete it — E2E covers integration, not units ([00 §1.1](./00_Overview.md)).                |
| Hard-deleting / truncating rows to "clean up"          | Soft-delete via the app + unique data for isolation ([09](./09_DataSafetyGuardrails.md)).   |
| `DROP`/`TRUNCATE`/`ALTER … DROP COLUMN` to reset state | Fresh ephemeral container (infra), never a data op ([09 §4](./09_DataSafetyGuardrails.md)). |

# E2E 08 — Runbook

> **Status:** Operational reference. How to run, debug, and maintain the browser E2E suite day to day —
> the analog of `docs/20_Runbook.md` for E2E. Commands assume the `e2e/` package and scripts from
> [01_Architecture](./01_Architecture.md) exist.

---

## 1. First-time setup

```bash
pnpm install                                   # installs @playwright/test in e2e/
pnpm --filter e2e exec playwright install       # download all three browser engines
cp e2e/.env.example e2e/.env                    # optional cred/base-url overrides
```

`playwright install` (no `--with-deps`) is enough locally on a dev machine that already has GUI libs;
CI uses `--with-deps <browser>` per matrix leg ([07 §2](./07_CI.md)).

---

## 2. The full local loop

```bash
pnpm e2e:up            # bring up infra+backend, migrate, seed + seed:e2e (stack-up.sh)
pnpm e2e:ui            # Playwright UI mode — pick tests, watch them run, time-travel
# ...iterate...
pnpm e2e:down          # tear the stack down
```

Headless full run:

```bash
pnpm e2e:up && pnpm e2e && pnpm e2e:down        # one-shot, all projects, all 3 engines
```

Reset noisy local data:

```bash
pnpm e2e:reset          # drop + recreate + re-migrate + re-seed the E2E database
```

---

## 3. Running subsets

```bash
# one app, one engine
pnpm --filter e2e exec playwright test --project=frontend-chromium

# one engine, both apps
pnpm --filter e2e exec playwright test --project=frontend-webkit --project=admin-webkit

# one spec file
pnpm --filter e2e exec playwright test tests/frontend/auth.spec.ts

# one test by title
pnpm --filter e2e exec playwright test -g "publishes a draft"

# one phase (tags — see 06 §8)
pnpm --filter e2e exec playwright test --grep @phase2

# headed (watch the real browser)
pnpm --filter e2e exec playwright test --project=frontend-chromium --headed

# debug (Playwright Inspector, step through)
pnpm --filter e2e exec playwright test tests/frontend/writing.spec.ts --debug
```

---

## 4. Authoring with codegen

```bash
pnpm --filter e2e exec playwright codegen http://localhost:5173     # frontend
pnpm --filter e2e exec playwright codegen http://localhost:5174     # admin
```

Codegen records clicks into selector suggestions — **use it to discover selectors, then rewrite** into a
page object with the priority order from [05_Selectors](./05_Selectors.md). **Never** paste codegen's raw
CSS output into a spec; codegen doesn't know our role/testid conventions.

---

## 5. Debugging a failure

1. **Read the failing assertion** — web-first assertions print what they waited for and what they got.
2. **Open the trace:**
   ```bash
   pnpm --filter e2e exec playwright show-trace e2e/test-results/<path>/trace.zip
   ```
   The trace viewer gives a step-by-step timeline with a DOM snapshot at each action, network log,
   console output, and the exact failing locator highlighted. This is the primary tool.
3. **Watch the video** (`test-results/<path>/video.webm`) for the whole-test view.
4. **Reproduce headed + slow:**
   ```bash
   pnpm --filter e2e exec playwright test <spec> --project=<proj> --headed --debug
   ```
5. **From CI:** download the `playwright-report-<browser>-shard<n>` artifact ([07 §5](./07_CI.md)),
   unzip, `playwright show-report` — same trace/video locally.

### 5.1 Engine-specific failures

If a spec passes on Chromium but fails on WebKit/Firefox, suspect: contenteditable/key-event handling
([05 §4](./05_Selectors.md)), timing (add a proper `expect(...).toBeVisible()` wait, never a sleep),
date/locale formatting, or a CSS feature. Reproduce with `--project=frontend-webkit --headed`. These are
**real bugs our users would hit** — the reason we run all three engines. Fix the app or the wait; don't
skip the engine.

---

## 6. Flake policy (binding — [00 §4.6](./00_Overview.md))

A test that passes only on retry is **flaky = failing**. Procedure:

1. **Quarantine, don't ignore:** tag it `@flaky` and (temporarily) `test.fixme` with a linked tracking
   issue. It stops blocking, but it's _visibly_ broken, not silently green.
2. **Root-cause within the phase** — flake is almost always a missing web-first wait, a shared-state
   mutation ([04 §5](./04_TestData.md)), or a real race in the app.
3. **Fix and un-quarantine.** A phase's exit criteria require **zero** quarantined tests
   ([06](./06_PhasePlan.md)).

There is no "re-run until green" as a resolution. CI retries exist to _surface_ flake in the report, not
to hide it.

### 6.1 Two mechanics of this harness that change how you read a result

Both were learned the hard way while triaging the first real execution of the admin suite
([48 §6.18](../48_PlatformParityRegister.md)).

**`CI=1` turns retries on — so "flaky" in an in-image run means "would fail locally."**
`playwright.config.ts` sets `retries: CI ? 2 : 0`. The pinned-image invocation passes `CI=1`, so a test
listed as **flaky** there failed at least once and passed on a retry; run the same test locally, where
retries are 0, and it is a plain failure. Never report a flaky test as passing, and never quote a
retried pass as verification — §6 above already makes flaky equal to failing, and this is how the two
numbers differ between a local run and an in-image one.

**Playwright WIPES `e2e/test-results/` at the start of every run.** Every per-failure artifact from the
previous run — screenshot, video, trace, `error-context.md` — is deleted the moment the next project
starts. So a four-engine sweep run back to back leaves you the artifacts of the LAST project only, and
the failures you actually wanted to read are gone. **Copy the directory out between projects:**

```bash
npx playwright test --project=admin-chromium
cp -r e2e/test-results /tmp/run-chromium        # BEFORE the next project starts
npx playwright test --project=admin-firefox
```

The `playwright-report/` HTML report survives longer, but it does not carry the per-failure
`error-context.md` DOM snapshot, which is usually the thing that tells you what the page was actually
showing.

### 6.2 "The click was accepted and nothing happened" — read this before you re-run

Learned closing [48 §3.18b](../48_PlatformParityRegister.md), which took fifteen days and four
hypotheses because the harness reported the failing action as a success.

**A successful Playwright click is not evidence the handler ran.** `setupHitTargetInterceptor` verifies
the hit target for the **first** intercepted event only, so `mouseup` and the resulting `click` are never
re-checked. If the element moves or resizes between `mousedown` and `mouseup` — which is exactly what an
entrance animation does — the browser fires `click` at the common ancestor of the two targets, the
element's own handler never runs, and **the action still reports as done**. Symptom: no exception, the
popup still open, and whatever it should have opened simply absent.

**`stable` does not mean "geometry has settled."** It means "unchanged across two animation frames." A
popup in rc-motion's `appear-prepare` state is at full size and perfectly still because the animation has
not begun; it passes every actionability check and then collapses. So a passing actionability check
before an animation proves nothing about geometry during it.

**What to do.** For AntD popups, use `clickAntdMenuItem` / `selectAntdOption` from
`pages/shared/antd.ts` ([05 §5.1](./05_Selectors.md)). For a new animated surface, prefer an interaction
that resolves the **element** at dispatch time over one that resolves a **point**. What NOT to do, per §6
above: raise the timeout, add a `waitForTimeout`, wrap it in a retry, reach for `.first()`, or wait on the
library's motion class names — that last one works today and silently stops working when the class is
renamed.

**And instrument before you theorise.** Three plausible mechanisms were disproved before the right one,
and the deciding evidence took a passive diagnostic that could survive a full parallel run: capture-phase
listeners plus a `MutationObserver`, drained to a directory Playwright does **not** wipe, opt-in behind an
env var so the baseline rate stays unperturbed. A load-dependent defect cannot be debugged in a headed
session, and "it passed at `--workers=1`" is not a diagnosis.

---

## 7. Common problems → fixes

| Symptom                               | Likely cause / fix                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every test fails at login setup       | Backend not up / not seeded. Check `pnpm e2e:up` health + that `seed:e2e` ran ([04 §3](./04_TestData.md)).                                                                                                          |
| `storageState` file missing           | Setup project didn't run — ensure the app project declares `dependencies: ['setup-*']` ([01 §5](./01_Architecture.md)).                                                                                             |
| Authed specs randomly log out mid-run | A spec mutated the shared account. Use a throwaway user ([04 §6](./04_TestData.md)).                                                                                                                                |
| `.fill()` on the editor does nothing  | TipTap contenteditable — use `.click()` + `.pressSequentially()` ([05 §4](./05_Selectors.md)).                                                                                                                      |
| Selector matches multiple elements    | Scope it (`within` a row/dialog); don't `.first()`. AntD portals → use role selectors ([05 §5](./05_Selectors.md)).                                                                                                 |
| Email-flow test can't find the link   | Mailpit not running / wrong `SMTP_URL`. Check the Mailpit container + `utils/mailpit.ts`.                                                                                                                           |
| Passes locally, fails in CI           | Timing (add a proper wait), or wall-clock uniqueness collision — use worker+counter ([04 §4](./04_TestData.md)). CI serves _built_ output; test against `preview` locally to match ([01 §4](./01_Architecture.md)). |
| `test.only` fails CI                  | Intentional — `forbidOnly: CI`. Remove the `.only` ([01 §5](./01_Architecture.md)).                                                                                                                                 |
| Dashboard chart assertion impossible  | echarts renders to canvas — assert DOM tiles/labels + the API data path, not pixels ([05 §6](./05_Selectors.md)).                                                                                                   |
| Whole run is slow locally             | You're running all 3 engines. Narrow with `--project=frontend-chromium` during dev; full matrix in CI.                                                                                                              |

---

## 8. Stack scripts reference

| Script                       | Does                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `e2e/scripts/stack-up.sh`    | `docker compose up -d postgres redis minio mailpit backend` → poll `/health` → `migration:run` → `seed` → `seed:e2e`. |
| `e2e/scripts/stack-down.sh`  | `docker compose down` (keeps volumes unless `--volumes`).                                                             |
| `e2e/scripts/wait-health.sh` | Poll a URL until healthy or timeout (used by both local + CI).                                                        |
| `pnpm e2e:reset`             | stack-down (with volumes) → stack-up (fresh DB).                                                                      |

**Never** point `DATABASE_URL` at a shared/staging/prod DB ([04 §7](./04_TestData.md)). The scripts use a
dedicated E2E database; the e2e-fixtures seed also hard-refuses `NODE_ENV=production`.

---

## 9. Maintenance cadence

- **When a screen changes:** update its page object (one file), not the specs.
- **When a testid is added/renamed:** update the inventory in `e2e/pages/README.md` and the page object
  in the same PR ([05 §3.4](./05_Selectors.md)).
- **When the frozen `v1` API changes:** the `api` fixture types (from `@qalam/api-types`) break `tsc` —
  fix them; that's the contract-drift alarm working as designed ([02 §8](./02_Conventions.md)).
- **Per phase:** update the coverage status and, on phase completion, write the phase note and flip the
  gate policy if due ([06](./06_PhasePlan.md), [07 §6](./07_CI.md)).

# 55 — Admin AI Retrieval Readiness Report (A3)

> ⚠️ **AMENDED BY D5, 2026-09-03** ([48 §5.2](./48_PlatformParityRegister.md#d5--the-ai-surface-is-removed-the-tools-stay-owner-2026-09-02)). The admin config and analytics surfaces survive — they are
> internal, and D5's rename is user-facing only. One field does not: **`synthesisEnabled` is
> retired**. Grounded synthesis is gone from the engine, so the server answers that field with a
> constant `false` and the admin form's Synthesis card is removed in D5's web phase. Everything
> else here — budgets, sources, ranking weights, the analytics window — is current.

**Status:** ✅ **DONE 2026-08-19** · **Row:** [45 §5](./45_WebClientRoadmap.md#5-track-a--admin-parallel-with-w-independent) A3 —
retrieval · **Sweep:** [48 §6.20](./48_PlatformParityRegister.md) · **Findings:** [48 §3.20](./48_PlatformParityRegister.md)

A3 gives the admin panel the two AF4 surfaces it never had: the **retrieval config** an operator tunes
search, ranking and budgets with, and the internal **search analytics** that says whether retrieval is
working. It is the last unheld row on either track — Track W is complete, A1/A2 shipped, A4 stays parked
behind the held AF3 analysis lifecycle.

---

## 1. What shipped

| Surface              | Route                           | Reads / writes                                    |
| -------------------- | ------------------------------- | ------------------------------------------------- |
| **Retrieval config** | `/ai-settings/search-config`    | `GET` + `PUT /admin/ai/search-config`             |
| **Search analytics** | `/ai-settings/search-analytics` | `GET /admin/ai/search-analytics?windowDays=1..90` |

Both behind `ai.manage`, both rendered by the **existing** `features/ai` slice rather than a new
feature. That was forced rather than chosen: `admin/src/features/ai/api/ai.api.ts` declares itself "the
only place `/admin/ai/*` endpoints are named", and `AdminRetrievalController` is mounted on `admin/ai`.
A second feature naming those paths would be the duplication that file exists to prevent.

**Placement.** Nested under `/ai-settings` beside the AF1 defaults page, two nav entries in the Platform
group. `minRole: Role.Admin` on the nav and the Admin router floor are exactly the server's `ai.manage`
check expressed in this app's shapes — `ai.*` is granted to Admin and SuperAdmin only
(`DEFAULT_ROLE_PERMISSIONS`), so a moderator sees neither entry and reaches neither route. Each page also
asserts `can(ai.manage)` itself, so a runtime-narrowed grant renders `AccessDenied` rather than an empty
form.

---

## 2. The pre-flight audit — the contract was sound, the aggregation was not

**Sound, and worth stating because it is unusual for this project:** the client types already existed and
already matched. `RetrievalAdminConfig`, `UpdateRetrievalAdminConfig` and `SearchAnalytics`
(`packages/api-types/src/retrieval.ts`) mirror `RetrievalConfigDto` and `SearchAnalyticsDto` field for
field. No enabler was needed to read or write either surface: `ai.retrieval.config` is in the settings
catalogue and editable, `syncDefinitions` guarantees its row exists on any install (so no fresh-database
404), the write goes through the audited settings path, and that path invalidates the settings cache — so
save-then-read is consistent rather than eventually consistent.

**Three defects in A3's own surface, all fixed here.** Retrieval is AF4, added after the 102-path `v1`
baseline (docs/25:155), so these routes were always additive — the same standing B8 established for
`admin/monetization` and B9 for trust. Checking that first is why this row fixed them instead of
recording six open findings, which is the mistake A2 made.

| #        | Severity | What                                                                                          |
| -------- | -------- | --------------------------------------------------------------------------------------------- |
| **A3-1** | medium   | `avgConfidence` was rounded to a whole number, so every possible average reported 0 or 1      |
| **A3-2** | medium   | the window was truncated at 5,000 rows in silence — nothing in the response revealed it       |
| **A3-3** | medium   | `sources` and `rankingWeights` accepted any key and any value, and the planner failed quietly |

Full diagnoses in [48 §3.20](./48_PlatformParityRegister.md). The short version of each:

**A3-1 would have shipped a fabricated number.** `confidence` is a `real` in 0..1 in
`retrieval_query_logs`, and `getAnalytics` passed it through the same integer `mean()` used for
milliseconds and token counts. `Math.round(0.72)` is `1`. The endpoint had no consumer before A3, so
nothing had ever noticed; this dashboard's single most useful figure would have been a coin flip
presented to two decimal places. Fixed with a separate `meanRatio` at the same 3 decimals `ratio()`
already used, leaving latency and context tokens as whole units where a fraction says nothing.

**A3-2 is the "no silent caps" rule broken at the contract level.** `ANALYTICS_ROW_CAP = 5_000`
newest-first is a _good_ design — it keeps a 90-day window bounded. But `totalQueries` is `rows.length`,
so a busy install reports exactly 5,000 requests and every derived rate describes only the newest slice,
and **a client could not detect it**. `truncated: boolean` was added to `SearchAnalyticsData`, the DTO
and `@qalam/api-types`; the dashboard renders a banner naming the sample size. This is the one place A3
extended a contract, and it was extended because an honest UI was otherwise impossible, not for
convenience.

**A3-3 fails in the direction nobody looks.** `@IsObject()` was the only validation, and the settings
layer validates a `json` value only as "is an object" — so `PUT` could persist
`{"rankingWeights":{"popularity":"abc","nonsense":5}}`, permanently, because `update` merges per key and
never prunes. What happens next is the interesting part: the planner selects signals with `weight > 0`,
and `"abc" > 0` is `false`, so **the signal silently leaves ranking** — no throw, no log, no 400, just
worse results. Closed at both ends: `IsSourceToggleTable` / `IsRankingWeightTable` allowlist the enum
keys and check each member (following B8's `IsRateTable` precedent), and `mergeConfig` now drops unknown
keys and falls back per key on an unusable member, which is what protects a row written before the
validators existed.

Two smaller notes, both handled in the UI rather than the API: the `vector` source is **enabled by
default and inert** by design (its retriever reports itself unavailable until an embedding backend
exists), so the form says so — otherwise an operator toggles something that does nothing. And a weight
of **0 disables a signal** rather than treating it neutrally, which the section header now states.

---

## 3. Decisions worth not re-deriving

**The config form submits a full snapshot, not a diff.** The endpoint takes a partial patch, but the read
always answers with every source and every signal, so a snapshot is both simpler and safer: an untouched
weight cannot be lost to an omitted key, and what the operator sees is what the next request plans with.
The form schema is therefore _total_ over both enums — a signal added to `@qalam/shared` fails the build
here rather than rendering an unlabelled input.

**Bounds live in `@qalam/shared`, once.** `RETRIEVAL_CONFIG_BOUNDS` (plus
`SEARCH_ANALYTICS_DEFAULT_WINDOW_DAYS`) is read by `UpdateRetrievalConfigDto`, the controller's window
default and the admin form schema. Before A3 the DTO hardcoded four ranges and documented a fifth
("0..1") that it did not enforce. No control can now offer a value the route rejects, and a bound moves
in one place. Same idiom as AF1's `AI_PARAM_BOUNDS`.

**The E2E write saves the form unchanged, deliberately.** `ai.retrieval.config` is global and read by
every AF4 request, and the suite runs `fullyParallel` while the frontend AF4 specs assert ranked results,
a grounded answer and recommendation shelves. Saving a mutated topK or a disabled source would change
those specs' subject matter mid-run. The round trip still executes the PUT, the audited write, the cache
invalidation and the re-read; what a mutation would additionally prove — that a specific field persists —
is proved where it is safe, in `retrieval-config.service.spec.ts` and the admin unit specs. B8 reached
the same conclusion for `monetization.config` and had its spec cancel rather than save.

**Analytics is not invalidated by a config write.** It aggregates requests that already happened, and a
config change cannot alter the past. Only `qk.ai.searchConfig()` is touched on success.

---

## 4. Gates

| Gate                            | Result                                                              |
| ------------------------------- | ------------------------------------------------------------------- |
| Backend `tsc --noEmit`          | clean                                                               |
| Backend `jest`                  | **155 suites / 1321 tests** (was 152 / 1288 — +3 suites, +33 tests) |
| Admin `pnpm typecheck`          | clean                                                               |
| Admin `eslint --max-warnings=0` | clean                                                               |
| Admin `vitest`                  | **70 files / 400 tests** (+3 files, +37 tests)                      |
| Admin `pnpm build`              | clean (17.4s)                                                       |
| E2E `tsc` + `eslint` + collect  | clean · admin-chromium **84** (was 75), admin-dark **20** (was 18)  |

**And the suite was RUN, against a real stack on this machine** — not collected. That is the gap A1 and
B8 recorded honestly and §6.18 finally closed; A3 is the first admin row where the browser evidence
exists at hand-off.

| Run                                                  | Result                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| `ai-retrieval.spec.ts` (admin-chromium)              | **7/7 pass**                                               |
| new a11y scans, light **and** dark                   | **2/2 + 2/2 pass** (axe, WCAG A + AA, critical + serious)  |
| `rbac.spec.ts` A3 boundary                           | **1/1 pass**                                               |
| whole admin-chromium suite (`--grep-invert @visual`) | **77 passed · 1 failed** — the known parallel-load timeout |

That one failure is `moderation.spec.ts`'s takedown journey, which A3 does not touch: it passes in
**10.7s at `--workers=1`**, and §6.18 already recorded this file as the run's intermittent
contention failure. Verified rather than assumed, because "not mine" is exactly the claim that deserves
a second run.

One spec defect was found by running it, and it is the §6.18 lesson repeating: the window `Select` was
driven with `getByRole('combobox').click()`, which AntD intercepts with its own
`<span class="ant-select-selection-item">` overlay. The suite already has `selectAntdOption` for this
(docs/e2e/05 §5). Nothing in `tsc`, `eslint` or `--list` could have told me.

---

## 5. Visual baselines

**One candidate, deliberately unminted:** `admin-ai-search-config.png`, pending across chromium /
firefox / webkit / dark. Only the web-e2e workflow's visual job may mint a baseline, in the pinned image
([e2e/10 §5]); a locally produced PNG bakes in this machine's fonts and would fail CI forever. Until it
is minted that test fails on a missing snapshot, which is the intended visible state.

Determinism was checked first, as A1 requires. The **config editor** is deterministic — a fixed grid of
four switches and nine inputs, no date, no count, and the only spec that writes its settings row is A3's
own round trip, which saves unchanged. **Search analytics is excluded**: its figures come from telemetry
the frontend AF4 specs generate in parallel, and the empty-vs-populated branch changes the page's
structure and height, so masking cannot rescue it — the same reason A1's three dashboards are excluded.

**The existing baselines survive, and this was measured rather than assumed.** Adding two nav entries
looks like it must invalidate `admin-users.png` and `admin-analytics.png`, which are viewport shots
including the nav rail. It does not: the entries land at **y ≈ 879 and 933** in a **720 px** viewport,
below the fold, and a vertical scroll container cannot move what sits above an insertion. Probed with a
throwaway spec reading their bounding boxes. The billing entries below them shifted down and were
already off-shot.

---

## 6. What A3 did not do

- **No new feature directory.** Both surfaces live in `features/ai`, for the reason in §1.
- **No AF3 admin surface.** `story-intelligence` has no admin controller at all, so A4 remains a backend
  expansion entangled with the held analysis lifecycle ([45 §4.8](./45_WebClientRoadmap.md)).
- **No mobile counterpart, and none is owed.** Admin is the one permanent "not applicable" for the parity
  rule: no mobile admin app exists, `ai.manage` is an operator permission, and the frontend is the
  customer side of the same platform (48 §4).
- **No fix for 48 §3.19** (the admin error catalogue's missing `USER_NOT_FOUND`), which is still open and
  belongs to whoever touches that copy.
- **A fifth local `AsyncSection`.** The deletability rule forbids a feature importing another feature, so
  `features/ai` gets its own copy — after Operations, Security, System and monetization. Five is the
  number at which the refactor to `src/components/` stops being hypothetical, and it is recorded as a
  finding rather than repeated silently ([48 §3.20](./48_PlatformParityRegister.md) A3-4).

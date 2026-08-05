# 52 — W8 AI Surfaces Readiness Report

**Epic:** W8 — remaining AI surfaces (AF1/AF2) ([45 §4](./45_WebClientRoadmap.md), row W8) ·
**Status:** ✅ complete, verified against a running stack · **Date:** 2026-08-05

> **What this closes.** The roadmap row names three mobile-shipped surfaces that no W row owned:
> AI conversations, the prompt library, and AI usage. It lists them as "both clients", but mobile ships
> all three, so this was a mobile → web port rather than a new feature.
>
> **Except in one respect, which the step-0 audit turned up and which changed how C1 had to be built.**
> Mobile ships the conversations screen and **cannot populate it**: `createConversation` exists in all
> three of its layers with zero UI callers, and the completion route declines to create a conversation
> it was not handed one for. So the list is empty on mobile forever, and "port what mobile has" would
> have reproduced a surface that cannot fill. Web builds the create path — which C1 already named —
> making web the working reference for this surface (48 §3.12, W8-1).

---

## 1. What shipped

| Surface                 | Route                            | Delivered                                                                                                                                       |
| ----------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI hub**              | `/settings/ai`                   | The entry point: one settings-nav section, four linked cards, and the server's master-AI-flag state reported rather than hidden.                |
| **Conversations**       | `/settings/ai/conversations`     | List (cursor-paginated, newest first), **create**, rename, delete-with-confirm, export-as-download, and a client-side filter over loaded rows.  |
| **Conversation detail** | `/settings/ai/conversations/:id` | Full message history in order, per-message token usage on assistant turns, export, and a way back. Read-only by design (§3.2).                  |
| **Prompt library**      | `/settings/ai/prompts`           | The seven built-in presets ported verbatim, plus favourites, custom presets, and copy-history — all device-local, because that is the contract. |
| **AI token usage**      | `/settings/ai/usage`             | `GET /ai/usage/me`: three windows with honest caps, the input/output split, and the lifetime per-feature breakdown.                             |

### 1.0 Two additions beyond the row, and why they were not optional

Both were added after the three surfaces were built and green, on the user's instruction to act on the
improvements rather than only list them. Each closes a hole that would otherwise have shipped.

**1. The assistant can be bound to a conversation** (`hooks/use-assistant-conversation.ts`).

Building C1 surfaced the fact that **web had the same disease as mobile, one layer over.** The
orchestrator persists a turn only when the completion carried a `conversationId` — `persist()` returns
early otherwise (`ai-completion.service.ts:338`) — and nothing on web ever sent one. So the "New
conversation" button C1 requires would have produced rows that could **never gain a message**: a
conversations list that fills up with permanent blanks is barely better than mobile's list that never
fills at all (W8-1). Shipping C1 without this would have satisfied the row's wording and missed its point.

The binding lives in the **URL** (`/write?conversation=<id>`), per docs/12 §3 — it survives a reload,
and it makes a conversation deep-linkable into the editor, which is what "Continue in the editor" on the
detail view uses. It is **opt-in** ("Keep history" in the assistant panel): persisting every assistant
turn by default would quietly accumulate a server-side transcript of a writer's drafts.

**2. A preset can be sent straight to the assistant** (`sendToAssistant` / `takePendingInstruction`).

Mobile can only copy a preset to the clipboard (`prompt_library_screen.dart:92,116`), and a clipboard
write needs a secure context and can be refused outright — so on mobile a blocked clipboard means the
prompt library has no output at all. Web keeps Copy (text is sometimes wanted elsewhere) and adds **Use
in assistant**, which puts the instruction into the editor's Ask AI field directly. The hand-off is
transient and excluded from persistence via `partialize`: a stored one would prefill Ask AI days later,
on a draft it was never chosen for. Nothing is sent — the field is filled, and the writer still edits
and decides when to run it.

### 1.1 Data layer

Five of the seven routes already had an api method and a hook from AF1. W8 added the two that did not
(`PATCH /ai/conversations/:id`, `GET /ai/conversations/:id/export`), a rename mutation with deliberate
two-key invalidation, an export mutation, and the download helper the export route requires because it
returns JSON rather than a file.

### 1.2 Wire package

`@qalam/api-types` gained `UpdateAiConversationRequest`, `AiConversationExport` and
`AiConversationExportMessage`. The first is now **pinned to `UpdateAiConversationDto`** by the §3.11
contract guard (72 tests green, up from 71); the two export shapes are exempted by name with a reason,
because the handler returns `Promise<Record<string, unknown>>` and there is no DTO to pin against.

---

## 2. The step-0 audit, and what it found

[45 §4.4](./45_WebClientRoadmap.md) requires a contract audit before a client line is written. AF5/AF6
were audited in 48 §3.6/§3.2 and AF4 in §3.9; the AF1/AF2 conversation and usage shapes never had been.
Full record in [48 §3.12](./48_PlatformParityRegister.md); the short version:

**Mobile's client is field-for-field correct on all seven routes.** Same paths, same keys, same envelope
handling, same 204 handling. There is no drift to fix and nothing to build from a contract — the audit's
verdict was **PORTABLE** for all three surfaces. What it found instead were four behaviour defects and
one accessibility defect, none of them a wire mismatch:

| #        | Severity | Finding                                                                                            | Fixed by W8?                                                      |
| -------- | -------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **W8-1** | medium   | Mobile can never create a conversation, so all six routes are unreachable in the product           | No — mobile row. Web builds the create path.                      |
| **W8-2** | medium   | `PATCH status:'archived'` returns 200 and hides nothing; the row returns on the next refresh       | No — needs a backend status filter. Web ships no archive control. |
| **W8-3** | low      | The same conversation publishes its messages in two different shapes (detail vs export)            | No — web types the two separately.                                |
| **W8-4** | low      | The PATCH body and the export payload sit outside the api-types guard                              | Half — the PATCH body is now pinned.                              |
| **W8-5** | medium   | A hovered `variant="primary"` button is 4.37:1 — W3c-3's colour, on the half that was never pinned | No — shared design token, needs its own row.                      |

W8-1 and W8-2 were both **confirmed live**, not inferred from reading code — see §5.

---

## 3. Decisions worth stating

### 3.1 Placement: a settings section, not mobile's editor menu

Mobile hangs all three off the editor's AI menu (`editor_screen.dart:442-446`), which is right for a
phone where the editor is the whole screen. Web already has a home for account-scoped management
surfaces and Billing set the pattern — one nav entry per section, sub-pages reached from a hub. Copying
mobile's shape would have buried three routes in an editor menu on a client whose editor is one route
of many, and left them unreachable to anyone not currently writing.

The in-editor assistant (W2) stays where it is and is linked _from_ the hub rather than moved: it needs
the manuscript, and these three do not.

### 3.2 The detail view is read-only

Mobile can continue a conversation from its detail screen. Web deliberately cannot. A chat box on a
settings page is an assistant with no manuscript in front of it — a second, weaker entry to a capability
the editor already offers properly. Recorded as an accepted layout difference, not a gap.

### 3.3 No archive control, though the DTO accepts one

`UpdateAiConversationDto` takes `status`, and it persists. It also hides nothing: the list query filters
on `user_id` alone, and `ConversationListQueryDto` offers no way to ask for active-only either (W8-2).
An archive button would report success and change nothing the user can see — mobile's does exactly that.
Archive is not in C1's scope, so web ships without it, and the E2E suite **asserts the absence** so the
omission is deliberate rather than forgotten. If the backend gains a status filter, that assertion is
what should change.

### 3.4 AI usage is a second page, not a merge — and the overlap is real

`GET /ai/usage/me` (AF1 token telemetry) and `GET /monetization/usage` (the AF5 rollup W4 shipped at
`/settings/billing/usage`) overlap visibly: three window cards and a per-feature list each. That was
escalated rather than reconciled unilaterally, and the decision was **a separate, cross-linked page** —
which is also mobile's shipped shape, since it has both `ai_usage_screen` and `usage_dashboard_screen`.

The two now link to each other, each stating what it counts. This is the one part of W8 where a reader
can reasonably be confused, and a link is the difference between "these numbers disagree" and "these
count different things". The AF1 page earns its place by showing what the AF5 rollup cannot: the
input/output token split, and caps that come from `aiConfig` rather than from a plan.

### 3.5 No premium gate on anything

Per [48 §5.2](./48_PlatformParityRegister.md) the backend asserts exactly one premium feature
(`ai_budget`, in `AiUsageMeterService`); the other seven are computed and never enforced. None of these
surfaces is gated on `ai_writing`, `advanced_analytics` or any sibling — a client gate would be a wall in
front of a route the server serves, which is W3c-1 inverted. The AI section is also **not** flag-gated
the way Safety and Billing are: there is no `VITE_ENABLE_AI` kill switch, the master flag is the
server's, and the hub reports what it says rather than hiding itself and leaving a bookmarked URL to 404.

---

## 4. Verification

| Gate                       | Result                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| Frontend unit suite        | ✅ **652 passed** / 113 files (was 592 — **60 new**; the last 12 cover §1.0's two additions) |
| Backend contract guard     | ✅ **72 passed** (was 71 — the new PATCH pin)                                                |
| `npm run typecheck`        | ✅ clean (`tsc --noEmit -p tsconfig.app.json` — **not** bare `tsc --noEmit`, see §4.1)       |
| `eslint --max-warnings=0`  | ✅ clean (frontend + e2e)                                                                    |
| `npm run build`            | ✅ built in 16.76s                                                                           |
| Bundle budget              | ✅ within budget; entry 145.1 kB gzip                                                        |
| E2E functional (chromium)  | ✅ **10/10** W8 tests + **5/5** assistant tests = 15 passed, incl. the two added in §1.0     |
| E2E a11y — light           | ✅ 4 new surfaces clean (critical + serious); AI-matching set **7/7**                        |
| E2E a11y — dark            | ✅ same 4 clean; full dark a11y project **28/28**                                            |
| E2E visual                 | 🔴 **expected red — 3 baselines do not exist.** See §4.2. No baseline was minted.            |
| Live `ai.use` on an old DB | ✅ 200 on all seven routes — §5                                                              |
| webkit                     | ⏸️ **not run** — reported separately, see §4.3                                               |

**One unrelated failure, seen and identified:** `assistant.spec.ts`'s "the editor still writes and
autosaves with the assistant mounted" failed once under parallel load and **passed in isolation** on
re-run. That is **T-7** exactly as recorded in [48 §3.5](./48_PlatformParityRegister.md) — a pre-existing
flake in a W2 test, not touched by W8. Recorded rather than retried away.

**A local-harness trap worth naming:** the billing cross-link test failed on the first run because a
hand-started `pnpm dev` was reused by Playwright (`reuseExistingServer`) and did **not** carry the
`VITE_ENABLE_MONETIZATION: 'true'` that `playwright.config.ts:263`'s own `webServer` sets. The link is
correctly flag-gated; the runner was wrong, not the code. Letting Playwright own the server made it pass.

### 4.1 `npm run build` caught what `tsc --noEmit` could not

Worth recording because [45](./45_WebClientRoadmap.md) E3 mandates the full build for exactly this
reason, and this run vindicated it. `tsc --noEmit` in `frontend/` passed clean while resolving
`@qalam/api-types` from a **stale `dist/`** — so the three new interfaces were invisible to it, and four
real errors were hidden, including a `QCard as="form"` that its prop union does not allow and a
`features.data.enabled` that should be `aiEnabled`. `tsc -b` builds the project references and failed
on all four. `@qalam/utils` had no build output at all, which is also why the local backend would not
start.

### 4.2 The visual red is correct, and is the intended outcome

`updateSnapshots: 'none'` (playwright.config.ts:94) is set so a local run cannot mint a host-rendered
baseline — 48 §3.5 T-8, where precisely that happened silently. Three new baselines are therefore
**declared and absent**, failing with "A snapshot doesn't exist" in both `frontend-chromium` and
`frontend-dark`. Verified that nothing was written: no `frontend-ai-{conversations,prompts,usage}` file
exists in the snapshots directory, and `git status` on it is empty.

**Two existing baselines are also invalidated, by intended changes:**

| Baseline                   | Change                      | Cause                                        |
| -------------------------- | --------------------------- | -------------------------------------------- |
| `frontend-settings-blocks` | 768px → **816px** (+48px)   | the settings nav gained the AI row           |
| `frontend-billing-usage`   | 903px → **1035px** (+132px) | the cross-link card added to W4's usage page |

Both in both themes, so **10 shots need minting in the pinned CI image**: 6 new + 4 re-mints.
`frontend-settings.png` (settings profile) also contains the new nav row but still passes, because the
delta falls under the configured `maxDiffPixelRatio: 0.02` on a tall page — it is listed here so the
re-mint is a decision rather than an oversight.

Separately, `frontend-comments`, `frontend-suggestions` and `frontend-collaborators` failed locally in
this run. Those are **W5-12**, a recorded pre-existing local-reproduction flake in three W3 surfaces,
unrelated to W8 and unchanged by it.

### 4.3 webkit

**Not run, and not claimed.** Both webkit shards fail for the reasons deferred on 2026-08-03 (see the
`e2e-browser-testing` record: the "flake" diagnosis there is explicitly **unverified** — six consecutive
failures is evidence against flakiness). Nothing in W8 touches that, and W8 makes no claim about it.

---

## 5. Live verification on an existing database

`ai.use` was one of the three permissions the PBAC seed-grant defect withheld on pre-existing databases
(48 §3.7), so verifying on a _fresh_ DB would prove nothing. This ran against the local Postgres volume
as it stood — **1,371 users, oldest `2026-07-07`** — with the grants dated `2026-07-28`:

```
 role_name |  permission_code  |          created_at
-----------+-------------------+-------------------------------
 user      | ai.use            | 2026-07-28 08:08:58.46007+00
 user      | billing.use       | 2026-07-28 08:08:58.464773+00
 user      | collaboration.use | 2026-07-28 08:08:58.468863+00
```

All seven routes, as the seeded writer:

```
GET    /api/v1/ai/conversations        → 200  {"success":true,"data":[],"meta":{"pagination":{"limit":20,"hasMore":false,"nextCursor":null}}}
POST   /api/v1/ai/conversations        → 200  {"id":"019fd09c-…","title":null,"feature":"writing_assistant","status":"active","messageCount":0,…}
PATCH  /api/v1/ai/conversations/:id    → 200  {"id":"019fd09c-…","title":"W8 live check",…}
GET    /api/v1/ai/conversations/:id    → 200  (detail; exercised through the UI in the E2E run)
GET    /api/v1/ai/conversations/:id/export → 200  {"id":"019fd09c-…","feature":"writing_assistant","title":"W8 live check","status":"active","messages":[]}
DELETE /api/v1/ai/conversations/:id    → 204
GET    /api/v1/ai/usage/me             → 200  {"daily":{…"tokenLimit":100000,"usedFraction":0.00776},"monthly":{…"tokenLimit":2000000},"total":{…"tokenLimit":null,"usedFraction":null},"byFeature":[{"feature":"semantic_search","totalTokens":15000,"requests":29},{"feature":"writing_assistant","totalTokens":9692,"requests":39}]}
```

No 403 anywhere. Three things this confirmed beyond the permission:

1. **`total.tokenLimit` is `null` while daily and monthly are capped** — so the "uncapped window draws
   no bar" branch is the live shape, not a hypothetical.
2. **`POST` with no title really does store `null`**, making the "Untitled conversation" placeholder the
   common path rather than an edge case.
3. **68 AI requests recorded, and zero conversations in existence** — W8-1 in one line: the platform has
   been used for a month, and nothing ever created the row that would have kept any of it.

W8-2 was confirmed the same way: `PATCH {"status":"archived"}` → 200 with `"status":"archived"`, and the
very next `GET /ai/conversations` returned that row, from the **default** list.

---

## 6. What is NOT asserted

Stated plainly, because a report that only lists what passed is not a readiness report.

- **A conversation containing messages, end to end.** §1.0's binding makes this _possible_ for the first
  time on either client, and it is still not asserted: writing a message needs a real completion, which
  needs the AI flags and the suite's flag mutex. What IS asserted is every link in the chain up to it —
  the binding is created, lands in the URL, survives a reload, and is sent on the completion request
  (unit-pinned in `use-assistant-session.spec.tsx`, both present and absent). The one unproven step is
  that the server then persists the turn, which is `ai-completion.service.ts`'s own tested behaviour.
- **"Keep history" driven through the assistant panel in a browser.** The hook behind it is unit-tested
  (create, bind, failure, unbind-without-clobbering siblings) and the E2E suite drives the same binding
  from the conversation detail view. The panel button itself is only exercised where the AI flag is up,
  which is the serial block, and no test there clicks it.
- **The three new visual baselines.** They do not exist. Nothing has reviewed how these surfaces
  actually look in either theme; the a11y scans prove structure and contrast, not layout.
- **webkit**, on anything (§4.3).
- **Pagination beyond the first page.** "Load more" is implemented from the `meta.pagination` cursor and
  unit-tested at the api layer, but no E2E test creates 21 conversations to drive it.
- **The prompt library across devices.** It is `localStorage`, and the report's claim is only that it
  survives a reload on one browser — which the E2E suite does assert.
- **Clipboard denial in a real browser.** The blocked-clipboard path is unit-tested with a rejecting
  mock; no E2E test revokes the permission.
- **`estimatedCostUsd` with a real provider.** The live stack's inert provider reports `0`, so the
  sub-cent formatting path is exercised only by unit tests.

---

## 7. Follow-ups this epic opened

All recorded in [48 §3.12](./48_PlatformParityRegister.md), none fixed here:

1. **W8-1** — mobile cannot create a conversation. Mobile is a separate row; web is now the reference.
2. **W8-2** — the conversation list needs a status filter before any client can offer archiving.
3. **W8-3 / W8-4** — the export route should publish a real response DTO, which would also bring it
   inside the api-types guard.
4. **W8-5** — the primary button's hover background fails AA. A shared token, so it needs its own row
   and a baseline re-mint.
5. **10 visual baselines to mint** in the pinned CI image (§4.2).

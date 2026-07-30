# 47 — W2 AI Writing Assistant Readiness Report

**Epic:** W2 — the in-editor AI assistant ([45 §4.2](./45_WebClientRoadmap.md)) ·
**Status:** ✅ complete, verified against a running stack · **Date:** 2026-07-27

> **What this closes.** AF1 shipped a complete AI data layer on the web — api, hooks, streaming
> store, types — and **nothing consumed it**: no component, no route, zero importers. AF2 shipped
> its backend and its mobile client and deferred the web. W2 is the missing surface: the Writing
> Assistant and Craft Coach, in the editor, driving the layer that was already there.

---

## 1. What shipped

| Area                    | Delivered                                                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Panel**               | A side drawer over the editor, opened from a header toggle, with Assistant and Craft Coach as separately-gated tabs.                                                   |
| **Writing Assistant**   | All eight actions — continue, rewrite, expand, condense, simplify, improve (8 aspects), tone (6 tones), and free-form "Ask AI" — streamed token-by-token.              |
| **Accept / reject**     | A suggestion renders in the panel and reaches the document only when accepted, with its placement shown first. Try-again and discard alongside.                        |
| **Craft Coach**         | Six lenses (chapter, scene, pacing, readability, consistency, full review) returning a parsed report — score, summary, strengths, weaknesses, suggestions, next steps. |
| **Availability gating** | Four distinct states: available, AI off, feature dark-launched, and **out of allowance** — resolved before a request and re-resolved from a failed one.                |
| **Editor integration**  | An app-level seam the editor registers with; every applied suggestion goes through TipTap commands.                                                                    |

### 1.1 Backend

**None.** W2 consumes `/ai/completions[/stream]`, `/ai/features` and `/ai/usage/me` exactly as AF1
froze them. The eight assistant actions and six coach lenses are **prompt-template keys**, not
features — one `writing_assistant` flag covers the whole assistant, as
[`packages/shared/src/ai.ts`](../packages/shared/src/ai.ts) specifies. No prompt text lives in the
client; the bodies stay server-side and versioned, so the UI cannot fork from what the server
renders.

### 1.2 The feature-boundary problem, and the seam that solves it

The panel needs the editor and the editor needs the panel, but the assistant lives in
`features/ai`, the editor in `features/writing`, and **a feature may never import another feature**
([26 §4](./26_FrontendArchitecture.md)).

The resolution mirrors mobile's `AiEditorTarget`: an app-level seam,
[`stores/ai-editor-target.store.ts`](../frontend/src/stores/ai-editor-target.store.ts).

- The **editor registers** an implementation on mount (`getContext`, `apply`) and unregisters on
  unmount. It imports no AI code and knows nothing about prompts or suggestions.
- The **panel consumes** whatever is registered, and renders nothing at all when nothing is.
- The **app-level `/write` route** composes the two: `<EditorPage assistant={<WritingAssistantPanel />} />`.
  Only `app/` knows about both features, which is exactly its job.

**The AI never mutates the document.** It hands text to the target; the target applies it through
the editor's own commands. So an accepted suggestion enters the undo stack and fires `onUpdate`,
and autosave, the dirty flag and the beforeunload guard keep working **with no AI-specific branch
anywhere in the writing feature** — asserted directly by a test that applies a suggestion and then
undoes it.

### 1.3 Two safety properties worth naming

- **A transform can never destroy a draft.** With nothing selected, rewrite/expand/condense/
  simplify/improve/tone insert _below_ instead of replacing; and the target itself refuses
  `replace-selection` when the selection is empty. Belt and braces, both tested.
- **Quota is a first-class state, not an error.** Every AI request meters through the
  `AI_USAGE_METER` hook (AF5), so a wall is routine. The panel reads `/ai/usage/me` and says so
  **before** the writer composes an instruction, rather than losing it to a rejection — the
  requirement W2 carried "from day one" ([45 §4.2](./45_WebClientRoadmap.md)). `QUOTA_EXCEEDED` and
  `AI_USAGE_LIMIT_EXCEEDED` mid-flight resolve to the same state.

---

## 2. Verification

Executed against the running stack: Postgres, Redis, the backend on `:4000`, the **built** frontend
on `:5173`, admin on `:5174`.

| Gate                        | Result                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Unit (`vitest`)             | **338 passed / 76 files** — 51 new across 5 files (vocabulary, coach parser, availability, seam, panel) |
| Types (`tsc -b`)            | clean                                                                                                   |
| Lint (`eslint src`)         | clean                                                                                                   |
| Build (`vite build`)        | clean                                                                                                   |
| E2E frontend (all projects) | **125 passed** — chromium, firefox, webkit, mobile, tablet, dark                                        |
| E2E a11y (light + dark)     | **19 passed**, including the panel open over the editor in both themes                                  |
| E2E responsive              | 0px horizontal scroll at mobile and tablet — after fixing a regression W2 introduced (§3)               |
| E2E visual (4 projects)     | **33 passed** — 4 new panel baselines from the pinned image; editor baselines refreshed (§3)            |

### 2.1 What the coach parser is tested against

The coach prompts ask for bare JSON without relying on a provider's JSON mode, so the parser is the
place a sloppy model gets absorbed. Eleven cases pin it: fenced JSON, JSON with prose either side,
score clamping and rounding, non-string list entries dropped, untitled sections kept, missing
fields defaulted, malformed JSON, a bare array, and a shape-valid-but-empty object. Anything
unrecoverable returns `null` and **the UI shows the raw text** — a model that ignores its contract
must degrade to "here is what it said", never to a broken panel.

---

## 3. Two defects W2 introduced and fixed

Recorded because both were caught by the gates rather than by reading the diff:

1. **Inline replacement split sentences.** Replacing a selected phrase inserted a _paragraph node_,
   breaking the sentence in two. A single-block replacement now goes in as inline text; multi-block
   replacements stay paragraphs. Caught by the seam's unit test.
2. **The editor header overflowed 16px at 375px.** The new toggle pushed the unwrapped action row
   past the viewport, breaking the strict zero-horizontal-scroll gate. The group now wraps. Caught
   by the responsive project.

### 3.1 A gate limitation found on the way

The added header button **did not fail the editor's visual baseline**, because
`maxDiffPixelRatio: 0.02` on a mostly-blank full-page shot absorbs one 32px control. The gate
behaved as configured, but the committed baseline no longer matched shipped UI, so the editor
baselines were force-regenerated (`--update-snapshots=all`; the default only rewrites on failure).
Worth knowing: **a small isolated control can change without reddening a full-page baseline.**

---

## 4. The one thing W2 could not close

The `af2` E2E row is now ✅ for the panel and its gating, and **explicitly not** for a generated
suggestion. That half is environmental, not a client gap:

- The AI feature flags are dark-launched — AF1 seeds every one of them disabled — and the E2E stack
  configures **no AI provider**. Verified live: `GET /ai/features` returns `aiEnabled: false`.
- Stubbing `/ai/completions` is ruled out by the no-mocks-at-the-app-boundary invariant
  ([e2e/README](./e2e/README.md)).
- The third-party allowance ([e2e/00 §6](./e2e/00_Overview.md)) permits running against an inert
  **port** — which payments have and AI does not.
- Enabling the flags mid-suite was rejected: they are global (percentage rollout, no per-user
  allowlist), so it would leak across parallel workers — the same class of cross-test coupling that
  caused the feed flake fixed in W1.

**What would close it:** an OpenAI-compatible stub service in the E2E compose stack plus seeded
provider/model rows, pointed at by the existing `openai-compatible` adapter. That is a stack item,
recorded in [e2e/06 §6](./e2e/06_PhasePlan.md), and it also unblocks the AF3/AF4 client epics, which
will need exactly the same thing.

So what the suite asserts today is the contract that is actually live: the assistant opens over the
editor, explains itself when AI is off, keeps its two features separately gated, and never damages
the writing surface it sits on.

---

## 5. Deliberately not in W2

| Not shipped                      | Why                                                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Conversation history**         | `/ai/conversations` is wired in the data layer, but the assistant is a per-turn tool, not a chat. A history surface needs its own design. |
| **Prompt library / presets**     | Mobile has one; it is a saved-prompts feature with its own storage, not part of "wire the assistant into the editor".                     |
| **Model / parameter pickers**    | `/ai/config` exists and is user-overridable, but choosing a model belongs in settings, not over a draft.                                  |
| **Coach applying its own fixes** | The coach gives notes; the writer acts. Turning a note into an edit is a different interaction, and a riskier one.                        |

---

## 6. What W2 unblocks

`W3` (collaboration/publishing/trust) and `W4` (monetization) both listed W2 as a prerequisite —
W3 because it touches the editor the assistant now lives in, W4 because metered AI is one of the
things it gates, and the quota state it needs is already built and tested here. Both are now
unblocked, leaving `W5` (AF4 discovery) and the held `W6`.

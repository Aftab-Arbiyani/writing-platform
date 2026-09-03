# 35 — Story Intelligence Architecture (AF3)

> ⚠️ **AMENDED BY D5, 2026-09-03** ([48 §5.2](./48_PlatformParityRegister.md#d5--the-ai-surface-is-removed-the-tools-stay-owner-2026-09-02)).
> This is now **Story Map**, user-facing, and it finally has a way to be built. The graph model,
> the analyses and the ownership rules below are unchanged; what changed is that "clients follow in
> a follow-up" stopped being true in one direction:
>
> - **`POST /story-intelligence/:storyId/map/stream`** runs all five analysis kinds in order and
>   folds each into the graph, streaming progress over SSE. It is the first client-reachable
>   `analyze` trigger on any platform — until D5, a Pro subscriber could look at a graph nothing
>   could populate ([48 §3.22d](./48_PlatformParityRegister.md)).
> - **Analyses are metered per action**, not per token: one `storyAnalysesPerMonth` each, with a
>   full map run of five reserved up front so a writer short of allowance is refused before the
>   first call rather than left with a half-built graph.
> - **Still deliberately absent:** any client for `resetGraph`, and any way for a writer to confirm
>   or correct extracted entities. Both remain product-undefined and out of scope.
> - **Naming:** "Story Intelligence" survives only as the module name and the `story_intelligence`
>   wire code. Users see **Story Map**.

> **Status:** Backend graph platform **implemented + verified**. Clients (React
> frontend, admin UI, Flutter) render from the structured graph in a follow-up (this
> session's scope was the backend single-source-of-truth, per the scope decision).
>
> **Governing constraints:** never bypass AF1/AF2 — every analysis runs through the AF1
> orchestrator (`AiCompletionService`); every analysis returns **structured domain
> objects first, prose second** (never plain text only); the **story knowledge graph is
> the single source of truth** that future AI features reuse without architectural
> change. Additive-only against the frozen `v1` contract.

---

## 1. Folder tree

```
packages/shared/src/
├── story.ts                     # vocabulary: StoryAnalysisKind/Scope, StoryNodeType,
│                                #   StoryEdgeType, StoryEventKind, StoryAnalysisStatus,
│                                #   CharacterRole; helpers storyAnalysisFeature/PromptKey,
│                                #   normalizeStoryName; guardrail constants
├── ai.ts                        # + AiFeature.WorldBuilding/StyleAnalysis/StoryTimeline (+ FLAGGED)
└── error-codes.ts               # + STORY_NOT_FOUND / STORY_ANALYSIS_NOT_FOUND / STORY_ANALYSIS_FAILED / STORY_CONTENT_EMPTY
packages/api-types/src/story.ts  # wire contract (graph, per-kind *Data payloads, result envelope, timeline, request)

backend/src/modules/story-intelligence/
├── entities/
│   ├── story-graph.entity.ts       # aggregate root (owner + storyId), counts, lastAnalyzedAt
│   ├── story-node.entity.ts        # entities (character/location/event/object/organization/concept)
│   ├── story-edge.entity.ts        # typed relationships
│   └── story-analysis.entity.ts    # append-only analysis runs (history + results)
├── analysis/
│   ├── json.util.ts                # defensive JSON extraction + field readers
│   ├── story-analysis.parser.ts    # per-kind parse → structured objects + node/edge upserts
│   └── story-analysis.parser.spec.ts
├── dto/{story-request,story-response}.dto.ts
├── story.types.ts                  # NodeUpsert / EdgeUpsert / ParsedAnalysis / StoryEvidenceRef
├── story.exceptions.ts             # AppException subclasses (STORY_*)
├── story.mappers.ts                # entity → response-DTO
├── story-intelligence.repository.ts  # aggregate repo: getOrCreate, transactional upsert, reads
├── story-intelligence.service.ts     # orchestrator call → parse → graph upsert → run (+ .spec)
├── story-intelligence.controller.ts  # /story-intelligence/:storyId/*
├── story-intelligence.module.ts      # imports AiModule; registers the 4 entities
└── story-prompts.spec.ts             # template + vocab + flag guards
backend/src/modules/ai/prompts/prompt-catalog.ts   # + 5 story.* templates (boot-upserted)
backend/src/modules/settings/settings.catalog.ts   # + 3 feature-flag defs (disabled)
backend/src/database/migrations/1784298739240-StoryIntelligence.ts   # 4 tables + indexes
backend/src/app.module.ts            # + StoryIntelligenceModule (after AiModule)
```

## 2. Story intelligence architecture (analysis lifecycle)

Every analysis runs **through the AF1 orchestrator** and produces structure:

```
POST /story-intelligence/:storyId/analyze { kind, scope, content }
  → JwtAuthGuard + ai.use + aiCompletion rate tier
  → AiCompletionService.complete({ feature: <kind→AiFeature>, promptKey: 'story.<kind>',
        messages:[{ user, content }], promptVariables:{ scope } })
        // AF1 enforces: feature flag gate, usage limits, prompt render, provider
        //               dispatch, input/output safety, token accounting
  → parseStoryAnalysis(kind, output.content)  → ParsedAnalysis (structured + node/edge upserts)
  → repo.applyAnalysis(...)  [ONE transaction]:
        upsert (merge) nodes  →  resolve + upsert edges  →  insert analysis run  →  refresh graph counts
  → StoryAnalysisResultDto  (structured objects + summary + recommendations + confidence
                             + evidence + affectedChapters + affectedCharacters + usage)
```

`AiCompletionService` is injected from the exported `AiModule` surface — no prompt text,
streaming, token math, safety, or provider logic is re-implemented. The five kinds
(character, plot, world, style, timeline) each map to one `AiFeature` (so each is an
independent, dark-launchable feature flag) and one `story.<kind>` prompt template whose
body instructs a documented JSON schema. Analyses **never modify document content** —
they only read the submitted text and write the graph.

**Structured-first, defensively.** `story-analysis.parser.ts` extracts the outermost JSON
object (tolerating code fences/prose), reads every field defensively, and produces (a) a
`structured` payload and (b) the graph upserts. If nothing parses, the run is recorded
with `status: failed` and the raw text retained — never plain-text-as-truth, never a crash.

## 3. Knowledge graph architecture (single source of truth)

A **generic node/edge graph** (not per-entity tables) so new entity kinds never need a
migration and future features reuse it unchanged:

- `story_graphs` — aggregate root, unique `(user_id, story_id)`; denormalized counts +
  `last_analyzed_at`. `storyId` is the caller's opaque key (piece id or local draft id);
  no FK to `pieces` (module isolation, docs 16 §3.1).
- `story_nodes` — `type` (OPEN varchar: character/location/organization/object/event/
  concept), `name` + `normalized_name`, `aliases`, `summary`, `data` (jsonb, type-specific:
  traits/goals/arc for characters; rules/lore for concepts; kind/order for events),
  `confidence`, `mention_count`, `evidence`. **Unique `(graph_id, type, normalized_name)`.**
- `story_edges` — `type` (OPEN: relationship/mention/appears_in/occurs_at/involves/
  precedes/foreshadows/member_of), `source_id`/`target_id` (plain uuid node ids), `label`,
  `data`, `confidence`, `evidence`. **Unique `(graph_id, source_id, target_id, type)`.**
- `story_analyses` — append-only run record (the "Analysis History" + "Analysis Results").

**Accumulation, not duplication.** `applyAnalysis` runs in one transaction: nodes dedupe on
`(type, normalizedName)` and **merge** (union aliases, sum mentions, max confidence, merge
`data`, append evidence); edges resolve endpoints against **all** existing nodes (so a
timeline run links to characters a prior character run found) and drop any edge whose
endpoint doesn't resolve — never an orphan. Re-analysing the same chapter enriches the
graph rather than duplicating it. Reset is a single owner-scoped transactional delete.

## 4. Timeline architecture

The timeline is a **view over the graph**, not a separate store: timeline analysis writes
`event` nodes (`data.kind` = chronological/flashback/future, `data.order`, `data.chapterRef`,
`data.characters`, `data.location`) plus `precedes` edges between consecutive events,
`occurs_at` edges to locations, and `involves` edges to characters. `GET …/timeline`
returns the event nodes ordered by `data.order`. Because events are ordinary nodes, the
character/plot/world analyses and the timeline share one graph — no duplicate event stores.

## 5. Character graph architecture

Character analysis writes `character` nodes (`data`: role/traits/goals/motivations/arc/
growth) and `relationship` edges between them (label = relation type, `data.description`).
`GET …/graph/characters` returns character nodes + the relationship edges among them — the
interactive-character-graph surface renders directly from this with no extra AI call.

## 6. State management summary

- **Backend** — per-request state is the orchestrator's (AF1); durable state is the four
  `story_*` tables via one aggregate repository. One `StoryGraph` per `(user, story)`.
- **Reuse** — the module imports `AiModule` and injects `AiCompletionService`; feature
  flags reuse the settings subsystem (`feature.ai.<kind>.enabled`); usage/config/models
  reuse the AF1 admin surface. Nothing AI-platform is duplicated.
- **Clients (follow-up)** — the frontend/admin/Flutter providers named in the brief
  (Character Graph, Plot Graph, Timeline, Story Analysis, Knowledge Graph, Analysis
  History) are thin readers over `GET …/graph[/characters]`, `…/timeline`, `…/analyses`
  plus the analyze mutation — all rendering from the structured objects above.

## 7. API integration summary

All under `/api/v1`, envelope + `ai.use` permission + rate tiers per docs/05. `:storyId` is
the client's opaque story key. No new provider or streaming code.

- `POST /story-intelligence/:storyId/analyze` (`aiCompletion` tier) → `StoryAnalysisResultDto`
- `GET  /story-intelligence/:storyId/graph` (`read`) → full graph
- `GET  /story-intelligence/:storyId/graph/characters` (`read`) → character graph
- `GET  /story-intelligence/:storyId/timeline` (`read`) → ordered events
- `GET  /story-intelligence/:storyId/analyses` (`read`, cursor-paginated) → history
- `GET  /story-intelligence/:storyId/analyses/:analysisId` (`read`) → one run
- `DELETE /story-intelligence/:storyId/graph` (`write`, 204) → reset

Admin ("Prompt Management, Analysis Configuration, Model Assignment, Analysis Limits, Usage
Dashboard, Feature Flags") **reuses the AF1 admin surface** (`/admin/ai/prompts` manage the
`story.*` templates, `/admin/ai/config` model assignment, `/admin/ai/usage/:userId` usage,
the settings feature-flag admin toggles the five `feature.ai.*` flags, usage caps enforce
analysis limits) — no duplicated admin code. New error codes: `STORY_*` (append-only).

## 8. Test coverage

Backend: **484 tests green** (71 suites; +29 for AF3). New: `story-analysis.parser.spec`
(per-kind structured extraction + graph upserts + fenced-JSON recovery + failed-parse
fallback), `story-intelligence.service.spec` (orchestrator reuse with the right feature +
prompt key, structured persistence with usage/provenance, empty-content rejection,
owner-scoped not-found), `story-prompts.spec` (all five templates present/analysis-category/
`{{scope}}`-parametrised/render/JSON-contract markers; kind→feature mapping; the three new
flags seeded disabled; `normalizeStoryName`). `tsc --noEmit` + `nest build` green; shared +
api-types `tsc`/lint green; eslint clean. Migration verified **up → down → up** on Postgres 16.

## 9. Manual testing guide

1. `docker compose up -d postgres` · `pnpm --filter backend migration:run` (creates the four `story_*` tables).
2. Set a provider key in `backend/.env` (e.g. `OPENAI_API_KEY=…`).
3. As admin (`settings.manage`) enable `feature.ai.enabled` + the analysis flags you want
   (`feature.ai.characterAnalysis.enabled`, `…plotAnalysis…`, `…worldBuilding…`,
   `…styleAnalysis…`, `…storyTimeline…`).
4. `POST /api/v1/story-intelligence/piece-1/analyze` `{ "kind":"character", "scope":"chapter",
"content":"<chapter text>", "storyTitle":"My Novel" }` → a `StoryAnalysisResultDto` with
   structured `characters`/`relationships`, summary, recommendations, confidence, evidence.
5. `GET …/piece-1/graph` → nodes + edges accrued. Run `kind:"timeline"` → `GET …/timeline`
   shows ordered events; run `kind:"world"` → world nodes appear in the same graph.
6. Re-run `kind:"character"` → the same characters MERGE (mention counts rise, no duplicates).
7. `GET …/analyses` → run history; `GET …/analyses/:id` → full structured payload.
8. Disable a flag → the matching analyze call returns `AI_FEATURE_DISABLED`. `DELETE …/graph`
   → resets. A foreign `:storyId` returns `STORY_NOT_FOUND`.

## 10. Future compatibility (confirmation)

Every future feature reuses the structured story graph without architectural change:
**Story Wiki / Interactive Character Graph / Timeline Explorer** read `GET …/graph[/characters]`
and `…/timeline` directly (already the character/timeline views). **Story Memory / future AI
Editor** inject the graph as context (feed nodes/edges into an AF1 context provider) instead
of re-analysing. **Semantic Search / Recommendations / Cover Generation / Marketing Assets**
(later epics) consume the same nodes/edges + analysis runs. A new entity kind is a new
`StoryNodeType`/`StoryEdgeType` string (no migration — the graph is generic); a new analysis
lens is a new `AiFeature` + a `story.<kind>` prompt template + a parser branch → the graph.
No feature re-generates knowledge the graph already holds; the graph is the one source of
truth, populated only through the AF1 platform.

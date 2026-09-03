# 36 — Discovery / Search / Recommendation — the Retrieval Platform (AF4)

> ⚠️ **AMENDED BY D5, 2026-09-03** ([48 §5.2](./48_PlatformParityRegister.md#d5--the-ai-surface-is-removed-the-tools-stay-owner-2026-09-02)).
> **The design law "the LLM owns explanation, retrieval owns what it sees" no longer holds, because
> there is no LLM here at all.** The pipeline never called one except for search's optional grounded
> answer; deleting that branch left the platform deterministic, and that changed what it is:
>
> - **Search is public.** `POST /ai/search` and `GET /ai/search/suggestions` are `@Public()` with
>   an optional viewer, exactly like E8's `/search`. The knowledge-graph source is owner-scoped and
>   simply contributes nothing for an anonymous caller; a story-scoped query without a user is
>   refused (422) rather than answered emptily. Saved searches stay authenticated.
> - **Ask My Book is deleted** — service, controller, DTOs, prompt, `AskScope`, the `Ask` intent.
> - **No feature flags, no `ai.use`, no synthesis.** `synthesisEnabled` is gone from the internal
>   config; the admin field is answered with a constant `false` until the client drops it.
> - **`retrieval.module.ts` no longer imports `AiModule`**, and a spec asserts that by reading the
>   module source. That import is the thing to watch: re-adding it is how this platform would drift
>   back into being an AI feature.
> - **Naming:** users see "Search" and "Recommendations". Nothing here is branded AI.

> **Status:** Backend **implemented + verified**. Clients (React frontend, admin UI, Flutter)
> render from the seams defined here in a follow-up (this session's scope was the reusable
> backend platform + its consumers, per the scope decision — same precedent as AF2/AF3).
>
> **Governing constraints (all satisfied structurally, not by convention):** never bypass AF1
> (every LLM call is `AiCompletionService`); never bypass AF3 (the story knowledge graph is the
> single source of truth, read through its exported service); never duplicate search /
> recommendation / graph / retrieval logic (compose the existing `SearchService`,
> `TrendingService`/`DiscoveryService`, and the graph); never send a raw user question to an
> LLM (retrieval assembles grounded context first); every answer references retrieved evidence;
> every recommendation explains itself. Additive-only against the frozen `v1` contract.

**Design law:** Knowledge Graph owns structured knowledge · **Retrieval owns context** · LLM
owns explanation · presentation owns rendering. The Retrieval Platform is the **single entry
point** every present and future AI capability routes through.

---

## 1. Folder tree

```
packages/shared/src/retrieval.ts      # vocabulary: RetrievalIntent/QueryType/Source, RankingSignal,
                                       #   AskScope, ExplorerView, RecommendationKind, FailureReason;
                                       #   helpers (retrievalIntentFeature/PromptKey, askScopeNodeTypes);
                                       #   guardrail constants
packages/shared/src/ai.ts             # + AiFeature.AskBook (+ FLAGGED); semantic_search/recommendations pre-existed
packages/shared/src/error-codes.ts    # + RETRIEVAL_* / RECOMMENDATION_UNAVAILABLE / SAVED_SEARCH_*
packages/api-types/src/retrieval.ts   # wire contract (search/ask/explorer/recommendations/saved/admin)

backend/src/modules/retrieval/
├── retrieval.module.ts               # wiring; imports Ai/StoryIntelligence/Search/Feed/Settings modules
├── retrieval.service.ts              # THE orchestrator (classify→plan→retrieve→rank→assemble)
├── retrieval.types.ts                # internal pipeline + grounding + config + analytics shapes
├── retrieval.constants.ts            # defaults (ranking weights, budgets, cache), settings keys
├── retrieval.text.util.ts            # pure token/lexical helpers (no I/O)
├── retrieval.exceptions.ts           # RETRIEVAL_* / RECOMMENDATION_* / SAVED_SEARCH_* domain errors
├── retrieval.mappers.ts              # RankedCandidate → search/recommendation DTOs
├── retrieval-config.service.ts       # admin-tunable config via the audited Settings write path
├── retrieval-cache.service.ts        # read-through Redis DB0 cache (reuses the shared pattern)
├── ports/{retriever,ranking}.port.ts # the two seams: Retriever (many), RankingStrategy (swappable)
├── planner/
│   ├── intent-detector.service.ts    # intent detection (rule-based, LLM-swappable)
│   ├── query-classifier.service.ts   # query classification (the semantic-search taxonomy)
│   └── retrieval-planner.service.ts  # THE planner — strategies, order, budgets, ranking, node types
├── retrievers/
│   ├── graph.retriever.ts            # AF3 knowledge graph (SSOT) via StoryIntelligenceService
│   ├── keyword.retriever.ts          # E8 SearchService (FTS) — library lexical search
│   ├── metadata.retriever.ts         # authors/tags/genres via SearchService
│   └── vector.retriever.ts           # RESERVED extension point (inert until an embedding store lands)
├── ranking/composite-ranking.strategy.ts  # default weighted-signal ranker + explanations
├── context/
│   ├── context-assembler.service.ts  # prioritize→dedup→compress→budget→order
│   └── story-context.builders.ts     # AF1 ContextProvider builders (graph/characters/timeline)
├── evidence/evidence.service.ts      # evidence collection, citations, aggregate confidence
├── observability/
│   ├── retrieval-telemetry.service.ts   # structured log line + append-only row + analytics
│   └── retrieval-log.repository.ts
├── evaluation/search-evaluation.service.ts  # precision/recall/nDCG/MRR/hallucination/calibration
├── entities/{saved-search,retrieval-query-log}.entity.ts
├── dto/{retrieval-request,retrieval-response}.dto.ts
├── consumers/
│   ├── semantic-search.{service,controller}.ts
│   ├── ask-book.{service,controller}.ts       # buffered + SSE streaming
│   ├── story-explorer.{service,controller}.ts
│   ├── recommendation.{service,controller}.ts
│   └── saved-search.{service,repository}.ts
└── admin/admin-retrieval.controller.ts   # search-config + search-analytics (ai.manage)
backend/src/database/migrations/1784386709831-AiRetrieval.ts   # saved_searches + retrieval_query_logs
backend/src/modules/story-intelligence/story-intelligence.service.ts  # + getGraphSnapshot (boundary-safe reuse seam)
```

## 2. Retrieval Platform architecture (the reusable core)

Every AI request follows one fixed pipeline, owned by `RetrievalService.retrieve()`:

```
request → Intent Detection → Query Classification → Retrieval Planning
  → [ Knowledge-Graph · Metadata · Keyword · (Vector, reserved) ] retrieval  (parallel, per-source time-bounded)
  → Ranking → Context Assembly (prioritize · dedup · compress · budget · order)
  → RetrievalResult { plan, ranked candidates, assembled context, telemetry }
     └→ consumer optionally calls AiCompletionService with the ASSEMBLED CONTEXT (never the raw query)
        → grounded, evidence-cited, structured response
```

Retrieval **never calls an LLM** (the LLM step is the consumer's, grounded in this result) and
**never touches a source's storage** (only via `Retriever`s). A source is a pluggable
`Retriever` registered under the `RETRIEVERS` token — adding one (vectors, cross-book,
federated, external KB) is a new adapter class with **zero** planner/consumer change. This is
the direct analogue of AF1's provider/context ports.

## 3. Retrieval Planner architecture

`RetrievalPlannerService.plan(request, config)` decides everything downstream: **which
strategies** run (story-scoped → knowledge graph, the SSOT; library-scoped → keyword +
metadata; vector always considered but inert until available), **their order**, **parallel vs
sequential**, **per-source + context-token budgets**, the **ranking-signal emphasis**, which
**graph node types** to prioritise (from the query type, or the Ask scope), and **whether to
synthesise** a grounded answer. Config is admin-tunable (§9). Nothing bypasses the plan.

Intent detection and classification are deterministic rule engines (fast, free, testable) with
the exact same method surface an LLM classifier would use — so they can be upgraded later
behind the seam with no caller change.

## 4. Semantic Search architecture

`POST /ai/search` → `SemanticSearchService`: gate the SemanticSearch feature → run the pipeline
(cached) → optionally synthesise a grounded answer (`semantic_search.answer`, fed the assembled
context) → record telemetry. Covers the full search taxonomy — natural-language, character,
scene, chapter, location, timeline, event, relationship, dialogue, quote, concept,
world-building — via query classification + graph node-type prioritisation (story scope) and FTS
(library scope). **Every result** carries: the structured domain object, summary, confidence,
evidence references, related entities, a navigation target, a recommendation reason, a ranking
explanation, and a relevance score.

## 5. Recommendation architecture

`GET /ai/recommendations` → `RecommendationService`: gate Recommendations, then compose existing
signals — **never a parallel stack**. Trending/Feed/ContinueReading reuse
`TrendingService`/`DiscoveryService`; Authors/Genres/Topics reuse discovery; RelatedStories
derives salient entities from the story graph and reuses `SearchService`; Related
Characters/Chapters/Topics project the graph. **Every recommendation explains why** (reason +
influencing entities + supporting evidence + confidence). Collections returns empty gracefully
(no read-surface exported yet — documented seam). Reading history is client-local (M3), so
ContinueReading uses community signal as an honest proxy.

## 6. Story Explorer architecture

`GET /ai/explorer/:storyId/:view` → `StoryExplorerService`: reads the owner-scoped graph
snapshot once and **projects** it per view (characters, relationships, timeline, locations,
events, objects, concepts, map). No LLM, no duplicated traversal. Every explorer renders
directly from graph node/edge objects — the SSOT. A foreign/missing story is `STORY_NOT_FOUND`.

## 7. Context Assembly architecture

`ContextAssemblerService` owns context preparation — **the LLM never decides what to retrieve**.
It runs, in order: **prioritise** (candidates arrive ranked) → **deduplicate** (repeat ids +
same-entity across sources) → **compress** (per-fragment token slice, adaptive to the remaining
budget) → **budget** (stop at the token ceiling) → **order** (highest value first). It emits the
assembled text, the token count, the compression ratio, and the deduplicated evidence. Reusable
**context builders** (`story_graph`, `story_characters`, `story_timeline`) implement AF1's
`ContextProvider` port so any AI feature can inject the graph as context (docs/35 §10); wiring
them into AF1's `ContextRegistryService` is a one-line seam, deferred only to avoid a module
cycle (the graph module already depends on the AI module) — AF4's own consumers ground through
the pipeline directly.

## 8. Ranking architecture

`RankingStrategy` port (`RANKING_STRATEGY` token) with a default `CompositeRankingStrategy`:
combines the plan's weighted signals — semantic similarity, graph distance, popularity,
freshness, user preferences, reading/writing history, engagement, confidence — into a single
0..1 score (weighted average over the signals each candidate carries) and emits a per-signal
`RankingExplanation` (the "why this rank" contract). A learned/custom ranker is a new
implementation bound to the token — no consumer change. Weights are admin-tunable (§9).

## 9. Observability architecture

`RetrievalTelemetryService` emits, per request, a structured Pino line **through the existing
monitoring infrastructure** and an append-only `retrieval_query_logs` row capturing: query
intent, classification, retrieval strategy + sources, graph/ranking/context-assembly/LLM/total
latencies, context size, compression ratio, token usage, cache hit ratio, evidence coverage,
confidence, and failure classification. Recording is **best-effort** (never affects the user's
request). The query text itself is not stored (privacy — only shape). Internal telemetry is
**never exposed to end users**; admins read aggregates via `GET /admin/ai/search-analytics`.

## 10. Search Evaluation architecture

`SearchEvaluationService` — internal quality measurement, entirely offline-capable and **never
on the request path**. Pure functions over labelled samples: precision/recall@k, MRR, nDCG@k,
coverage, hallucination rate, and confidence calibration. It exists to measure and improve
retrieval/ranking quality against curated or future offline evaluation datasets, and must not
affect user experience.

## 11. State management summary

- **Backend** — per-request pipeline state is transient (plan → candidates → context); durable
  state is two additive tables (`saved_searches`, append-only `retrieval_query_logs`) plus the
  admin config JSON settings row. Redis DB0 caches retrieval results (read-through).
- **Clients (follow-up)** — the brief's providers (Semantic Search, Recommendations, Discovery,
  Story Explorer, Ask Book, Retrieval Session, Search History) are thin readers over the
  endpoints in §12, reusing AF1's stream reader for `/ai/ask/stream`. Reuse AF1/AF3 state — no
  new client state architecture.

## 12. API integration summary

All under `/api/v1`, envelope + `ai.use` permission + rate tiers (docs/05). Streaming is
`text/event-stream` (reuses the AF1 SSE protocol).

- `POST /ai/search` (`search` tier) · `GET /ai/search/suggestions` · `GET|POST /ai/search/saved` · `DELETE /ai/search/saved/:id`
- `POST /ai/ask` · `POST /ai/ask/stream` (`aiCompletion` tier; SSE `sources`→`start`→`delta`*→`done|error`)
- `GET /ai/explorer/:storyId/:view` (`read`)
- `GET /ai/recommendations` (`read`)
- `GET|PUT /admin/ai/search-config` · `GET /admin/ai/search-analytics` (`ai.manage`)
- **Reused AF1 admin (no duplication):** `/admin/ai/prompts*` (the `ask_book.*`/`semantic_search.*`/
  `recommendations.*` templates), `/admin/ai/config` (model assignment), `/admin/ai/usage/:userId`,
  and `/admin/feature-flags` (the `feature.ai.semanticSearch|recommendations|askBook` flags).

New error codes: `RETRIEVAL_*`, `RECOMMENDATION_UNAVAILABLE`, `SAVED_SEARCH_*` (append-only). New
feature: `AiFeature.AskBook` (+ seeded disabled flag); `semantic_search`/`recommendations`
pre-existed.

## 13. Performance optimizations

Retrieval result caching (Redis DB0 read-through, story-scoped invalidation); **parallel
retrieval** with per-source timeouts (a slow/failed source degrades, never blocks); token
budgeting + adaptive context compression (low token usage); graph reads bounded by the AF3
node cap (≤5000) with in-memory projection; cursor/positional ranking; a ranking cap at topK; a
reserved vector source for future ANN. Cache-warming and query batching are seams the cache
service already supports. Optimised for low latency, low token usage, high cache-hit ratio, and
large books/graphs.

## 14. Test coverage

Backend: **533 tests green** (85 suites; **+49 for AF4**). New: query-classifier, intent-detector,
retrieval-planner (source selection story vs library, node types, synthesis, topK clamp),
composite-ranking (weighted score + explanation + topK), context-assembler (dedup, budget,
compression, evidence), evidence (dedup, citations, confidence damping), search-evaluation
(precision/recall/nDCG/MRR/hallucination/calibration), graph-retriever (filtering, scoring,
evidence, STORY_NOT_FOUND propagation), **retrieval-service** (plan → parallel sources → rank →
assemble; graceful degradation; STORY_NOT_FOUND surfaced; all-fail → RETRIEVAL_FAILED),
semantic-search + ask-book + recommendation + saved-search services, and the shared contract
(templates boot-render, flags seeded disabled, vocab helpers). `tsc --noEmit` + `nest build`
green; shared + api-types `tsc`/lint green; retrieval module eslint clean. Migration verified
**up → down → up** on Postgres 16.

## 15. Manual testing guide

1. `docker compose up -d postgres` · `pnpm --filter backend migration:run` (creates `saved_searches` + `retrieval_query_logs`).
2. Set a provider key in `backend/.env` (e.g. `OPENAI_API_KEY=…`).
3. As admin (`settings.manage`) enable `feature.ai.enabled` + `feature.ai.semanticSearch.enabled` / `…recommendations…` / `…askBook…`.
4. Seed a graph: `POST /api/v1/story-intelligence/piece-1/analyze { kind:"character", scope:"chapter", content:"<chapter>" }` (AF3).
5. `POST /ai/search { "query":"who is the protagonist?", "storyId":"piece-1" }` → ranked results with evidence + ranking explanation + navigation. Add `"synthesize":true` → a grounded `answer`.
6. `POST /ai/ask { "storyId":"piece-1", "question":"How are Aria and the mentor related?", "scope":"relationship" }` → grounded answer + citations. `POST /ai/ask/stream` (same body) → SSE `sources`→`start`→`delta…`→`done`; abort mid-stream → generation cancels.
7. `GET /ai/explorer/piece-1/characters` (and `/timeline`, `/map`, …) → structured graph views.
8. `GET /ai/recommendations?kind=related_characters&storyId=piece-1` → explained items; `?kind=trending` → library recommendations.
9. Saved searches: `POST /ai/search/saved` → `GET /ai/search/saved` → `DELETE /ai/search/saved/:id`.
10. Admin: `GET/PUT /admin/ai/search-config`; `GET /admin/ai/search-analytics?windowDays=7`. Disable a flag → the matching endpoint returns `AI_FEATURE_DISABLED`. A foreign `:storyId` → `STORY_NOT_FOUND`.

## 16. Future compatibility (confirmation)

**Every present and future AI capability reuses the Retrieval Platform + the Story Knowledge
Graph without architectural duplication.** A new capability = pass a `RetrievalRequest` through
`RetrievalService.retrieve()`, then (optionally) `AiCompletionService` with the assembled
context. New retrieval sources (**vector databases, embeddings, hybrid search, RAG, cross-book,
cross-author, enterprise, federated, external KBs, MCP tools, multi-tenant**) are new
`Retriever`s under `RETRIEVERS` — the reserved `vector` source is the worked example (inert
until a store lands, then live with zero pipeline change). **Custom ranking algorithms** are new
`RankingStrategy` implementations. **AI memory / document collections** plug in as sources or
context builders. Nothing above a port, and no existing `v1` contract, changes. The graph
remains the one source of truth; the LLM only ever explains what retrieval grounded.

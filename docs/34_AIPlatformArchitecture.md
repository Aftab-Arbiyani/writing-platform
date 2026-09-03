# 34 — AI Platform Architecture (AF1)

> ⚠️ **AMENDED BY D5, 2026-09-03** ([48 §5.2](./48_PlatformParityRegister.md#d5--the-ai-surface-is-removed-the-tools-stay-owner-2026-09-02)).
> **The platform below stands — the surface it serves does not.** D5 removed the AI _branding_, not
> the AI _foundation_: providers, orchestrator, prompts, safety, `ai_usage_logs` and the admin
> config are all unchanged, and Polish, Manuscript feedback and Story Map run on them exactly as
> described here. What this document now overstates:
>
> - **The conversation layer is gone.** `ConversationService`, its repository, controller and
>   mappers are deleted, and `assembleMessages` no longer has a history step. Every completion is
>   stateless — the surviving surfaces each send their operand in full. `ai_conversations` /
>   `ai_messages` still exist as tables until D5's contract phase drops them.
> - **`GET /ai/usage/me` is gone.** Users are no longer shown tokens; per-feature allowances are
>   served by the monetization module (`GET /monetization/usage`). `GET /admin/ai/usage/:userId`
>   is unchanged — token and cost accounting stays internal.
> - **Five prompt keys and several `AiFeature` values are gone or going**; the ones that generate
>   prose were removed on purpose. §13's "how to add a feature" recipe still applies, with one
>   addition: a new AI feature sold behind a premium code must also be given a quota rule
>   (`ai-quotas.ts`), or `uncountedPaidAiFeatures` fails the build.

> **Status:** Backend **implemented + verified**; client integrations (React
> frontend, admin, Flutter) follow the seams defined here. **Scope of AF1:** the
> reusable AI _foundation_ every future AI capability builds on — **no
> user-facing AI feature** (grammar/rewrite/craft-coach/summaries/analysis/
> semantic-search/recommendations are out of scope and ship later on this base).
>
> **Governing constraints:** additive-only against the frozen `v1` contract
> (`docs/25` §8); provider-agnostic (no vendor SDK in business logic); API keys
> never reach a client; providers interchangeable through configuration; no
> duplicated prompt-render / token-count / conversation logic; everything through
> repositories + DI.

---

## 1. Folder tree (backend)

```
backend/src/modules/ai/
├── ai.module.ts                 # wiring (entities, controllers, multi-provider tokens, exports)
├── ai.constants.ts              # token ratio, SSE heartbeat, provider labels
├── ai.exceptions.ts             # domain exceptions (AppException subclasses, ERROR_CODES)
├── ai.mappers.ts                # entity → response-DTO mappers
├── ai-feature.service.ts        # feature-flag GATE (reuses SettingsService flags)
├── index.ts                     # barrel — exported reuse surface for future AI features
├── providers/                   # THE provider abstraction
│   ├── ai-provider.port.ts      #   AiProviderAdapter interface + AI_PROVIDER_ADAPTERS token
│   ├── provider.types.ts        #   normalized request/result/chunk shapes
│   ├── provider-registry.service.ts  # index adapters by provider (the swap point)
│   ├── sse-parser.ts            #   shared SSE reader over fetch bodies
│   └── adapters/
│       ├── openai-compatible.adapter.ts  # base (OpenAI + Azure/Ollama/OpenRouter/LMStudio reuse)
│       ├── openai.adapter.ts
│       ├── anthropic.adapter.ts
│       └── gemini.adapter.ts
├── registry/                    # model registry
│   ├── model-catalog.ts         #   seed catalogue (source of truth)
│   ├── model-registry.service.ts
│   └── entities/ai-model.entity.ts
├── prompts/                     # prompt management
│   ├── prompt-catalog.ts · prompt-renderer.ts · prompt-registry.service.ts
│   └── entities/ai-prompt-template.entity.ts
├── context/                     # reusable context builders (pluggable)
│   ├── context-builder.port.ts · context-registry.service.ts
│   └── builders/{selection,writing-metadata}-context.builder.ts
├── tokens/                      # token accounting
│   ├── token-counter.service.ts · usage.service.ts
│   └── entities/ai-usage-log.entity.ts
├── conversations/               # conversation storage
│   ├── conversation.repository.ts · conversation.service.ts
│   └── entities/{ai-conversation,ai-message}.entity.ts
├── config/                      # layered configuration
│   ├── ai-config.service.ts     #   resolver: env → org → user
│   └── entities/{ai-org-config,ai-config-override}.entity.ts
├── safety/                      # safety hooks (permissive defaults; policy is future)
│   ├── safety.types.ts · safety.service.ts
│   └── hooks/{input-length,sanitize}.hook.ts
├── streaming/sse.util.ts        # provider-independent SSE protocol
├── orchestration/ai-completion.service.ts   # THE reuse core
├── controllers/{ai,ai-conversations,admin-ai}.controller.ts
└── dto/{ai-request,ai-response}.dto.ts
```

Shared contract: `packages/shared/src/ai.ts` (vocabulary) + additions to
`error-codes.ts`, `permissions.ts`, `rate-limits.ts`, `limits.ts`;
`packages/api-types/src/ai.ts` (wire DTOs). Config: `backend/src/config/ai.config.ts`

- `env.schema.ts`. Migration: `…/migrations/1784281634390-AiPlatform.ts`.

## 2. AI architecture (request lifecycle)

Every generation runs through the **one** orchestrator (`AiCompletionService`):

```
client → controller (JWT + ai.use + rate-limit guards)
  → gate (feature flag) → usage limit check → resolve config (env→org→user, clamped)
  → resolve model + capability check → assemble prompt (template) + context (pluggable) + history
  → input safety → context-window check → provider adapter (via port) → output safety
  → cost + usage accounting → conversation persistence → response | SSE stream
```

Business logic depends only on the **port** and neutral shapes — never a vendor
type. That single choke point is why "no duplicated AI logic" holds and why every
future feature reuses the whole pipeline by calling `AiCompletionService`.

## 3. Provider abstraction

`AiProviderAdapter` (`complete` + `stream(AsyncIterable)` + `isConfigured`) is the
sole seam. Adapters are thin **HTTP clients over each vendor's REST API** — no
vendor SDK is imported anywhere, so "application code never depends on a provider
SDK" is true by construction. `ProviderRegistryService` indexes adapters by the
`AiProvider` enum; the orchestrator asks for the _resolved_ provider and never
knows the concrete class → **swapping providers is a config change**. Shipped:
OpenAI, Anthropic, Gemini. Reserved extension points (config + enum already
present, adapter is a subclass away): Azure OpenAI, Ollama, OpenRouter, LM Studio,
self-hosted — the first four are OpenAI-compatible and reuse `OpenAiCompatibleAdapter`.

## 4. Prompt management

Versioned templates (`{{variable}}` syntax): catalogue-seeded (`prompt-catalog.ts`)

- DB-backed (`ai_prompt_templates`, unique `(key, version)`, one `active` per key).
  Rendering + validation live in **one** module (`prompt-renderer.ts`): `extractVariables`,
  `validateTemplateBody` (used-must-be-declared), `renderTemplate` (throws on missing
  var). Registry serves the active version by default; preview returns rendered text +
  estimated tokens. Categories via `PromptCategory`.

## 5. Streaming

Provider-independent SSE protocol: `start → delta* → (progress) → done | error`.
`sse.util.ts` formats the wire; adapters yield normalized `ProviderStreamChunk`s
parsed by the shared `sse-parser`. **Cancellation**: controller wires `req`'close'
→ `AbortController` → `request.signal` (the SSE parser stops + releases the
connection). **Timeout**: orchestrator composes `AbortSignal.timeout(env.requestTimeoutMs)`
with the caller signal; a timed-out call surfaces `AI_TIMEOUT`. **Partial responses**:
each `delta` is emitted as it arrives and accumulated for final persistence/safety.
Errors surface as a terminal `error` event carrying a stable `ERROR_CODES` string.

## 6. Conversation architecture

`ai_conversations` (mutable) + `ai_messages` (append-only). `ConversationService`
owns storage, message history, metadata (title/status/counters), **continuation**
(prior turns fed back as neutral messages, trimmed to `AI_CONVERSATION_MAX_MESSAGES`),
deletion (hard delete cascades messages in a transaction), and **export** (portable
JSON). Owner-scoped — a foreign/missing id is `AI_CONVERSATION_NOT_FOUND`. The
orchestrator reuses it for history + persistence; no feature re-implements it.

## 7. Token accounting

`ai_usage_logs` (append-only, one row per call). `UsageService` records usage,
aggregates per **user** and per **feature** over **daily / monthly / lifetime**
windows, and enforces per-user daily+monthly **token caps** (org defaults from
`aiConfig`; 0 = unlimited) via `assertWithinLimits` before a call. Cost math is
the single shared `estimateAiCostUsd` (`@qalam/shared`) so client + server agree.
Authoritative counts come from provider `usage`; a heuristic pre-count guards
input length + context window.

## 8. Configuration architecture

Three layers, merged + clamped in `AiConfigService` (the only merge point): env
baseline (`aiConfig`) → org defaults (`ai_org_config`, admin) → user overrides
(`ai_config_overrides`, per user). Knobs: provider, model, temperature, topP,
maxTokens, frequency/presence penalty, stop, streaming, safety. Params clamped to
`AI_PARAM_BOUNDS`; `maxTokens` capped to the model. Feature flags **reuse** the
existing settings subsystem — `feature.ai.enabled` (master) + `feature.ai.<name>.enabled`
per feature (all seeded disabled). Provider keys are env-only secrets, never
returned to any client (admin sees a `configured` boolean).

## 9. State management summary (all surfaces)

- **Backend** — session/streaming state is per-request (AbortController + async
  generators); durable state is the seven `ai_*` tables via repositories.
- **React frontend / admin** — server state in **TanStack Query** (`qk.ai.*`
  namespace), transient stream tokens + "assistant typing" in local/**Zustand** UI
  state, settled result written to the Query cache. New primitive: a `stream()`
  reader added to `src/lib/api-client.ts` (reuses base URL, bearer, `credentials`,
  `AbortSignal`) — `EventSource` can't send auth headers, so a `fetch`+ReadableStream
  reader is used. Admin config/flags reuse the `settings` feature; usage dashboards
  reuse the `analytics` ECharts + stat-card patterns.
- **Flutter** — Riverpod (DI + state): a `features/ai/` module (domain/data/
  presentation), an `AiRepository` over new `ApiPaths`, a **`StreamNotifier`**
  accumulating tokens into `AsyncValue`, a `stream()` method on `ApiClient` (Dio
  `ResponseType.stream` + `CancelToken`), and an `enableAi` compile-time flag
  mirroring `enablePush`. Provider gate: fetch `GET /ai/features`.

## 10. API integration summary

All under `/api/v1` (envelope + guards + rate limits as per `docs/05`). Streaming
endpoints are `text/event-stream` (outside the envelope by design, like `/metrics`).

- `GET /ai/features` · `GET /ai/models` · `GET|PATCH /ai/config` · `GET /ai/usage/me`
- `POST /ai/completions` · `POST /ai/completions/stream`
- `POST|GET /ai/conversations` · `GET|PATCH|DELETE /ai/conversations/:id` · `GET /ai/conversations/:id/export`
- `GET /admin/ai/providers` · `GET /admin/ai/models` · `GET|PUT /admin/ai/config`
  · `GET /admin/ai/prompts` · `GET /admin/ai/prompts/:key/versions`
  · `POST /admin/ai/prompts/:key/preview` · `GET /admin/ai/usage/:userId`

Permissions: `ai.use` (user), `ai.manage` (admin). New rate tier `aiCompletion`
(20/min/user). New error codes: `AI_*` (append-only). Clients consume the wire
types from `@qalam/api-types` (`ai.ts`).

## 11. Test coverage

Backend: 21 AI unit tests (all green) — prompt renderer, token counter, safety
pipeline, **provider registry (interchangeability)**, config resolver (merge +
clamp), and the **orchestrator (full pipeline + provider-agnostic dispatch)**.
Existing 72 settings/permissions tests still pass (additions are non-breaking).
`nest build` + `tsc --noEmit` green. Migration verified up → down → up on Postgres.

## 12. Manual testing guide

1. `docker compose up -d` · `pnpm --filter backend migration:run` (creates the 7 `ai_*` tables).
2. Set at least one provider key in `backend/.env` (e.g. `OPENAI_API_KEY=…`).
3. Enable flags (admin, `settings.manage`): `PATCH /admin/feature-flags/:id` →
   `feature.ai.enabled` on (+ any `feature.ai.<name>.enabled`). Without keys/flags
   the platform is inert: `AI_PROVIDER_NOT_CONFIGURED` / `AI_DISABLED`.
4. `GET /api/v1/ai/features` → confirm enabled. `GET /ai/models` → registry list.
5. `POST /ai/completions` `{ "feature":"playground", "messages":[{"role":"user","content":"Hello"}] }`
   → envelope with content + usage + estimatedCostUsd.
6. `POST /ai/completions/stream` (same body) → SSE `start`→`delta…`→`done`; abort the
   request mid-stream → server stops (cancellation).
7. Conversations: `POST /ai/conversations` → use its id on a completion → `GET /ai/conversations/:id`
   shows persisted turns → `GET …/export` → `DELETE …`.
8. **Provider swap**: `PATCH /ai/config { "provider":"anthropic" }` (or org default) →
   re-run step 5; response `provider` changes with zero code change.
9. Usage: `GET /ai/usage/me` → tokens/cost accrue per feature; lower
   `AI_DAILY_TOKEN_LIMIT` to see `AI_USAGE_LIMIT_EXCEEDED`.

## 13. Future compatibility (confirmation)

Every future AI capability — Grammar, Craft Coach, Rewrite, Expand, Shorten, Title
Suggestions, Synopsis, Character/Plot Analysis, Semantic Search, Recommendations,
Moderation assistance, Voice Dictation, Image Generation, Multi-modal, Collaborative
AI — reuses this platform **without architectural change**: a feature is a feature
flag (already keyable) + a prompt template (catalogue entry) + optionally a context
provider (register under `AI_CONTEXT_PROVIDERS`) and/or safety hook (register under
`AI_SAFETY_HOOKS`), then a call to `AiCompletionService`. New providers = a new
adapter class. New models = a catalogue entry. Nothing above the provider port,
and no existing `v1` contract, changes.

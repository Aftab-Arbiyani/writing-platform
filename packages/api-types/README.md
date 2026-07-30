# @qalam/api-types

The wire contract — _one OpenAPI spec, three consumers_ (ADR §2, §5).

## Codegen pipeline

1. The backend's Swagger decorators produce `/docs` and an exported **`openapi.json`**
   build artifact (ADR §3 — the spec is a build artifact, not after-the-fact docs).
2. `pnpm --filter @qalam/api-types generate` runs **openapi-typescript** against that
   spec and writes `src/generated/api.d.ts`.
3. The **Flutter** app consumes the _same_ `openapi.json` via `openapi-generator`
   (Dart) — one contract, zero drift between web, admin, and mobile.

The `generate` script currently exits 1 with a message: the backend does not emit
`openapi.json` until Phase 1. Once it does, replace the script with the real
`openapi-typescript <path-to-openapi.json> -o src/generated/api.d.ts` invocation.

## Contents

- `src/manual.ts` — handwritten helpers; re-exports the envelope types
  (`ApiResponse`, `ApiSuccess`, `ApiFailure`, `CursorMeta`, `OffsetMeta`) from
  `@qalam/shared`, plus the placeholder `AuthTokens`.
- `src/generated/` — codegen output only. Never edit by hand.

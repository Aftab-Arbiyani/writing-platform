/**
 * @qalam/api-types — the wire contract (ADR §2).
 *
 * `src/generated/` is populated from the backend's exported `openapi.json`
 * via `pnpm --filter @qalam/api-types generate` (openapi-typescript). Until
 * the backend emits the spec (Phase 1), only the handwritten manual types
 * exist — once `src/generated/api.d.ts` lands, re-export it here alongside
 * `./manual`.
 */
export * from './manual.js';
export * from './ai.js';
export * from './story.js';

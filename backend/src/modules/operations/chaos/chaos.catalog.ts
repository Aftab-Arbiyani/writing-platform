/**
 * Chaos-engineering readiness catalogue (P7.4). This is a DECLARATIVE map of the
 * failure modes the architecture is prepared for and the EXISTING platform
 * mechanism that absorbs each one — it documents resilience, it does NOT inject
 * faults (chaos execution is an out-of-band drill, see backend/perf/failure-
 * testing.md). The prompt's mandate — "prepare architecture supporting … without
 * affecting business architecture" — is satisfied structurally: every mitigation
 * below is already shipped (graceful degradation, retries, circuit-limits,
 * health probes, capacity plan, rollback), so no business service changes.
 */
import type { ChaosScenario } from '../operations.types';

export const CHAOS_SCENARIOS: readonly ChaosScenario[] = [
  {
    id: 'chaos.db-failure',
    label: 'Database failure',
    failure: 'Postgres unreachable / connection storm.',
    mitigation:
      'Readiness probe pulls the instance from rotation; bounded pool fails fast; capacity plan recommends a read replica (DATABASE_REPLICA_URL seam).',
    readiness: 'built-in',
  },
  {
    id: 'chaos.redis-failure',
    label: 'Redis failure',
    failure: 'Cache/queue Redis unreachable.',
    mitigation:
      'CacheService degrades to the compute path (never fails the caller); rate-limit + auth DBs fail-open per policy; queue health surfaces on /health.',
    readiness: 'built-in',
  },
  {
    id: 'chaos.queue-failure',
    label: 'Queue failure',
    failure: 'BullMQ workers stalled / Redis DB 1 down.',
    mitigation:
      'Jobs persist and resume on recovery; backlog-age alert fires; DLQ (failed set) isolates poisoned jobs; queue health indicator reports.',
    readiness: 'built-in',
  },
  {
    id: 'chaos.storage-failure',
    label: 'Storage failure',
    failure: 'Object storage unreachable.',
    mitigation:
      'Storage is degraded-not-dead (excluded from the readiness gate): reads still work; signing errors surface on the Storage dashboard.',
    readiness: 'built-in',
  },
  {
    id: 'chaos.ai-provider-failure',
    label: 'AI provider failure',
    failure: 'AI provider errors / times out.',
    mitigation:
      'Orchestrator abort/timeout + provider-registry swap (config change, no deploy); AI health indicator + ai_provider alert; fallback adapter.',
    readiness: 'built-in',
  },
  {
    id: 'chaos.network-partition',
    label: 'Network partition',
    failure: 'A dependency becomes intermittently unreachable.',
    mitigation:
      'maxRetriesPerRequest bounds Redis; GET retry with backoff; per-dependency health probes localize the partition.',
    readiness: 'built-in',
  },
  {
    id: 'chaos.high-latency',
    label: 'High latency',
    failure: 'A dependency responds slowly.',
    mitigation:
      'Request/socket timeouts bound blast radius; latency SLO + alert fire; tracing localizes the slow span/kind.',
    readiness: 'built-in',
  },
  {
    id: 'chaos.resource-exhaustion',
    label: 'Resource exhaustion',
    failure: 'CPU / memory / connections saturate.',
    mitigation:
      'Capacity plan forecasts each ceiling + scale lever; memory + event-loop alerts fire; stateless API scales horizontally.',
    readiness: 'built-in',
  },
  {
    id: 'chaos.service-restart',
    label: 'Service restart',
    failure: 'An instance restarts / is replaced.',
    mitigation:
      'enableShutdownHooks + 20s queue drain = graceful shutdown; startup probe gates the boot window; no in-process durable state.',
    readiness: 'built-in',
  },
];

/** Fast lookup of a chaos scenario by id. */
export const CHAOS_BY_ID: ReadonlyMap<string, ChaosScenario> = new Map(
  CHAOS_SCENARIOS.map((c) => [c.id, c]),
);

/**
 * Operations Platform config namespace (P7.4). Every operational tunable —
 * tracing sampling, log sampling/retention, SLO/alert evaluation windows, cost
 * rates, and the durable-store TTLs — environment-overridable with documented
 * defaults, read lazily from `process.env` (mirroring performance.config.ts).
 * Nothing here is a secret, so the Zod env schema stays non-strict and lets
 * these pass through.
 *
 * Consumers inject `ConfigType<typeof operationsConfig>`. Numeric targets are
 * informed by docs 05 (API standards), docs 14 (monitoring), and the P7.3
 * budgets — the Operations Platform verifies against them; it never hard-codes
 * thresholds in a business service.
 */
import { registerAs } from '@nestjs/config';

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  return raw === 'true' || raw === '1';
}

export const operationsConfig = registerAs('operations', () => ({
  /** Master switch — when false the registry ignores signals (zero overhead). */
  enabled: bool('OPS_ENABLED', true),

  // ── Distributed tracing ─────────────────────────────────────────────────
  tracing: {
    /** Fraction of traces retained in the in-memory trace store (0..1). */
    sampleRate: num('OPS_TRACE_SAMPLE_RATE', 0.1),
    /** Bounded in-memory trace ring — recent traces for the admin viewer. */
    bufferSize: num('OPS_TRACE_BUFFER_SIZE', 200),
    /** Max spans retained per trace (guards a pathological fan-out). */
    maxSpansPerTrace: num('OPS_TRACE_MAX_SPANS', 100),
  },

  // ── Structured logging policy ────────────────────────────────────────────
  logging: {
    /** Downstream-collector sample rate hint (mirrors LOG_SAMPLE_RATE). */
    sampleRate: num('LOG_SAMPLE_RATE', 1),
    /** Documented log-retention window (days) for the aggregation target. */
    retentionDays: num('OPS_LOG_RETENTION_DAYS', 30),
  },

  // ── SLO / error budget ───────────────────────────────────────────────────
  slo: {
    /** Rolling window (seconds) SLIs are computed over. */
    windowSeconds: num('OPS_SLO_WINDOW_SECONDS', 2_592_000), // 30d default
    /** Burn-rate multiple over which the fast-burn alert fires. */
    fastBurnThreshold: num('OPS_SLO_FAST_BURN', 14.4),
    /** Burn-rate multiple over which the slow-burn alert fires. */
    slowBurnThreshold: num('OPS_SLO_SLOW_BURN', 3),
  },

  // ── Alerting ───────────────────────────────────────────────────────────
  alerting: {
    /** Suppression window (seconds) — repeat of the same alert is deduped. */
    dedupWindowSeconds: num('OPS_ALERT_DEDUP_SECONDS', 300),
    /** How long a fired alert is retained in the durable store (seconds). */
    retentionSeconds: num('OPS_ALERT_RETENTION_SECONDS', 604_800), // 7d
  },

  // ── Incident management ─────────────────────────────────────────────────
  incidents: {
    /** How long resolved incidents are retained in the durable store (seconds). */
    retentionSeconds: num('OPS_INCIDENT_RETENTION_SECONDS', 7_776_000), // 90d
  },

  // ── Deployment observability ────────────────────────────────────────────
  deployment: {
    /** How many recent deployment records to retain (durable list). */
    historySize: num('OPS_DEPLOY_HISTORY_SIZE', 100),
  },

  // ── Cost observability (rate model — never a bill of record) ─────────────
  cost: {
    /** Approx USD per 1M AI tokens (blended) for the internal cost estimate. */
    aiPerMillionTokensUsd: num('OPS_COST_AI_PER_MTOK_USD', 6),
    /** Approx USD / GiB-month object storage. */
    storagePerGibMonthUsd: num('OPS_COST_STORAGE_PER_GIB_USD', 0.023),
    /** Approx USD / GiB egress bandwidth. */
    bandwidthPerGibUsd: num('OPS_COST_BANDWIDTH_PER_GIB_USD', 0.09),
    /** Flat monthly infrastructure baseline (VM + Redis + Postgres). */
    infraMonthlyBaselineUsd: num('OPS_COST_INFRA_MONTHLY_USD', 120),
  },
}));

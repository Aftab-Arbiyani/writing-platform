import { Injectable, Logger } from '@nestjs/common';
import type { RetrievalFailureReason, RetrievalIntent, RetrievalQueryType } from '@qalam/shared';

import type { RetrievalTelemetry, SearchAnalyticsData } from '../retrieval.types';
import { RetrievalLogRepository } from './retrieval-log.repository';

/** What a consumer records after a full request (retrieval telemetry + LLM cost + status). */
export interface RecordInput {
  userId: string;
  storyId?: string;
  telemetry: RetrievalTelemetry;
  totalLatencyMs: number;
  llmLatencyMs?: number;
  tokenUsage?: number;
  status: 'ok' | 'degraded' | 'no_results' | 'failed';
}

/**
 * Retrieval observability (AF4). Emits comprehensive telemetry through the EXISTING
 * monitoring infrastructure — a structured Pino log line per request (query intent,
 * classification, sources, graph/ranking/assembly/LLM/total latencies, context size,
 * compression ratio, token usage, cache hit, evidence coverage, confidence, failure
 * classification) — and persists an append-only row for Search Analytics + future offline
 * evaluation. Recording is BEST-EFFORT: a telemetry failure never affects the user's
 * request. Internal telemetry only — never surfaced to end users.
 */
@Injectable()
export class RetrievalTelemetryService {
  private readonly logger = new Logger('RetrievalTelemetry');

  constructor(private readonly repo: RetrievalLogRepository) {}

  async record(input: RecordInput): Promise<void> {
    const t = input.telemetry;
    const line = {
      msg: 'retrieval.request',
      userId: input.userId,
      storyId: input.storyId ?? null,
      intent: t.intent,
      queryType: t.queryType,
      sources: t.sources.map((s) => s.source),
      totalCandidates: t.totalCandidates,
      returned: t.returned,
      retrievalLatencyMs: t.retrievalLatencyMs,
      rankingLatencyMs: t.rankingLatencyMs,
      contextAssemblyMs: t.contextAssemblyMs,
      llmLatencyMs: input.llmLatencyMs ?? 0,
      totalLatencyMs: input.totalLatencyMs,
      contextTokens: t.contextTokens,
      compressionRatio: Number(t.compressionRatio.toFixed(2)),
      tokenUsage: input.tokenUsage ?? 0,
      cacheHit: t.cacheHit,
      evidenceCount: t.evidenceCount,
      confidence: Number(t.confidence.toFixed(2)),
      status: input.status,
      failureReason: t.failureReason,
    };
    // Structured line for the existing log pipeline (metrics/alerts scrape this).
    this.logger.log(JSON.stringify(line));

    try {
      await this.repo.record({
        userId: input.userId,
        intent: t.intent,
        queryType: t.queryType,
        storyId: input.storyId ?? null,
        sources: t.sources.map((s) => s.source),
        totalCandidates: t.totalCandidates,
        returned: t.returned,
        retrievalLatencyMs: t.retrievalLatencyMs,
        rankingLatencyMs: t.rankingLatencyMs,
        contextAssemblyMs: t.contextAssemblyMs,
        llmLatencyMs: input.llmLatencyMs ?? 0,
        totalLatencyMs: input.totalLatencyMs,
        contextTokens: t.contextTokens,
        compressionRatio: t.compressionRatio,
        tokenUsage: input.tokenUsage ?? 0,
        cacheHit: t.cacheHit,
        evidenceCount: t.evidenceCount,
        confidence: t.confidence,
        status: input.status,
        failureReason: t.failureReason,
      });
    } catch (error) {
      this.logger.warn(`telemetry persist failed: ${(error as Error).message}`);
    }
  }

  /** Aggregate internal Search Analytics over a trailing window (admin-only). */
  async getAnalytics(windowDays: number): Promise<SearchAnalyticsData> {
    const from = new Date(Date.now() - windowDays * 86_400_000);
    const rows = await this.repo.since(from);
    const total = rows.length;

    const byIntent = countBy(rows, (r) => r.intent).map(([intent, count]) => ({
      intent: intent as RetrievalIntent,
      count,
    }));
    const byQueryType = countBy(rows, (r) => r.queryType).map(([queryType, count]) => ({
      queryType: queryType as RetrievalQueryType,
      count,
    }));
    const failureBreakdown = countBy(
      rows.filter((r) => r.failureReason !== null),
      (r) => r.failureReason as string,
    ).map(([reason, count]) => ({ reason: reason as RetrievalFailureReason, count }));

    const latencies = rows.map((r) => r.totalLatencyMs).sort((a, b) => a - b);
    const zeroResults = rows.filter((r) => r.returned === 0).length;
    const cacheHits = rows.filter((r) => r.cacheHit).length;

    return {
      window: `${windowDays}d`,
      totalQueries: total,
      byIntent,
      byQueryType,
      zeroResultRate: ratio(zeroResults, total),
      avgLatencyMs: mean(latencies),
      p95LatencyMs: percentile(latencies, 0.95),
      avgConfidence: mean(rows.map((r) => r.confidence)),
      cacheHitRatio: ratio(cacheHits, total),
      avgContextTokens: mean(rows.map((r) => r.contextTokens)),
      failureBreakdown,
    };
  }
}

function countBy<T>(rows: T[], key: (row: T) => string): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function ratio(part: number, total: number): number {
  return total > 0 ? Number((part / total).toFixed(3)) : 0;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx] ?? 0;
}

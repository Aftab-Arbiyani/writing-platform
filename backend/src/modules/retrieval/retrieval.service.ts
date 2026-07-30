import { Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES, RetrievalFailureReason } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';
import { ContextAssemblerService } from './context/context-assembler.service';
import { EvidenceService } from './evidence/evidence.service';
import { QueryClassifierService } from './planner/query-classifier.service';
import { RetrievalPlannerService } from './planner/retrieval-planner.service';
import { RANKING_STRATEGY, type RankingStrategy } from './ports/ranking.port';
import { RETRIEVERS, type Retriever } from './ports/retriever.port';
import { RetrievalConfigService } from './retrieval-config.service';
import { RetrievalFailedException } from './retrieval.exceptions';
import type {
  RetrievalCandidate,
  RetrievalPlan,
  RetrievalRequest,
  RetrievalResult,
  RetrievalTelemetry,
  SourceRunMetric,
} from './retrieval.types';

/**
 * The Retrieval Platform orchestrator (AF4) — the SINGLE ENTRY POINT every AI capability
 * routes through. It runs the fixed pipeline: classify → plan → retrieve (parallel across
 * the planned, available sources, each time-bounded) → rank → assemble context. It NEVER
 * calls an LLM (the LLM step is the consumer's — grounded in this result), NEVER touches a
 * source's storage directly (only via `Retriever`s), and NEVER lets one source's failure
 * crash the request (per-source failures degrade gracefully; an owner/existence
 * STORY_NOT_FOUND is surfaced; a total failure is a clean 503). Future capabilities reuse
 * this verbatim — no duplicated retrieval/ranking/graph/search logic anywhere.
 */
@Injectable()
export class RetrievalService {
  constructor(
    @Inject(RETRIEVERS) private readonly retrievers: Retriever[],
    @Inject(RANKING_STRATEGY) private readonly ranking: RankingStrategy,
    private readonly planner: RetrievalPlannerService,
    private readonly classifier: QueryClassifierService,
    private readonly assembler: ContextAssemblerService,
    private readonly evidence: EvidenceService,
    private readonly config: RetrievalConfigService,
  ) {}

  async retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    const cfg = await this.config.getConfig();
    const queryType = this.classifier.classify(request.query, request.queryType);
    const plan = this.planner.plan({ ...request, queryType }, cfg);

    // Only run planned sources that are available right now (skips the inert vector source).
    const active: Retriever[] = [];
    for (const source of plan.sources) {
      const retriever = this.retrievers.find((r) => r.source === source);
      if (retriever !== undefined && (await retriever.isAvailable())) active.push(retriever);
    }

    const retrievalStart = Date.now();
    const settled = await Promise.allSettled(active.map((r) => this.runSource(r, plan, request)));
    const retrievalLatencyMs = Date.now() - retrievalStart;

    const sourceMetrics: SourceRunMetric[] = [];
    const candidates: RetrievalCandidate[] = [];
    let anyOk = false;

    settled.forEach((result, i) => {
      const retriever = active[i] as Retriever;
      if (result.status === 'fulfilled') {
        anyOk = true;
        candidates.push(...result.value.candidates);
        sourceMetrics.push({
          source: retriever.source,
          candidates: result.value.candidates.length,
          latencyMs: result.value.latencyMs,
          ok: true,
        });
      } else {
        // An owner/existence error is a real signal the consumer must surface (404) — do
        // NOT bury it as a degraded source.
        if (isStoryNotFound(result.reason)) throw result.reason as AppException;
        sourceMetrics.push({ source: retriever.source, candidates: 0, latencyMs: 0, ok: false });
      }
    });

    // Every attempted source failed → the retrieval phase is down (clean 503).
    if (!anyOk && active.length > 0) throw new RetrievalFailedException();

    const rankingStart = Date.now();
    const ranked = this.ranking.rank(candidates, plan, request);
    const rankingLatencyMs = Date.now() - rankingStart;

    const assemblyStart = Date.now();
    const context = this.assembler.assemble(ranked, plan.contextTokens);
    const contextAssemblyMs = Date.now() - assemblyStart;

    const telemetry: RetrievalTelemetry = {
      intent: plan.intent,
      queryType: plan.queryType,
      sources: sourceMetrics,
      totalCandidates: candidates.length,
      returned: ranked.length,
      retrievalLatencyMs,
      rankingLatencyMs,
      contextAssemblyMs,
      contextTokens: context.tokenCount,
      compressionRatio: context.compressionRatio,
      cacheHit: false,
      evidenceCount: context.evidence.length,
      confidence: this.evidence.aggregateConfidence(ranked),
      degraded: sourceMetrics.some((m) => !m.ok),
      failureReason: ranked.length === 0 ? RetrievalFailureReason.NoResults : null,
    };

    return { plan, candidates: ranked, context, telemetry };
  }

  private async runSource(
    retriever: Retriever,
    plan: RetrievalPlan,
    request: RetrievalRequest,
  ): Promise<{ candidates: RetrievalCandidate[]; latencyMs: number }> {
    const start = Date.now();
    const candidates = await withTimeout(retriever.retrieve(plan, request), plan.timeoutMs);
    return { candidates, latencyMs: Date.now() - start };
  }
}

/** Reject if the promise doesn't settle within `ms` (bounds one source's latency). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('retrieval source timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

function isStoryNotFound(reason: unknown): boolean {
  return reason instanceof AppException && reason.code === ERROR_CODES.STORY_NOT_FOUND;
}

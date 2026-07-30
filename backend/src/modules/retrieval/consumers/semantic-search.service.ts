import { Injectable } from '@nestjs/common';
import { AiFeature, AiMessageRole, RetrievalIntent } from '@qalam/shared';

import { AiCompletionService } from '../../ai';
import { AiFeatureService } from '../../ai';
import type { SemanticSearchDto } from '../dto/retrieval-request.dto';
import type { SemanticSearchResponseDto } from '../dto/retrieval-response.dto';
import { RetrievalTelemetryService } from '../observability/retrieval-telemetry.service';
import { RetrievalCacheService } from '../retrieval-cache.service';
import { RETRIEVAL_CACHE_TTL_SECONDS } from '../retrieval.constants';
import { RetrievalService } from '../retrieval.service';
import type { RetrievalRequest, RetrievalResult } from '../retrieval.types';
import { toResponseMeta, toSearchResultItem } from '../retrieval.mappers';

/**
 * Semantic Search (AF4). The consumer that turns a query into ranked, grounded, explainable
 * results — and, optionally, a grounded natural-language answer. It gates the SemanticSearch
 * feature (AF1 flag), runs the reusable RetrievalService pipeline (cached), and ONLY when
 * synthesis is requested does it call the AF1 orchestrator with the ASSEMBLED context (never
 * the raw query) so the answer is grounded. Records telemetry for every request.
 */
@Injectable()
export class SemanticSearchService {
  constructor(
    private readonly retrieval: RetrievalService,
    private readonly completion: AiCompletionService,
    private readonly features: AiFeatureService,
    private readonly cache: RetrievalCacheService,
    private readonly telemetry: RetrievalTelemetryService,
  ) {}

  async search(userId: string, dto: SemanticSearchDto): Promise<SemanticSearchResponseDto> {
    await this.features.assertEnabled(AiFeature.SemanticSearch);
    const start = Date.now();

    const request: RetrievalRequest = {
      userId,
      query: dto.query,
      intent: RetrievalIntent.Search,
      storyId: dto.storyId,
      queryType: dto.queryType,
      limit: dto.limit ?? 0,
      synthesize: dto.synthesize,
      filters: {
        language: dto.language,
        genre: dto.genre,
        tags: dto.tags
          ?.split(',')
          .map((t) => t.trim())
          .filter((t) => t !== ''),
      },
    };

    // Retrieval results are cached (read-through); a graph STORY_NOT_FOUND still propagates.
    const cacheKey = this.cache.key(
      'search',
      dto.storyId,
      dto.queryType,
      dto.limit,
      dto.query.toLowerCase().trim(),
    );
    const { value: result, hit } = await this.cache.remember<RetrievalResult>(
      cacheKey,
      RETRIEVAL_CACHE_TTL_SECONDS,
      () => this.retrieval.retrieve(request),
    );

    let answer: string | null = null;
    let llmLatencyMs = 0;
    let tokenUsage = 0;
    if (dto.synthesize === true && result.plan.synthesize && result.candidates.length > 0) {
      const llmStart = Date.now();
      const output = await this.completion.complete({
        userId,
        feature: AiFeature.SemanticSearch,
        promptKey: 'semantic_search.answer',
        promptVariables: { query: dto.query, context: result.context.text },
        messages: [{ role: AiMessageRole.User, content: dto.query }],
      });
      answer = output.content;
      llmLatencyMs = Date.now() - llmStart;
      tokenUsage = output.usage.totalTokens;
    }

    await this.telemetry.record({
      userId,
      storyId: dto.storyId,
      telemetry: { ...result.telemetry, cacheHit: hit },
      totalLatencyMs: Date.now() - start,
      llmLatencyMs,
      tokenUsage,
      status:
        result.candidates.length === 0
          ? 'no_results'
          : result.telemetry.degraded
            ? 'degraded'
            : 'ok',
    });

    return {
      query: dto.query,
      intent: result.plan.intent,
      queryType: result.plan.queryType,
      answer,
      results: result.candidates.map(toSearchResultItem),
      evidence: result.context.evidence,
      meta: toResponseMeta(result),
    };
  }

  /** Query suggestions: the top result titles for a short prefix (cheap, no LLM). */
  async suggestions(userId: string, q: string, storyId?: string): Promise<string[]> {
    await this.features.assertEnabled(AiFeature.SemanticSearch);
    const result = await this.retrieval.retrieve({
      userId,
      query: q,
      intent: RetrievalIntent.Search,
      storyId,
      limit: 8,
    });
    return result.candidates.slice(0, 8).map((c) => c.title);
  }
}

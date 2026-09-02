import { Injectable } from '@nestjs/common';
import { RetrievalIntent } from '@qalam/shared';

import type { SemanticSearchDto } from '../dto/retrieval-request.dto';
import type { SemanticSearchResponseDto } from '../dto/retrieval-response.dto';
import { RetrievalTelemetryService } from '../observability/retrieval-telemetry.service';
import { RetrievalCacheService } from '../retrieval-cache.service';
import { RETRIEVAL_CACHE_TTL_SECONDS } from '../retrieval.constants';
import { RetrievalQueryInvalidException } from '../retrieval.exceptions';
import { RetrievalService } from '../retrieval.service';
import type { RetrievalRequest, RetrievalResult } from '../retrieval.types';
import { toResponseMeta, toSearchResultItem } from '../retrieval.mappers';

/**
 * Search (AF4 retrieval engine). Turns a query into ranked, grounded, explainable results by
 * running the reusable RetrievalService pipeline (cached) and recording telemetry. **No LLM
 * is involved** — D5 removed the optional grounded synthesis, so this consumer no longer
 * depends on the AI module at all and needs no feature flag or entitlement.
 *
 * `userId` is nullable: the endpoint is public (E8 parity). An anonymous caller gets the
 * keyword + metadata sources; the knowledge-graph source is owner-scoped and contributes
 * nothing, which is why a story-scoped query without a user is refused up front rather than
 * silently returning an empty library search.
 */
@Injectable()
export class SemanticSearchService {
  constructor(
    private readonly retrieval: RetrievalService,
    private readonly cache: RetrievalCacheService,
    private readonly telemetry: RetrievalTelemetryService,
  ) {}

  async search(userId: string | null, dto: SemanticSearchDto): Promise<SemanticSearchResponseDto> {
    this.assertScopeReachable(userId, dto.storyId);
    const start = Date.now();

    const request: RetrievalRequest = {
      userId,
      query: dto.query,
      intent: RetrievalIntent.Search,
      storyId: dto.storyId,
      queryType: dto.queryType,
      limit: dto.limit ?? 0,
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

    await this.telemetry.record({
      userId,
      storyId: dto.storyId,
      telemetry: { ...result.telemetry, cacheHit: hit },
      totalLatencyMs: Date.now() - start,
      llmLatencyMs: 0,
      tokenUsage: 0,
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
      /**
       * Always `null` since D5 removed synthesis. The field stays on the wire until the
       * coordinated vocabulary contract so a client built against the old shape keeps
       * compiling; nothing populates it.
       */
      answer: null,
      results: result.candidates.map(toSearchResultItem),
      evidence: result.context.evidence,
      meta: toResponseMeta(result),
    };
  }

  /** Query suggestions: the top result titles for a short prefix. */
  async suggestions(userId: string | null, q: string, storyId?: string): Promise<string[]> {
    this.assertScopeReachable(userId, storyId);
    const result = await this.retrieval.retrieve({
      userId,
      query: q,
      intent: RetrievalIntent.Search,
      storyId,
      limit: 8,
    });
    return result.candidates.slice(0, 8).map((c) => c.title);
  }

  /**
   * A story-scoped plan draws on the knowledge graph (owner-scoped) and the vector source
   * (inert), so an anonymous caller would get a silent empty result that reads like "this
   * story has nothing in it". Refuse instead, and say why.
   */
  private assertScopeReachable(userId: string | null, storyId?: string): void {
    if (userId === null && storyId !== undefined && storyId !== '') {
      throw new RetrievalQueryInvalidException('Sign in to search within a story.');
    }
  }
}

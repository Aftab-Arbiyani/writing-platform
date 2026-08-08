import { Injectable } from '@nestjs/common';
import {
  AiFeature,
  RecommendationKind,
  RetrievalIntent,
  RetrievalQueryType,
  RetrievalSource,
  SearchSort,
} from '@qalam/shared';

import { AiFeatureService } from '../../ai';
import { DiscoveryService } from '../../feed/discovery.service';
import { TrendingService } from '../../feed/trending.service';
import { PiecesService } from '../../pieces/pieces.service';
import { SearchService } from '../../search';
import type { StoryGraphDto } from '../../story-intelligence/dto/story-response.dto';
import { StoryIntelligenceService } from '../../story-intelligence/story-intelligence.service';
import type { RecommendationQueryDto } from '../dto/retrieval-request.dto';
import type {
  RecommendationItemDto,
  RecommendationResponseDto,
} from '../dto/retrieval-response.dto';
import { RetrievalTelemetryService } from '../observability/retrieval-telemetry.service';
import type { RelatedEntity } from '../retrieval.types';
import { clamp01, saturating } from '../retrieval.text.util';

const DEFAULT_LIMIT = 10;

/**
 * Recommendation Engine (AF4). EVERY recommendation explains itself (a reason, the entities
 * that influenced it, supporting evidence, a confidence). It never builds a parallel
 * recommendation/search/graph stack — it composes the exported TrendingService,
 * DiscoveryService, SearchService, and the story graph. Story-scoped kinds derive from the
 * knowledge graph (SSOT); library kinds reuse the feed/discovery signals. Reading history is
 * client-local (docs M3), so ContinueReading uses community signal as an honest proxy.
 */
@Injectable()
export class RecommendationService {
  constructor(
    private readonly features: AiFeatureService,
    private readonly trending: TrendingService,
    private readonly discovery: DiscoveryService,
    private readonly search: SearchService,
    private readonly story: StoryIntelligenceService,
    // Read-only seed lookup for piece-scoped kinds, through the pieces module's own exported
    // service so its visibility rules are the ones that apply (never a direct repository read).
    private readonly pieces: PiecesService,
    private readonly telemetry: RetrievalTelemetryService,
  ) {}

  async recommend(userId: string, dto: RecommendationQueryDto): Promise<RecommendationResponseDto> {
    await this.features.assertEnabled(AiFeature.Recommendations, userId);
    const start = Date.now();
    const limit = Math.min(Math.max(dto.limit ?? DEFAULT_LIMIT, 1), 50);

    const items = await this.byKind(userId, dto, limit);
    const confidence =
      items.length > 0 ? items.reduce((s, i) => s + i.confidence, 0) / items.length : 0;

    await this.telemetry.record({
      userId,
      storyId: dto.storyId,
      telemetry: {
        intent: RetrievalIntent.Recommend,
        queryType: RetrievalQueryType.NaturalLanguage,
        sources: [],
        totalCandidates: items.length,
        returned: items.length,
        retrievalLatencyMs: Date.now() - start,
        rankingLatencyMs: 0,
        contextAssemblyMs: 0,
        contextTokens: 0,
        compressionRatio: 1,
        cacheHit: false,
        evidenceCount: items.length,
        confidence,
        degraded: false,
        failureReason: items.length === 0 ? null : null,
      },
      totalLatencyMs: Date.now() - start,
      status: items.length === 0 ? 'no_results' : 'ok',
    });

    return {
      kind: dto.kind,
      items,
      meta: {
        sources: [],
        totalCandidates: items.length,
        returned: items.length,
        confidence: Number(confidence.toFixed(3)),
        degraded: false,
      },
    };
  }

  private async byKind(
    userId: string,
    dto: RecommendationQueryDto,
    limit: number,
  ): Promise<RecommendationItemDto[]> {
    switch (dto.kind) {
      case RecommendationKind.Trending: {
        const page = await this.trending.getFeed(undefined, limit);
        return page.items.map((p, i) =>
          this.pieceRec(
            p,
            dto.kind,
            'Trending across the community right now',
            [],
            positional(i, page.items.length),
          ),
        );
      }
      case RecommendationKind.Feed:
      case RecommendationKind.ContinueReading: {
        const query = { limit } as Parameters<DiscoveryService['getPieces']>[0];
        const page = await this.discovery.getPieces(query);
        const reason =
          dto.kind === RecommendationKind.ContinueReading
            ? 'Popular reads to pick up next'
            : 'Recommended for you from across Qalam';
        return page.items.map((p, i) =>
          this.pieceRec(p, dto.kind, reason, [], positional(i, page.items.length)),
        );
      }
      case RecommendationKind.Authors: {
        const query = { limit } as Parameters<DiscoveryService['getWriters']>[0];
        const page = await this.discovery.getWriters(query);
        return page.items.map((w, i) =>
          this.writerRec(w, dto.kind, positional(i, page.items.length)),
        );
      }
      case RecommendationKind.Genres: {
        const query = { limit } as Parameters<DiscoveryService['getTrendingGenres']>[0];
        const page = await this.discovery.getTrendingGenres(query);
        return page.items.map((g, i) =>
          this.taxRec(g, dto.kind, 'genre', 'A trending genre', positional(i, page.items.length)),
        );
      }
      case RecommendationKind.RelatedTopics: {
        if (isStory(dto.storyId)) return this.graphTopics(userId, dto.storyId, dto.kind, limit);
        const query = { limit } as Parameters<DiscoveryService['getTrendingTags']>[0];
        const page = await this.discovery.getTrendingTags(query);
        return page.items.map((t, i) =>
          this.taxRec(t, dto.kind, 'topic', 'A trending topic', positional(i, page.items.length)),
        );
      }
      case RecommendationKind.RelatedStories:
        return this.relatedStories(userId, dto, limit);
      case RecommendationKind.RelatedCharacters:
        return isStory(dto.storyId)
          ? this.graphCharacters(userId, dto.storyId, dto.kind, limit)
          : [];
      case RecommendationKind.RelatedChapters:
        return isStory(dto.storyId) ? this.graphChapters(userId, dto.storyId, dto.kind, limit) : [];
      case RecommendationKind.Collections:
        // No collections read-surface is exported yet — return empty gracefully (documented seam).
        return [];
      default:
        return [];
    }
  }

  /**
   * Related stories, from the most specific seed available:
   *
   * 1. **`storyId`** — the story graph's salient entities (the SSOT wins when there is one).
   * 2. **`pieceId`** — the seed piece's own tags + title ({@link relatedToPiece}).
   * 3. **neither** — community trending, which is honest but is NOT "related", so its reason says
   *    "Popular right now" rather than claiming a relationship it cannot support.
   */
  private async relatedStories(
    userId: string,
    dto: RecommendationQueryDto,
    limit: number,
  ): Promise<RecommendationItemDto[]> {
    if (isStory(dto.storyId)) {
      const graph = await this.story.getGraphSnapshot(userId, dto.storyId);
      const terms = topNames(graph, 6);
      if (terms.length === 0) return [];
      const influencedBy: RelatedEntity[] = terms.map((name) => ({
        id: name,
        type: 'entity',
        name,
        relation: 'shared theme',
      }));
      return this.searchRelated(userId, dto.kind, terms, influencedBy, limit, {
        reason: `Shares themes with your story: ${terms.slice(0, 3).join(', ')}`,
      });
    }

    if (isStory(dto.pieceId)) {
      return this.relatedToPiece(userId, dto, dto.pieceId, limit);
    }

    const page = await this.trending.getFeed(undefined, limit);
    return page.items.map((p, i) =>
      this.pieceRec(p, dto.kind, 'Popular right now', [], positional(i, page.items.length)),
    );
  }

  /**
   * Related stories seeded by a PIECE — the reader's "more like this" (docs/45 §4.1, W5).
   *
   * `pieceId` sat in the contract, documented on both sides of the wire, and read by nothing until
   * W5 ([48 §3.9](../../../../docs/48_PlatformParityRegister.md), W5-2): a piece-seeded request fell
   * through to community trending, so a client asking "what is like THIS piece" got whatever was
   * popular. This implements the parameter that was already advertised.
   *
   * The seed is read through `PiecesService.getById` **as the caller**, so its visibility rules
   * apply unchanged — a piece the viewer may not read surfaces as `PIECE_NOT_FOUND` rather than
   * leaking through a recommendation. Terms come from the piece's own tags plus its title, which is
   * strictly more signal than the clients' current one-tag search, and the seed is excluded from its
   * own results (the server knows the seed; a client should not have to filter it back out).
   */
  private async relatedToPiece(
    userId: string,
    dto: RecommendationQueryDto,
    pieceId: string,
    limit: number,
  ): Promise<RecommendationItemDto[]> {
    const piece = await this.pieces.getById(pieceId, userId);
    const tagNames = piece.tags.map((tag) => tag.name).filter((name) => name !== '');
    const terms = tagNames.length > 0 ? tagNames.slice(0, 6) : titleTerms(piece.title);
    if (terms.length === 0) return [];

    const influencedBy: RelatedEntity[] = tagNames.slice(0, 6).map((name) => ({
      id: name,
      type: 'tag',
      name,
      relation: 'shared tag',
    }));
    const reason =
      tagNames.length > 0
        ? `Shares tags with “${piece.title}”: ${tagNames.slice(0, 3).join(', ')}`
        : `Similar in subject to “${piece.title}”`;

    return this.searchRelated(userId, dto.kind, terms, influencedBy, limit, {
      reason,
      excludeId: piece.id,
    });
  }

  /**
   * The shared tail of both related-stories paths: run the derived terms through the E8 search
   * engine and map each hit into an explained recommendation.
   *
   * **`recordHistory: false` matters.** These terms are machine-composed, and `searchPieces`
   * otherwise writes them into the viewer's recent searches and the global keyword trends — so a
   * reader opening a piece would find `Aria mentor castle` in their own search history (48 §3.9,
   * W5-5). One extra result is fetched so excluding the seed cannot shorten the page.
   */
  private async searchRelated(
    userId: string,
    kind: RecommendationKind,
    terms: string[],
    influencedBy: RelatedEntity[],
    limit: number,
    opts: { reason: string; excludeId?: string },
  ): Promise<RecommendationItemDto[]> {
    const page = await this.search.searchPieces(
      {
        q: terms.join(' '),
        sort: SearchSort.Relevance,
        limit: opts.excludeId !== undefined ? limit + 1 : limit,
      } as Parameters<SearchService['searchPieces']>[0],
      { id: userId },
      { recordHistory: false },
    );
    const items = page.items.filter((p) => opts.excludeId === undefined || p.id !== opts.excludeId);
    const kept = items.slice(0, limit);
    return kept.map((p, i) =>
      this.pieceRec(
        p as unknown as Record<string, unknown>,
        kind,
        opts.reason,
        influencedBy,
        positional(i, kept.length),
      ),
    );
  }

  private async graphCharacters(
    userId: string,
    storyId: string,
    kind: RecommendationKind,
    limit: number,
  ): Promise<RecommendationItemDto[]> {
    const graph = await this.story.getGraphSnapshot(userId, storyId);
    const chars = graph.nodes
      .filter((n) => n.type === 'character')
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, limit);
    const byId = new Map(graph.nodes.map((n) => [n.id, n.name]));
    return chars.map((c) => {
      const rels = graph.edges
        .filter((e) => e.type === 'relationship' && (e.sourceId === c.id || e.targetId === c.id))
        .slice(0, 4)
        .map((e) => {
          const otherId = e.sourceId === c.id ? e.targetId : e.sourceId;
          return {
            id: otherId,
            type: 'character',
            name: byId.get(otherId) ?? '',
            relation: e.label || 'related',
          };
        })
        .filter((r) => r.name !== '');
      const score = clamp01(saturating(c.mentionCount, 5));
      return {
        id: c.id,
        kind,
        targetType: 'character',
        title: c.name,
        summary: c.summary,
        object: c as unknown as Record<string, unknown>,
        score,
        confidence: score,
        reason:
          rels.length > 0
            ? `Central character connected to ${rels.map((r) => r.name).join(', ')}`
            : 'A central character in your story',
        influencedBy: rels,
        evidence: [
          {
            source: RetrievalSource.KnowledgeGraph,
            ref: c.id,
            label: c.name,
            quote: c.summary || c.name,
            score,
          },
        ],
        navigation: { kind: 'graph_node', ref: c.id, view: 'character' },
      };
    });
  }

  private async graphChapters(
    userId: string,
    storyId: string,
    kind: RecommendationKind,
    limit: number,
  ): Promise<RecommendationItemDto[]> {
    const graph = await this.story.getGraphSnapshot(userId, storyId);
    const events = graph.nodes
      .filter((n) => n.type === 'event')
      .sort((a, b) => orderOf(a.data) - orderOf(b.data))
      .slice(0, limit);
    return events.map((e, i) => {
      const score = clamp01(1 - i / Math.max(1, events.length));
      return {
        id: e.id,
        kind,
        targetType: 'chapter',
        title: e.name,
        summary: e.summary,
        object: e as unknown as Record<string, unknown>,
        score,
        confidence: score,
        reason: 'A key moment in the story timeline',
        influencedBy: [],
        evidence: [
          {
            source: RetrievalSource.KnowledgeGraph,
            ref: e.id,
            label: e.name,
            quote: e.summary || e.name,
            score,
          },
        ],
        navigation: { kind: 'graph_node', ref: e.id, view: 'event' },
      };
    });
  }

  private async graphTopics(
    userId: string,
    storyId: string,
    kind: RecommendationKind,
    limit: number,
  ): Promise<RecommendationItemDto[]> {
    const graph = await this.story.getGraphSnapshot(userId, storyId);
    const concepts = graph.nodes
      .filter((n) => n.type === 'concept')
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, limit);
    return concepts.map((c) => {
      const score = clamp01(saturating(c.mentionCount, 4));
      return {
        id: c.id,
        kind,
        targetType: 'topic',
        title: c.name,
        summary: c.summary,
        object: c as unknown as Record<string, unknown>,
        score,
        confidence: score,
        reason: 'A recurring theme in your story',
        influencedBy: [],
        evidence: [
          {
            source: RetrievalSource.KnowledgeGraph,
            ref: c.id,
            label: c.name,
            quote: c.summary || c.name,
            score,
          },
        ],
        navigation: { kind: 'graph_node', ref: c.id, view: 'concept' },
      };
    });
  }

  private pieceRec(
    raw: unknown,
    kind: RecommendationKind,
    reason: string,
    influencedBy: RelatedEntity[],
    score: number,
  ): RecommendationItemDto {
    const o = raw as Record<string, unknown>;
    const id = str(o, 'id');
    const slug = str(o, 'slug');
    const ref = slug !== '' ? slug : id;
    const title = str(o, 'title');
    const summary = str(o, 'subtitle', 'excerpt', 'summary', 'featuredQuote');
    return {
      id: id !== '' ? id : ref,
      kind,
      targetType: 'piece',
      title,
      summary,
      object: o,
      score,
      confidence: score,
      reason,
      influencedBy,
      evidence: [
        {
          source: RetrievalSource.Metadata,
          ref,
          label: title,
          quote: summary !== '' ? summary : title,
          score,
        },
      ],
      navigation: { kind: 'piece', ref },
    };
  }

  private writerRec(raw: unknown, kind: RecommendationKind, score: number): RecommendationItemDto {
    const o = raw as Record<string, unknown>;
    const username = str(o, 'username');
    const name = str(o, 'penName') !== '' ? str(o, 'penName') : username;
    return {
      id: str(o, 'userId') !== '' ? str(o, 'userId') : username,
      kind,
      targetType: 'author',
      title: name,
      summary: str(o, 'bio'),
      object: o,
      score,
      confidence: score,
      reason: 'A writer gaining momentum you may enjoy',
      influencedBy: [],
      evidence: [
        {
          source: RetrievalSource.Metadata,
          ref: username,
          label: name,
          quote: str(o, 'bio') || name,
          score,
        },
      ],
      navigation: { kind: 'author', ref: username },
    };
  }

  private taxRec(
    raw: unknown,
    kind: RecommendationKind,
    targetType: string,
    reason: string,
    score: number,
  ): RecommendationItemDto {
    const o = raw as Record<string, unknown>;
    const slug = str(o, 'slug');
    const name = str(o, 'name');
    return {
      id: slug,
      kind,
      targetType,
      title: name,
      summary: '',
      object: o,
      score,
      confidence: score,
      reason,
      influencedBy: [],
      evidence: [{ source: RetrievalSource.Metadata, ref: slug, label: name, quote: name, score }],
      navigation: { kind: targetType, ref: slug },
    };
  }
}

function isStory(storyId: string | undefined): storyId is string {
  return storyId !== undefined && storyId !== '';
}

function positional(index: number, total: number): number {
  return clamp01((total - index) / Math.max(1, total));
}

function orderOf(data: Record<string, unknown>): number {
  return typeof data.order === 'number' && Number.isFinite(data.order) ? data.order : 0;
}

/**
 * Fallback terms for an untagged seed piece: the title's own significant words. Short words are
 * dropped because a one- or two-letter token matches nothing useful in FTS, and an empty list is a
 * legitimate answer — a piece with no tags and no title has nothing to be "like".
 */
function titleTerms(title: string): string[] {
  return title
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word.length > 2)
    .slice(0, 6);
}

function topNames(graph: StoryGraphDto, n: number): string[] {
  return [...graph.nodes]
    .filter(
      (node) => node.type === 'character' || node.type === 'concept' || node.type === 'location',
    )
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, n)
    .map((node) => node.name);
}

function str(o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v !== '') return v;
  }
  return '';
}

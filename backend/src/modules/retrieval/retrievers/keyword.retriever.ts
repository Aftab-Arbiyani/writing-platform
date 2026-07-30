import { Injectable } from '@nestjs/common';
import { RetrievalSource, SearchSort } from '@qalam/shared';

import { SearchService } from '../../search';
import type { Retriever } from '../ports/retriever.port';
import type {
  RetrievalCandidate,
  RetrievalEvidence,
  RetrievalPlan,
  RetrievalRequest,
} from '../retrieval.types';
import { clamp01, saturating } from '../retrieval.text.util';

const DAY_MS = 86_400_000;

/**
 * Keyword retriever (AF4) — the lexical library-search source. It does NOT re-implement
 * search: it delegates to the exported `SearchService` (the E8 Postgres FTS + trigram
 * engine, and the ADR-designated Meilisearch/engine extraction seam). Visibility
 * (published + public + non-private author) is enforced inside SearchService's repository
 * scopes, so results are safe by construction. Runs for library-wide requests only;
 * story-scoped requests use the knowledge-graph source.
 */
@Injectable()
export class KeywordRetriever implements Retriever {
  readonly source = RetrievalSource.Keyword;

  constructor(private readonly search: SearchService) {}

  isAvailable(): boolean {
    return true;
  }

  async retrieve(plan: RetrievalPlan, request: RetrievalRequest): Promise<RetrievalCandidate[]> {
    if (request.storyId !== undefined && request.storyId !== '') return [];
    if (request.query.trim().length < 2) return [];

    const query: Parameters<SearchService['searchPieces']>[0] = {
      q: request.query,
      sort: SearchSort.Relevance,
      limit: plan.candidatesPerSource,
      language: request.filters?.language,
      genre: request.filters?.genre,
      tag: request.filters?.tags?.[0],
    };
    const page = await this.search.searchPieces(query, { id: request.userId });

    const total = page.items.length;
    return page.items.map((piece, index) => {
      const base = clamp01((total - index) / Math.max(1, total));
      const ref = piece.slug ?? piece.id;
      const quote = piece.featuredQuote ?? piece.subtitle ?? piece.title;
      const evidence: RetrievalEvidence[] = [
        { source: RetrievalSource.Keyword, ref, label: piece.title, quote, score: base },
      ];

      return {
        id: piece.id,
        source: RetrievalSource.Keyword,
        type: 'piece',
        title: piece.title,
        summary: piece.subtitle ?? piece.featuredQuote ?? '',
        object: piece as unknown as Record<string, unknown>,
        text: [piece.title, piece.subtitle, piece.featuredQuote].filter(Boolean).join('. '),
        baseScore: base,
        signals: {
          semantic_similarity: base,
          popularity: saturating(piece.stats.claps, 25),
          engagement: saturating(piece.stats.comments + piece.stats.responses, 10),
          freshness: freshnessOf(piece.publishedAt),
        },
        evidence,
        related: [
          {
            id: piece.author.username,
            type: 'author',
            name: piece.author.penName ?? piece.author.username,
            relation: 'author',
          },
          ...(piece.genre
            ? [{ id: piece.genre.slug, type: 'genre', name: piece.genre.name, relation: 'genre' }]
            : []),
        ],
        navigation: { kind: 'piece', ref },
      };
    });
  }
}

/** Recency decay (0..1): today ≈ 1, ~90-day half-life. */
function freshnessOf(publishedAt: string | null): number {
  if (publishedAt === null) return 0;
  const ts = Date.parse(publishedAt);
  if (Number.isNaN(ts)) return 0;
  const ageDays = (Date.now() - ts) / DAY_MS;
  return clamp01(1 / (1 + ageDays / 90));
}

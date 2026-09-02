import { Injectable } from '@nestjs/common';
import { RetrievalSource } from '@qalam/shared';

import { SearchService } from '../../search';
import type { Retriever } from '../ports/retriever.port';
import type { RetrievalCandidate, RetrievalPlan, RetrievalRequest } from '../retrieval.types';
import { clamp01, saturating } from '../retrieval.text.util';

/**
 * Metadata retriever (AF4) — the structured-facet library source: authors, tags, and
 * genres matching the query. Reuses the exported `SearchService` taxonomy/writer searches
 * (visibility-safe by construction) rather than querying pieces/taxonomy tables directly.
 * Complements the keyword (piece) source so a library search returns both matching works
 * and the entities (writers/topics/genres) around them. Library-scope only.
 */
@Injectable()
export class MetadataRetriever implements Retriever {
  readonly source = RetrievalSource.Metadata;

  constructor(private readonly search: SearchService) {}

  isAvailable(): boolean {
    return true;
  }

  async retrieve(plan: RetrievalPlan, request: RetrievalRequest): Promise<RetrievalCandidate[]> {
    if (request.storyId !== undefined && request.storyId !== '') return [];
    if (request.query.trim().length < 2) return [];

    const perFacet = Math.max(3, Math.ceil(plan.candidatesPerSource / 3));
    // Search is public since D5; `SearchService` accepts an absent viewer.
    const viewer = request.userId === null ? null : { id: request.userId };

    const writersQuery: Parameters<SearchService['searchWriters']>[0] = {
      q: request.query,
      limit: perFacet,
    };
    const taxonomyQuery: Parameters<SearchService['searchTags']>[0] = {
      q: request.query,
      limit: perFacet,
    };

    const [writers, tags, genres] = await Promise.all([
      this.search.searchWriters(writersQuery, viewer),
      this.search.searchTags(taxonomyQuery),
      this.search.searchGenres(taxonomyQuery),
    ]);

    const candidates: RetrievalCandidate[] = [];

    writers.items.forEach((w, i) => {
      const base = clamp01((writers.items.length - i) / Math.max(1, writers.items.length));
      const name = w.penName ?? w.username;
      candidates.push({
        id: w.userId,
        source: RetrievalSource.Metadata,
        type: 'author',
        title: name,
        summary: w.bio ?? `${w.piecesCount} pieces · ${w.followersCount} followers`,
        object: w as unknown as Record<string, unknown>,
        text: [name, w.bio].filter(Boolean).join('. '),
        baseScore: base,
        signals: { semantic_similarity: base, popularity: saturating(w.followersCount, 100) },
        evidence: [
          {
            source: RetrievalSource.Metadata,
            ref: w.username,
            label: name,
            quote: w.bio ?? name,
            score: base,
          },
        ],
        related: [],
        navigation: { kind: 'author', ref: w.username },
      });
    });

    tags.items.forEach((t, i) => {
      const base = clamp01((tags.items.length - i) / Math.max(1, tags.items.length));
      candidates.push({
        id: t.slug,
        source: RetrievalSource.Metadata,
        type: 'tag',
        title: t.name,
        summary: `${t.pieceCount} pieces`,
        object: t as unknown as Record<string, unknown>,
        text: t.name,
        baseScore: base,
        signals: { semantic_similarity: base, popularity: saturating(t.pieceCount, 25) },
        evidence: [
          {
            source: RetrievalSource.Metadata,
            ref: t.slug,
            label: t.name,
            quote: t.name,
            score: base,
          },
        ],
        related: [],
        navigation: { kind: 'tag', ref: t.slug },
      });
    });

    genres.items.forEach((g, i) => {
      const base = clamp01((genres.items.length - i) / Math.max(1, genres.items.length));
      candidates.push({
        id: g.slug,
        source: RetrievalSource.Metadata,
        type: 'genre',
        title: g.name,
        summary: `${g.pieceCount} pieces`,
        object: g as unknown as Record<string, unknown>,
        text: g.name,
        baseScore: base,
        signals: { semantic_similarity: base, popularity: saturating(g.pieceCount, 25) },
        evidence: [
          {
            source: RetrievalSource.Metadata,
            ref: g.slug,
            label: g.name,
            quote: g.name,
            score: base,
          },
        ],
        related: [],
        navigation: { kind: 'genre', ref: g.slug },
      });
    });

    return candidates.slice(0, plan.candidatesPerSource);
  }
}

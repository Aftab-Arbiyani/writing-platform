import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * Aggregated popularity of free-text search terms (E8) — the source for
 * "popular keywords" in `GET /search/trending`. One row per NORMALIZED term
 * (docs 13 §6), its `search_count` bumped on every search (anonymous included,
 * so trending reflects total demand, not just signed-in demand). Maintained by
 * an atomic upsert (`ON CONFLICT (keyword) DO UPDATE search_count + 1`), so
 * concurrent searches never lose a tick and no `COUNT(*)` is needed to rank.
 *
 * `last_searched_at` lets trending weight recency (a windowed top-N). This is
 * append-mostly analytics, never soft-deleted. Indexes (unique keyword,
 * count-desc for the top-N read) are authored in the migration (§10).
 */
@Entity('search_keywords')
@Index('uq_search_keywords_keyword', ['keyword'], { unique: true })
@Index('idx_search_keywords_popularity', ['searchCount'])
export class SearchKeyword extends QalamBaseEntity {
  /** Normalized (trimmed, whitespace-collapsed, lowercased) search term. */
  @Column({ type: 'varchar', length: 256 })
  keyword!: string;

  /** Total number of times this term has been searched. */
  @Column({ type: 'integer', default: 0 })
  searchCount!: number;

  /** When the term was last searched — powers recency-weighted trending. */
  @Column({ type: 'timestamptz' })
  lastSearchedAt!: Date;
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RECENT_SEARCHES_MAX } from '@qalam/shared';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

import { RecentSearch } from './entities/recent-search.entity';
import { SearchKeyword } from './entities/search-keyword.entity';

/**
 * Persistence for the two search-owned tables (E8): a signed-in user's recent
 * searches and global keyword popularity. These are the module's OWN entities,
 * so — unlike the cross-table FTS repository — they use injected TypeORM
 * repositories (the entity-owning repository style, docs 16 §3.3).
 */
@Injectable()
export class SearchHistoryRepository {
  constructor(
    @InjectRepository(RecentSearch)
    private readonly recent: Repository<RecentSearch>,
    @InjectRepository(SearchKeyword)
    private readonly keywords: Repository<SearchKeyword>,
  ) {}

  // ── Recent searches ─────────────────────────────────────────────────────

  /** Newest-first, capped at the max kept per user. */
  listRecent(userId: string): Promise<RecentSearch[]> {
    return this.recent.find({
      where: { userId },
      order: { updatedAt: 'DESC', id: 'DESC' },
      take: RECENT_SEARCHES_MAX,
    });
  }

  /**
   * Records (or bumps) a term for a user, then trims to the newest
   * `RECENT_SEARCHES_MAX`. Re-searching an existing term moves it to the top
   * (save() bumps `updated_at`); the `(user_id, query)` unique index guarantees
   * one row per term.
   */
  async upsertRecent(userId: string, query: string, searchType: string): Promise<void> {
    const existing = await this.recent.findOne({ where: { userId, query } });
    if (existing !== null) {
      existing.searchType = searchType;
      await this.recent.save(existing);
    } else {
      await this.recent.save(this.recent.create({ userId, query, searchType }));
    }
    await this.recent.query(
      `DELETE FROM recent_searches
       WHERE user_id = $1 AND id NOT IN (
         SELECT id FROM recent_searches WHERE user_id = $1
         ORDER BY updated_at DESC, id DESC LIMIT $2
       )`,
      [userId, RECENT_SEARCHES_MAX],
    );
  }

  /** Deletes one of the caller's recent searches; returns whether a row was removed. */
  async deleteRecent(userId: string, id: string): Promise<boolean> {
    const result = await this.recent.delete({ id, userId });
    return (result.affected ?? 0) > 0;
  }

  /** Clears all of the caller's recent searches. */
  async clearRecent(userId: string): Promise<void> {
    await this.recent.delete({ userId });
  }

  // ── Keyword popularity ──────────────────────────────────────────────────

  /** Atomically records one search of `keyword` (insert or +1), no read-modify-write. */
  async recordKeyword(keyword: string): Promise<void> {
    await this.keywords.query(
      `INSERT INTO search_keywords (id, keyword, search_count, last_searched_at, created_at, updated_at)
       VALUES ($1, $2, 1, now(), now(), now())
       ON CONFLICT (keyword) DO UPDATE
       SET search_count = search_keywords.search_count + 1,
           last_searched_at = now(),
           updated_at = now()`,
      [uuidv7(), keyword],
    );
  }

  /** Most-searched terms (recency breaks ties) — the trending "popular keywords". */
  topKeywords(limit: number): Promise<SearchKeyword[]> {
    return this.keywords.find({
      order: { searchCount: 'DESC', lastSearchedAt: 'DESC' },
      take: limit,
    });
  }
}

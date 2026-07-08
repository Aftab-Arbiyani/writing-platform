import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import type { CursorPage } from '../../common/types/paginated-result';
import { trendingConfig } from './config/trending.config';
import type { FeedItemDto } from './dto/feed-item.dto';
import { FEED_CACHE_KEYS, FeedCacheService } from './feed-cache.service';
import { paginateSnapshot } from './feed-cursor.util';
import { FeedRepository } from './feed.repository';
import { toFeedItem } from './feed.mappers';

/** One entry in the cached trending ranking. */
interface RankedPiece {
  pieceId: string;
  score: number;
}

/**
 * Trending feed (docs 18 E6 task 3/4). Ranks recent public pieces by the
 * configurable score (claps/comments/responses/completion + time decay), caches
 * the top-N ranking in Redis for one TTL window (the recompute cadence — no
 * background worker), then keyset-paginates that immutable snapshot and hydrates
 * each page's ids into cards in a single query. Global (unfiltered) so it stays
 * cacheable and cheap.
 */
@Injectable()
export class TrendingService {
  constructor(
    private readonly feed: FeedRepository,
    private readonly cache: FeedCacheService,
    @Inject(trendingConfig.KEY) private readonly config: ConfigType<typeof trendingConfig>,
  ) {}

  async getFeed(rawCursor: string | undefined, limit: number): Promise<CursorPage<FeedItemDto>> {
    const ranking = await this.cache.remember<RankedPiece[]>(
      FEED_CACHE_KEYS.trending,
      this.config.cacheTtlSeconds,
      () => this.feed.computeTrendingRanking(this.config.weights, this.config.snapshotSize),
    );

    const page = paginateSnapshot(
      ranking.map((r) => r.pieceId),
      rawCursor,
      limit,
    );
    const cards = await this.feed.listByIds(page.items);
    const byId = new Map(cards.map((card) => [card.id, card]));
    // Preserve the ranked order; silently drop any piece unpublished since the snapshot.
    const items = page.items.flatMap((id) => {
      const card = byId.get(id);
      return card ? [toFeedItem(card)] : [];
    });
    return { items, meta: page.meta };
  }

  /** Force a recompute on next read (exposed for event-driven invalidation). */
  invalidate(): Promise<void> {
    return this.cache.invalidateTrending();
  }
}

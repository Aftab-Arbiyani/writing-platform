import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../../common/events/domain-event-bus';
import {
  DomainEventType,
  type PieceArchivedEvent,
  type PiecePublishedEvent,
} from '../../common/events/domain-events';
import { JOB } from '../../common/queue/queue.constants';
import { FEED_CACHE_KEYS } from '../../modules/feed/feed-cache.service';
import { QueueProducer } from '../queue/queue-producer.service';

/** Discovery + trending cache keys invalidated when the published landscape changes. */
const DISCOVERY_TRENDING_KEYS = [
  FEED_CACHE_KEYS.trending,
  FEED_CACHE_KEYS.featuredWriters,
  FEED_CACHE_KEYS.trendingTags,
  FEED_CACHE_KEYS.trendingGenres,
  FEED_CACHE_KEYS.trendingLanguages,
];

/**
 * Bridges the in-process {@link DomainEventBus} to BullMQ (the migration seam the
 * bus docstring anticipates). It reacts to domain events with *infrastructure*
 * side-effects only — cache invalidation — and deliberately does NOT re-create
 * notifications or analytics rows: those already have synchronous listeners, and
 * duplicating them here would double-write. Keeping this to cache concerns is
 * what makes the async migration additive rather than a rewrite.
 *
 * Publish/archive change which pieces are featured/trending, so both invalidate
 * the discovery + trending caches. The invalidation is enqueued (retryable,
 * monitored) with a stable `jobId` + short delay, so a burst of publishes
 * coalesces into a single invalidation instead of a stampede.
 */
@Injectable()
export class EventBridgeService implements OnModuleInit {
  private readonly logger = new Logger(EventBridgeService.name);

  constructor(
    private readonly bus: DomainEventBus,
    private readonly producer: QueueProducer,
  ) {}

  onModuleInit(): void {
    this.bus.on(DomainEventType.PiecePublished, (e) => this.onLandscapeChanged(e));
    this.bus.on(DomainEventType.PieceArchived, (e) => this.onLandscapeChanged(e));
    this.logger.log('event bridge active: piece.published/archived → cache invalidation');
  }

  private async onLandscapeChanged(
    _event: PiecePublishedEvent | PieceArchivedEvent,
  ): Promise<void> {
    await this.producer.enqueue(
      JOB.CacheInvalidate,
      { keys: DISCOVERY_TRENDING_KEYS },
      // Stable id + short delay coalesces a publish burst into one invalidation.
      { jobId: 'cache-invalidate:discovery', delayMs: 2_000 },
    );
  }
}

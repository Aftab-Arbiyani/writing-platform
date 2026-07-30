import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { trendingConfig } from './config/trending.config';
import { DiscoverController } from './discover.controller';
import { DiscoveryRepository } from './discovery.repository';
import { DiscoveryService } from './discovery.service';
import { FeedCacheService } from './feed-cache.service';
import { FeedController } from './feed.controller';
import { FeedRepository } from './feed.repository';
import { FeedService } from './feed.service';
import { TrendingService } from './trending.service';

/**
 * Feeds & Discovery (E6). Read-only over existing entities — no `forFeature`
 * registrations (the repositories query tables directly via the DataSource, so
 * the module imports no other module's entities, docs 16 §3.1). Reuses
 * `TaxonomyService` (filter code/slug resolution) and the global `RedisService`
 * (DB 0 cache). `ConfigModule.forFeature(trendingConfig)` exposes the
 * env-configurable trending weights. Guards/decorators are file-imported from
 * auth (no AuthModule import → no circular dependency).
 */
@Module({
  imports: [ConfigModule.forFeature(trendingConfig), TaxonomyModule],
  controllers: [FeedController, DiscoverController],
  providers: [
    FeedRepository,
    DiscoveryRepository,
    FeedCacheService,
    FeedService,
    TrendingService,
    DiscoveryService,
  ],
  // TrendingService + DiscoveryService are exported for the Epic-11 infrastructure
  // layer (trending recompute worker + cache warmer); no other module imports them.
  exports: [FeedCacheService, TrendingService, DiscoveryService],
})
export class FeedModule {}

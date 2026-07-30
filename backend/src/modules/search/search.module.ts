import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { RecentSearch } from './entities/recent-search.entity';
import { SearchKeyword } from './entities/search-keyword.entity';
import { SearchController } from './search.controller';
import { SearchRepository } from './search.repository';
import { SearchService } from './search.service';
import { SearchCacheService } from './search-cache.service';
import { SearchHistoryRepository } from './search-history.repository';

/**
 * Search & Discovery (E8) — Postgres FTS behind the `SearchService` seam (the
 * ADR Meilisearch extraction point, docs 02 §6.4). Owns two tables
 * (`recent_searches`, `search_keywords`) via `forFeature`; everything else it
 * searches is read by table name through the DataSource (no cross-module entity
 * imports, docs 16 §3.1). Reuses `TaxonomyService` for filter resolution and the
 * global `RedisService` (DB 0) for autocomplete/trending caches. Guards +
 * decorators are file-imported from auth (no AuthModule import → no cycle).
 */
@Module({
  imports: [TypeOrmModule.forFeature([RecentSearch, SearchKeyword]), TaxonomyModule],
  controllers: [SearchController],
  providers: [SearchRepository, SearchHistoryRepository, SearchCacheService, SearchService],
  exports: [SearchService],
})
export class SearchModule {}

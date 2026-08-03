import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiModule } from '../ai/ai.module';
import { FeedModule } from '../feed/feed.module';
import { PiecesModule } from '../pieces/pieces.module';
import { SearchModule } from '../search/search.module';
import { SettingsModule } from '../settings/settings.module';
import { StoryIntelligenceModule } from '../story-intelligence/story-intelligence.module';
import { AdminRetrievalController } from './admin/admin-retrieval.controller';
import { AskBookController } from './consumers/ask-book.controller';
import { AskBookService } from './consumers/ask-book.service';
import { RecommendationController } from './consumers/recommendation.controller';
import { RecommendationService } from './consumers/recommendation.service';
import { SavedSearchRepository } from './consumers/saved-search.repository';
import { SavedSearchService } from './consumers/saved-search.service';
import { SemanticSearchController } from './consumers/semantic-search.controller';
import { SemanticSearchService } from './consumers/semantic-search.service';
import { StoryExplorerController } from './consumers/story-explorer.controller';
import { StoryExplorerService } from './consumers/story-explorer.service';
import { ContextAssemblerService } from './context/context-assembler.service';
import {
  StoryCharactersContextBuilder,
  StoryGraphContextBuilder,
  StoryTimelineContextBuilder,
} from './context/story-context.builders';
import { RetrievalQueryLog } from './entities/retrieval-query-log.entity';
import { SavedSearch } from './entities/saved-search.entity';
import { EvidenceService } from './evidence/evidence.service';
import { SearchEvaluationService } from './evaluation/search-evaluation.service';
import { RetrievalLogRepository } from './observability/retrieval-log.repository';
import { RetrievalTelemetryService } from './observability/retrieval-telemetry.service';
import { IntentDetectionService } from './planner/intent-detector.service';
import { QueryClassifierService } from './planner/query-classifier.service';
import { RetrievalPlannerService } from './planner/retrieval-planner.service';
import { CompositeRankingStrategy } from './ranking/composite-ranking.strategy';
import { RANKING_STRATEGY } from './ports/ranking.port';
import { RETRIEVERS } from './ports/retriever.port';
import { GraphRetriever } from './retrievers/graph.retriever';
import { KeywordRetriever } from './retrievers/keyword.retriever';
import { MetadataRetriever } from './retrievers/metadata.retriever';
import { VectorRetriever } from './retrievers/vector.retriever';
import { RetrievalCacheService } from './retrieval-cache.service';
import { RetrievalConfigService } from './retrieval-config.service';
import { RetrievalService } from './retrieval.service';

/**
 * AI Discovery / Search / Recommendation (AF4) — the reusable Retrieval Platform + its
 * consumers (Semantic Search, Ask My Book, Story Explorer, Recommendation Engine, saved
 * searches) + the admin config/analytics surface.
 *
 * Reuse-only, never a parallel stack: imports {@link AiModule} (the AF1 orchestrator +
 * flags for the LLM step and the ContextProvider port), {@link StoryIntelligenceModule}
 * (the AF3 knowledge graph — the SSOT — read via its exported service), {@link SearchModule}
 * (the E8 FTS engine seam), {@link FeedModule} (trending/discovery signals), and
 * {@link SettingsModule} (admin-tunable config through the audited settings path). Owns two
 * additive tables (saved searches + append-only telemetry). Placed after all of these in
 * app.module.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([RetrievalQueryLog, SavedSearch]),
    AiModule,
    StoryIntelligenceModule,
    SearchModule,
    FeedModule,
    // Read-only: the Recommendation Engine reads a seed piece through the pieces module's exported
    // service (visibility rules included) for piece-scoped kinds. No cycle — pieces imports nothing
    // from retrieval.
    PiecesModule,
    SettingsModule,
  ],
  controllers: [
    SemanticSearchController,
    AskBookController,
    StoryExplorerController,
    RecommendationController,
    AdminRetrievalController,
  ],
  providers: [
    // Pipeline core
    RetrievalService,
    RetrievalPlannerService,
    IntentDetectionService,
    QueryClassifierService,
    ContextAssemblerService,
    EvidenceService,
    RetrievalConfigService,
    RetrievalCacheService,
    // Observability + evaluation
    RetrievalTelemetryService,
    RetrievalLogRepository,
    SearchEvaluationService,
    // Retrievers (pluggable sources) + ranking strategy
    GraphRetriever,
    KeywordRetriever,
    MetadataRetriever,
    VectorRetriever,
    CompositeRankingStrategy,
    { provide: RANKING_STRATEGY, useExisting: CompositeRankingStrategy },
    {
      provide: RETRIEVERS,
      useFactory: (
        graph: GraphRetriever,
        keyword: KeywordRetriever,
        metadata: MetadataRetriever,
        vector: VectorRetriever,
      ) => [graph, keyword, metadata, vector],
      inject: [GraphRetriever, KeywordRetriever, MetadataRetriever, VectorRetriever],
    },
    // Reusable context builders — they implement AF1's ContextProvider port so any AI
    // feature can inject the story graph as prompt context. Exported for that reuse; AF1
    // wires them into its ContextRegistryService via a one-line seam (docs/36) deferred to
    // avoid a module cycle (the graph module already depends on the AI module).
    StoryGraphContextBuilder,
    StoryCharactersContextBuilder,
    StoryTimelineContextBuilder,
    // Consumers
    SemanticSearchService,
    AskBookService,
    StoryExplorerService,
    RecommendationService,
    SavedSearchService,
    SavedSearchRepository,
  ],
  exports: [
    RetrievalService,
    SearchEvaluationService,
    StoryGraphContextBuilder,
    StoryCharactersContextBuilder,
    StoryTimelineContextBuilder,
  ],
})
export class RetrievalModule {}

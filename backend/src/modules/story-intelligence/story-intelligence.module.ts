import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiModule } from '../ai/ai.module';
import { StoryAnalysis } from './entities/story-analysis.entity';
import { StoryEdge } from './entities/story-edge.entity';
import { StoryGraph } from './entities/story-graph.entity';
import { StoryNode } from './entities/story-node.entity';
import { StoryIntelligenceController } from './story-intelligence.controller';
import { StoryIntelligenceRepository } from './story-intelligence.repository';
import { StoryIntelligenceService } from './story-intelligence.service';

/**
 * Story Intelligence (AF3) — the structured story knowledge graph + the analyses that
 * populate it. Imports {@link AiModule} and reuses its exported `AiCompletionService`
 * for every analysis (provider abstraction, prompt rendering, feature-flag gate, usage
 * limits, safety, token accounting all inherited — never re-implemented). Owns four
 * tables (graph aggregate + nodes + edges + analysis runs).
 */
@Module({
  imports: [TypeOrmModule.forFeature([StoryGraph, StoryNode, StoryEdge, StoryAnalysis]), AiModule],
  controllers: [StoryIntelligenceController],
  providers: [StoryIntelligenceService, StoryIntelligenceRepository],
  exports: [StoryIntelligenceService],
})
export class StoryIntelligenceModule {}

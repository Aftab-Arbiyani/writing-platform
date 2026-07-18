import { ApiProperty } from '@nestjs/swagger';
import type {
  AskScope,
  RankingSignal,
  RecommendationKind,
  RetrievalFailureReason,
  RetrievalIntent,
  RetrievalQueryType,
  RetrievalSource,
} from '@qalam/shared';

import type { StoryEdgeDto, StoryNodeDto } from '../../story-intelligence/dto/story-response.dto';
import type {
  AskCitation,
  NavigationTarget,
  RankingExplanation,
  RelatedEntity,
  RetrievalEvidence,
} from '../retrieval.types';

/** Aggregate metadata on every retrieval response. */
export class RetrievalResponseMetaDto {
  @ApiProperty({ isArray: true }) sources!: RetrievalSource[];
  @ApiProperty() totalCandidates!: number;
  @ApiProperty() returned!: number;
  @ApiProperty() confidence!: number;
  @ApiProperty() degraded!: boolean;
  @ApiProperty({ required: false }) failureReason?: RetrievalFailureReason;
}

/** One ranked, grounded, explainable search result. */
export class SearchResultItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() sourceType!: RetrievalSource;
  @ApiProperty() title!: string;
  @ApiProperty() summary!: string;
  @ApiProperty({ type: Object }) object!: Record<string, unknown>;
  @ApiProperty() confidence!: number;
  @ApiProperty() relevanceScore!: number;
  @ApiProperty({ type: [Object] }) evidence!: RetrievalEvidence[];
  @ApiProperty({ type: [Object] }) relatedEntities!: RelatedEntity[];
  @ApiProperty({ type: Object }) navigation!: NavigationTarget;
  @ApiProperty() reason!: string;
  @ApiProperty({ type: Object }) ranking!: RankingExplanation;
}

export class SemanticSearchResponseDto {
  @ApiProperty() query!: string;
  @ApiProperty() intent!: RetrievalIntent;
  @ApiProperty() queryType!: RetrievalQueryType;
  @ApiProperty({ nullable: true }) answer!: string | null;
  @ApiProperty({ type: [SearchResultItemDto] }) results!: SearchResultItemDto[];
  @ApiProperty({ type: [Object] }) evidence!: RetrievalEvidence[];
  @ApiProperty({ type: RetrievalResponseMetaDto }) meta!: RetrievalResponseMetaDto;
}

export class SearchSuggestionsResponseDto {
  @ApiProperty({ type: [String] }) suggestions!: string[];
}

export class AskBookResponseDto {
  @ApiProperty() storyId!: string;
  @ApiProperty() scope!: AskScope;
  @ApiProperty() answer!: string;
  @ApiProperty({ type: [Object] }) citations!: AskCitation[];
  @ApiProperty() confidence!: number;
  @ApiProperty({ type: Object }) usage!: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  @ApiProperty() estimatedCostUsd!: number;
  @ApiProperty({ nullable: true }) conversationId!: string | null;
}

export class ExplorerViewResponseDto {
  @ApiProperty() storyId!: string;
  @ApiProperty() view!: string;
  @ApiProperty({ type: [Object] }) nodes!: StoryNodeDto[];
  @ApiProperty({ type: [Object] }) edges!: StoryEdgeDto[];
  @ApiProperty({ type: Object }) stats!: { nodeCount: number; edgeCount: number };
}

export class RecommendationItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() kind!: RecommendationKind;
  @ApiProperty() targetType!: string;
  @ApiProperty() title!: string;
  @ApiProperty() summary!: string;
  @ApiProperty({ type: Object }) object!: Record<string, unknown>;
  @ApiProperty() score!: number;
  @ApiProperty() confidence!: number;
  @ApiProperty() reason!: string;
  @ApiProperty({ type: [Object] }) influencedBy!: RelatedEntity[];
  @ApiProperty({ type: [Object] }) evidence!: RetrievalEvidence[];
  @ApiProperty({ type: Object }) navigation!: NavigationTarget;
}

export class RecommendationResponseDto {
  @ApiProperty() kind!: RecommendationKind;
  @ApiProperty({ type: [RecommendationItemDto] }) items!: RecommendationItemDto[];
  @ApiProperty({ type: RetrievalResponseMetaDto }) meta!: RetrievalResponseMetaDto;
}

export class SavedSearchDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() query!: string;
  @ApiProperty({ nullable: true }) queryType!: RetrievalQueryType | null;
  @ApiProperty({ nullable: true }) storyId!: string | null;
  @ApiProperty() createdAt!: string;
}

export class RetrievalConfigDto {
  @ApiProperty() topK!: number;
  @ApiProperty() candidatesPerSource!: number;
  @ApiProperty() contextTokens!: number;
  @ApiProperty() timeoutMs!: number;
  @ApiProperty({ type: Object }) sources!: Record<RetrievalSource, boolean>;
  @ApiProperty({ type: Object }) rankingWeights!: Record<RankingSignal, number>;
  @ApiProperty() synthesisEnabled!: boolean;
}

export class SearchAnalyticsDto {
  @ApiProperty() window!: string;
  @ApiProperty() totalQueries!: number;
  @ApiProperty({ type: [Object] }) byIntent!: Array<{ intent: RetrievalIntent; count: number }>;
  @ApiProperty({ type: [Object] }) byQueryType!: Array<{
    queryType: RetrievalQueryType;
    count: number;
  }>;
  @ApiProperty() zeroResultRate!: number;
  @ApiProperty() avgLatencyMs!: number;
  @ApiProperty() p95LatencyMs!: number;
  @ApiProperty() avgConfidence!: number;
  @ApiProperty() cacheHitRatio!: number;
  @ApiProperty() avgContextTokens!: number;
  @ApiProperty({ type: [Object] }) failureBreakdown!: Array<{
    reason: RetrievalFailureReason;
    count: number;
  }>;
}

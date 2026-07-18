import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AskScope,
  RankingSignal,
  RecommendationKind,
  RetrievalQueryType,
  RetrievalSource,
  RETRIEVAL_MAX_TOP_K,
  RETRIEVAL_QUERY_MAX_CHARS,
  RETRIEVAL_QUERY_MIN_CHARS,
} from '@qalam/shared';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** `POST /ai/search` — semantic/hybrid search over a story graph or the library. */
export class SemanticSearchDto {
  @ApiProperty({ description: 'Natural-language query.', example: 'who betrayed the queen?' })
  @IsString()
  @MinLength(RETRIEVAL_QUERY_MIN_CHARS)
  @MaxLength(RETRIEVAL_QUERY_MAX_CHARS)
  query!: string;

  @ApiPropertyOptional({ description: 'Scope to one story graph (owner-scoped). Omit = library.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  storyId?: string;

  @ApiPropertyOptional({ enum: Object.values(RetrievalQueryType) })
  @IsOptional()
  @IsIn(Object.values(RetrievalQueryType))
  queryType?: RetrievalQueryType;

  @ApiPropertyOptional({ minimum: 1, maximum: RETRIEVAL_MAX_TOP_K })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(RETRIEVAL_MAX_TOP_K)
  limit?: number;

  @ApiPropertyOptional({ description: 'Ask for a grounded natural-language synthesis (LLM).' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  synthesize?: boolean;

  @ApiPropertyOptional({ description: 'Language code filter (library scope).' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;

  @ApiPropertyOptional({ description: 'Genre slug filter (library scope).' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  genre?: string;

  @ApiPropertyOptional({ description: 'Comma-separated tag slugs (library scope).' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tags?: string;
}

/** `POST /ai/ask` and `POST /ai/ask/stream` — grounded Q&A over a story. */
export class AskBookDto {
  @ApiProperty({ description: "The story's opaque key (piece id or local draft id)." })
  @IsString()
  @MaxLength(120)
  storyId!: string;

  @ApiProperty({ example: 'What is the relationship between Aria and the mentor?' })
  @IsString()
  @MinLength(1)
  @MaxLength(RETRIEVAL_QUERY_MAX_CHARS)
  question!: string;

  @ApiPropertyOptional({ enum: Object.values(AskScope), default: AskScope.Book })
  @IsOptional()
  @IsIn(Object.values(AskScope))
  scope?: AskScope;

  @ApiPropertyOptional({ description: 'A named subject to focus scope on (character/place/…).' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ description: 'Reuse an AF1 conversation for a multi-turn ask.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  conversationId?: string;
}

/** `GET /ai/recommendations` — explainable recommendations across surfaces. */
export class RecommendationQueryDto {
  @ApiProperty({ enum: Object.values(RecommendationKind) })
  @IsIn(Object.values(RecommendationKind))
  kind!: RecommendationKind;

  @ApiPropertyOptional({ description: 'Seed story for story-scoped kinds.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  storyId?: string;

  @ApiPropertyOptional({ description: 'Seed piece for related-stories / related-chapters.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  pieceId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: RETRIEVAL_MAX_TOP_K })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(RETRIEVAL_MAX_TOP_K)
  limit?: number;
}

/** `GET /ai/search/suggestions` — lightweight query suggestions. */
export class SearchSuggestionsQueryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  q!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  storyId?: string;
}

/** `POST /ai/search/saved` — save a search. */
export class SaveSearchDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(RETRIEVAL_QUERY_MAX_CHARS)
  query!: string;

  @ApiPropertyOptional({ enum: Object.values(RetrievalQueryType) })
  @IsOptional()
  @IsIn(Object.values(RetrievalQueryType))
  queryType?: RetrievalQueryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  storyId?: string;
}

/** `PUT /admin/ai/search-config` — partial admin update of retrieval config. */
export class UpdateRetrievalConfigDto {
  @ApiPropertyOptional({ minimum: 1, maximum: RETRIEVAL_MAX_TOP_K })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(RETRIEVAL_MAX_TOP_K)
  topK?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  candidatesPerSource?: number;

  @ApiPropertyOptional({ minimum: 200, maximum: 16000 })
  @IsOptional()
  @IsInt()
  @Min(200)
  @Max(16_000)
  contextTokens?: number;

  @ApiPropertyOptional({ minimum: 500, maximum: 60000 })
  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(60_000)
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Enable/disable retrieval sources.' })
  @IsOptional()
  @IsObject()
  sources?: Partial<Record<RetrievalSource, boolean>>;

  @ApiPropertyOptional({ description: 'Ranking weights per signal (0..1).' })
  @IsOptional()
  @IsObject()
  rankingWeights?: Partial<Record<RankingSignal, number>>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  synthesisEnabled?: boolean;
}

/** `GET /admin/ai/search-analytics` — window selection. */
export class SearchAnalyticsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 90, default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  windowDays?: number;
}

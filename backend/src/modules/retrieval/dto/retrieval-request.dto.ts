import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AskScope,
  RankingSignal,
  RecommendationKind,
  RetrievalQueryType,
  RetrievalSource,
  RETRIEVAL_CONFIG_BOUNDS,
  RETRIEVAL_MAX_TOP_K,
  RETRIEVAL_QUERY_MAX_CHARS,
  RETRIEVAL_QUERY_MIN_CHARS,
  SEARCH_ANALYTICS_DEFAULT_WINDOW_DAYS,
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
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
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

  /**
   * @deprecated Accepted and IGNORED since D5 removed grounded synthesis. Kept so a client
   * built against the old shape still validates; the response's `answer` is always null.
   */
  @ApiPropertyOptional({ deprecated: true, description: 'Ignored — synthesis was removed (D5).' })
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

  /**
   * Seed piece for `related_stories` — the reader's "more like this" (W5). Read as the caller, so
   * the piece's own visibility rules apply. `storyId` wins when both are given (the knowledge graph
   * is the better seed). `related_chapters` remains graph-scoped and takes `storyId` only: a piece
   * has no chapters to relate until an AF3 graph exists for it.
   */
  @ApiPropertyOptional({ description: 'Seed piece for related-stories (reader "more like this").' })
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

/**
 * The two config tables are MERGED per key into the `ai.retrieval.config` settings row and
 * never pruned, and the settings layer validates a `json` value only as "an object". So
 * without a member check an admin patch can persist an unknown key forever, or a weight that
 * is not a number — which the planner then drops from ranking silently (`weight > 0` is false
 * for a non-numeric value), i.e. a signal turns itself off with no error anywhere. Both key
 * sets are CLOSED enums, so the keys are allowlisted rather than merely bounded.
 * Precedent for the shape: `IsRateTable` in the monetization DTO (B8, A1-2).
 */
function tableEntries(value: unknown): Array<[string, unknown]> {
  return value !== null && typeof value === 'object' ? Object.entries(value) : [];
}

/** `sources`: retrieval strategy → enabled. Keys must be `RetrievalSource` members. */
@ValidatorConstraint({ name: 'isSourceToggleTable' })
export class IsSourceToggleTable implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    const allowed = new Set<string>(Object.values(RetrievalSource));
    return tableEntries(value).every(
      ([key, enabled]) => allowed.has(key) && typeof enabled === 'boolean',
    );
  }

  defaultMessage(): string {
    return `sources must map known retrieval sources (${Object.values(RetrievalSource).join(', ')}) to booleans.`;
  }
}

/** `rankingWeights`: signal → weight in 0..1. Keys must be `RankingSignal` members. */
@ValidatorConstraint({ name: 'isRankingWeightTable' })
export class IsRankingWeightTable implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    const allowed = new Set<string>(Object.values(RankingSignal));
    return tableEntries(value).every(
      ([key, weight]) =>
        allowed.has(key) &&
        typeof weight === 'number' &&
        Number.isFinite(weight) &&
        weight >= 0 &&
        weight <= 1,
    );
  }

  defaultMessage(): string {
    return (
      'rankingWeights must map known ranking signals to finite numbers between 0 and 1 ' +
      '(0 disables the signal).'
    );
  }
}

/**
 * `PUT /admin/ai/search-config` — partial admin update of retrieval config.
 *
 * Every bound comes from `RETRIEVAL_CONFIG_BOUNDS` in `@qalam/shared`, which the admin editor's
 * form schema reads too — so a control cannot offer a value this route rejects (A3).
 */
export class UpdateRetrievalConfigDto {
  @ApiPropertyOptional({
    minimum: RETRIEVAL_CONFIG_BOUNDS.topK.min,
    maximum: RETRIEVAL_CONFIG_BOUNDS.topK.max,
  })
  @IsOptional()
  @IsInt()
  @Min(RETRIEVAL_CONFIG_BOUNDS.topK.min)
  @Max(RETRIEVAL_CONFIG_BOUNDS.topK.max)
  topK?: number;

  @ApiPropertyOptional({
    minimum: RETRIEVAL_CONFIG_BOUNDS.candidatesPerSource.min,
    maximum: RETRIEVAL_CONFIG_BOUNDS.candidatesPerSource.max,
  })
  @IsOptional()
  @IsInt()
  @Min(RETRIEVAL_CONFIG_BOUNDS.candidatesPerSource.min)
  @Max(RETRIEVAL_CONFIG_BOUNDS.candidatesPerSource.max)
  candidatesPerSource?: number;

  @ApiPropertyOptional({
    minimum: RETRIEVAL_CONFIG_BOUNDS.contextTokens.min,
    maximum: RETRIEVAL_CONFIG_BOUNDS.contextTokens.max,
  })
  @IsOptional()
  @IsInt()
  @Min(RETRIEVAL_CONFIG_BOUNDS.contextTokens.min)
  @Max(RETRIEVAL_CONFIG_BOUNDS.contextTokens.max)
  contextTokens?: number;

  @ApiPropertyOptional({
    minimum: RETRIEVAL_CONFIG_BOUNDS.timeoutMs.min,
    maximum: RETRIEVAL_CONFIG_BOUNDS.timeoutMs.max,
  })
  @IsOptional()
  @IsInt()
  @Min(RETRIEVAL_CONFIG_BOUNDS.timeoutMs.min)
  @Max(RETRIEVAL_CONFIG_BOUNDS.timeoutMs.max)
  timeoutMs?: number;

  @ApiPropertyOptional({
    description:
      'Enable/disable retrieval sources. Merged per key over the stored table; keys are never removed by a patch.',
    example: { knowledge_graph: true, vector: false },
  })
  @IsOptional()
  @IsObject()
  @Validate(IsSourceToggleTable)
  sources?: Partial<Record<RetrievalSource, boolean>>;

  @ApiPropertyOptional({
    description:
      'Ranking weights per signal (0..1; 0 disables the signal). Merged per key over the stored table.',
    example: { semantic_similarity: 1, freshness: 0.2 },
  })
  @IsOptional()
  @IsObject()
  @Validate(IsRankingWeightTable)
  rankingWeights?: Partial<Record<RankingSignal, number>>;

  /**
   * @deprecated Accepted and IGNORED since D5 — there is no synthesis to enable. Kept so the
   * admin client's existing form does not 422 before it drops the field.
   */
  @ApiPropertyOptional({ deprecated: true, description: 'Ignored — synthesis was removed (D5).' })
  @IsOptional()
  @IsBoolean()
  synthesisEnabled?: boolean;
}

/** `GET /admin/ai/search-analytics` — window selection. */
export class SearchAnalyticsQueryDto {
  @ApiPropertyOptional({
    minimum: RETRIEVAL_CONFIG_BOUNDS.analyticsWindowDays.min,
    maximum: RETRIEVAL_CONFIG_BOUNDS.analyticsWindowDays.max,
    default: SEARCH_ANALYTICS_DEFAULT_WINDOW_DAYS,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(RETRIEVAL_CONFIG_BOUNDS.analyticsWindowDays.min)
  @Max(RETRIEVAL_CONFIG_BOUNDS.analyticsWindowDays.max)
  windowDays?: number;
}

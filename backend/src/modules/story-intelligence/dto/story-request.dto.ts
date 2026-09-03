import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  STORY_ANALYSIS_MAX_INPUT_CHARS,
  STORY_GRAPH_TITLE_MAX,
  StoryAnalysisKind,
  StoryAnalysisScope,
} from '@qalam/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** `POST /story-intelligence/:storyId/analyze` — run one structured analysis. */
/**
 * `POST /story-intelligence/:storyId/map/stream` — build a story's whole map in one action.
 *
 * Takes the text rather than reading the saved piece, exactly like {@link AnalyzeStoryDto}:
 * the writer in the editor has the draft in hand, and it may not be saved yet.
 */
export class MapStoryDto {
  @ApiProperty({
    maxLength: STORY_ANALYSIS_MAX_INPUT_CHARS,
    description: 'The full story text to map (client-supplied — offline/unsaved safe).',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(STORY_ANALYSIS_MAX_INPUT_CHARS)
  content!: string;

  @ApiPropertyOptional({ maxLength: STORY_GRAPH_TITLE_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(STORY_GRAPH_TITLE_MAX)
  storyTitle?: string;
}

export class AnalyzeStoryDto {
  @ApiProperty({ enum: Object.values(StoryAnalysisKind) })
  @IsIn(Object.values(StoryAnalysisKind))
  kind!: StoryAnalysisKind;

  @ApiProperty({ enum: Object.values(StoryAnalysisScope) })
  @IsIn(Object.values(StoryAnalysisScope))
  scope!: StoryAnalysisScope;

  @ApiProperty({
    maxLength: STORY_ANALYSIS_MAX_INPUT_CHARS,
    description: 'The chapter/scene/book text to analyse (client-supplied — offline/unsaved safe).',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(STORY_ANALYSIS_MAX_INPUT_CHARS)
  content!: string;

  @ApiPropertyOptional({
    description: 'A chapter/scene cue recorded on the analysis (e.g. "Chapter 3").',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  chapterRef?: string;

  @ApiPropertyOptional({ maxLength: STORY_GRAPH_TITLE_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(STORY_GRAPH_TITLE_MAX)
  storyTitle?: string;
}

/** `GET /story-intelligence/:storyId/analyses` query. */
export class StoryAnalysesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

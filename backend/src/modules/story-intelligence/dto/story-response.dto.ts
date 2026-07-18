import { ApiProperty } from '@nestjs/swagger';
import type {
  StoryAnalysisKind,
  StoryAnalysisScope,
  StoryAnalysisStatus,
  StoryEdgeType,
  StoryEventKind,
  StoryNodeType,
} from '@qalam/shared';

/** Grounding reference for a structured claim. */
export class StoryEvidenceDto {
  @ApiProperty({ nullable: true }) chapterRef!: string | null;
  @ApiProperty() quote!: string;
}

/** Token usage for one analysis call. */
export class StoryTokenUsageDto {
  @ApiProperty() inputTokens!: number;
  @ApiProperty() outputTokens!: number;
  @ApiProperty() totalTokens!: number;
}

/** A node in the story knowledge graph. */
export class StoryNodeDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: StoryNodeType;
  @ApiProperty() name!: string;
  @ApiProperty({ type: [String] }) aliases!: string[];
  @ApiProperty() summary!: string;
  @ApiProperty({ type: Object }) data!: Record<string, unknown>;
  @ApiProperty() confidence!: number;
  @ApiProperty() mentionCount!: number;
  @ApiProperty({ nullable: true }) firstChapter!: string | null;
  @ApiProperty({ type: [StoryEvidenceDto] }) evidence!: StoryEvidenceDto[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

/** An edge in the story knowledge graph. */
export class StoryEdgeDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: StoryEdgeType;
  @ApiProperty() sourceId!: string;
  @ApiProperty() targetId!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Object }) data!: Record<string, unknown>;
  @ApiProperty() confidence!: number;
  @ApiProperty({ type: [StoryEvidenceDto] }) evidence!: StoryEvidenceDto[];
}

/** The full story knowledge graph — the single source of truth. */
export class StoryGraphDto {
  @ApiProperty() storyId!: string;
  @ApiProperty({ nullable: true }) title!: string | null;
  @ApiProperty() nodeCount!: number;
  @ApiProperty() edgeCount!: number;
  @ApiProperty() analysisCount!: number;
  @ApiProperty({ nullable: true }) lastAnalyzedAt!: string | null;
  @ApiProperty({ type: [StoryNodeDto] }) nodes!: StoryNodeDto[];
  @ApiProperty({ type: [StoryEdgeDto] }) edges!: StoryEdgeDto[];
}

/** Character-centric view: character nodes + relationship edges among them. */
export class StoryCharacterGraphDto {
  @ApiProperty() storyId!: string;
  @ApiProperty({ type: [StoryNodeDto] }) characters!: StoryNodeDto[];
  @ApiProperty({ type: [StoryEdgeDto] }) relationships!: StoryEdgeDto[];
}

/** One entry of the chronological timeline view. */
export class StoryTimelineEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty() kind!: StoryEventKind;
  @ApiProperty({ nullable: true }) chapterRef!: string | null;
  @ApiProperty() order!: number;
  @ApiProperty({ type: [String] }) characters!: string[];
  @ApiProperty({ nullable: true }) location!: string | null;
}

/** The timeline view (event nodes ordered chronologically). */
export class StoryTimelineDto {
  @ApiProperty() storyId!: string;
  @ApiProperty({ type: [StoryTimelineEntryDto] }) entries!: StoryTimelineEntryDto[];
}

/** The result of one analysis — structured objects first, prose derived from them. */
export class StoryAnalysisResultDto {
  @ApiProperty() id!: string;
  @ApiProperty() storyId!: string;
  @ApiProperty() kind!: StoryAnalysisKind;
  @ApiProperty() scope!: StoryAnalysisScope;
  @ApiProperty() status!: StoryAnalysisStatus;
  @ApiProperty() summary!: string;
  @ApiProperty({ type: [String] }) recommendations!: string[];
  @ApiProperty() confidenceScore!: number;
  @ApiProperty({ type: [StoryEvidenceDto] }) evidence!: StoryEvidenceDto[];
  @ApiProperty({ type: [String] }) affectedChapters!: string[];
  @ApiProperty({ type: [String] }) affectedCharacters!: string[];
  @ApiProperty({ type: Object }) structured!: Record<string, unknown>;
  @ApiProperty({ type: StoryTokenUsageDto }) usage!: StoryTokenUsageDto;
  @ApiProperty() estimatedCostUsd!: number;
  @ApiProperty() provider!: string;
  @ApiProperty() model!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ nullable: true }) rawOutput!: string | null;
}

/** Analysis-history list row (no heavy structured payload). */
export class StoryAnalysisSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() kind!: StoryAnalysisKind;
  @ApiProperty() scope!: StoryAnalysisScope;
  @ApiProperty() status!: StoryAnalysisStatus;
  @ApiProperty() summary!: string;
  @ApiProperty() confidenceScore!: number;
  @ApiProperty() createdAt!: string;
}

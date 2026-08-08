import { ApiProperty } from '@nestjs/swagger';

/** Response DTOs (AF6). Controllers never return entities raw. */

/** An editorial review session. */
export class ReviewDto {
  @ApiProperty() id!: string;
  @ApiProperty() storyId!: string;
  @ApiProperty() requestedById!: string;
  @ApiProperty({ description: 'Review lifecycle state.' }) state!: string;
  @ApiProperty({ nullable: true, type: String }) reviewerId!: string | null;
  @ApiProperty({ nullable: true, type: String }) decision!: string | null;
  @ApiProperty({ nullable: true, type: String }) notes!: string | null;
  @ApiProperty() submittedAt!: string;
  @ApiProperty({ nullable: true, type: String }) decidedAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

/** A read-only content version of a story. */
export class SnapshotDto {
  @ApiProperty() id!: string;
  @ApiProperty() storyId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() title!: string;
  @ApiProperty({ type: Object, description: 'TipTap/ProseMirror content document.' })
  content!: Record<string, unknown>;
  @ApiProperty() wordCount!: number;
  @ApiProperty({ description: 'Why the snapshot was captured.' }) reason!: string;
  @ApiProperty() createdById!: string;
  @ApiProperty() createdAt!: string;
}

/**
 * A story's version history as one plan-aware answer (B7, docs/45 §4.12).
 *
 * `items` is CLAMPED to what the story owner's plan shows; `total` is the true stored count. Both
 * ride together because a clamped list on its own is indistinguishable from a short history — the
 * client could only say "5 versions", which is not true, instead of "5 of 32 versions", which is.
 * Hiding the count would make the upsell dishonest and the feature invisible.
 *
 * Nothing here is ever deleted: the hidden versions are stored and become readable again the moment
 * the plan grows, retroactively.
 */
export class SnapshotHistoryDto {
  @ApiProperty({ type: [SnapshotDto], description: 'The versions the plan shows, newest first.' })
  items!: SnapshotDto[];
  @ApiProperty({ description: 'Every version stored for this story, including the hidden ones.' })
  total!: number;
  @ApiProperty({ description: 'How many versions this response carries (`items.length`).' })
  visible!: number;
  @ApiProperty({ description: 'Stored but not shown on this plan. Never deleted.' })
  hidden!: number;
  @ApiProperty({
    description: "The story OWNER's plan depth. 0 = unlimited (the ordinary sentinel).",
  })
  limit!: number;
  @ApiProperty({ description: 'True when the plan shows the whole history.' })
  unlimited!: boolean;
}

/** One entry of a story's publishing history. */
export class PublicationEventDto {
  @ApiProperty() id!: string;
  @ApiProperty() storyId!: string;
  @ApiProperty() actorId!: string;
  @ApiProperty({ description: 'The event kind.' }) type!: string;
  @ApiProperty({ type: Object }) metadata!: Record<string, unknown>;
  @ApiProperty() createdAt!: string;
}

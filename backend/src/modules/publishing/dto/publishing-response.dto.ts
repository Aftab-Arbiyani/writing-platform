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

/** One entry of a story's publishing history. */
export class PublicationEventDto {
  @ApiProperty() id!: string;
  @ApiProperty() storyId!: string;
  @ApiProperty() actorId!: string;
  @ApiProperty({ description: 'The event kind.' }) type!: string;
  @ApiProperty({ type: Object }) metadata!: Record<string, unknown>;
  @ApiProperty() createdAt!: string;
}

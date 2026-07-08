import { ApiProperty } from '@nestjs/swagger';
import type { Visibility } from '@qalam/shared';

/** A collection's metadata (owner-only in Phase 1). */
export class CollectionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty({ nullable: true }) coverImageKey!: string | null;
  @ApiProperty() visibility!: Visibility;
  @ApiProperty({ description: 'True for the auto-created "Favorites" collection.' })
  isDefault!: boolean;
  @ApiProperty() piecesCount!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

/** A piece inside a collection (joined with the piece for display). */
export class CollectionPieceItemDto {
  @ApiProperty() pieceId!: string;
  @ApiProperty({ nullable: true }) slug!: string | null;
  @ApiProperty() title!: string;
  @ApiProperty() position!: number;
  @ApiProperty({ nullable: true }) note!: string | null;
  @ApiProperty({ description: 'When the piece was added to the collection.' })
  addedAt!: string;
}

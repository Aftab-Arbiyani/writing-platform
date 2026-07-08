import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const NOTE_MAX = 300;

/** `POST /collections/:id/pieces` body — adds a piece with an optional note. */
export class AddCollectionPieceDto {
  @ApiProperty({ format: 'uuid', description: 'The piece to add.' })
  @IsUUID()
  pieceId!: string;

  @ApiPropertyOptional({ maxLength: NOTE_MAX, description: "Curator's note on the entry." })
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  note?: string;
}

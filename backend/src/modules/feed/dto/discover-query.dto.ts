import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiscoverPieceKind, WriterKind } from '@qalam/shared';
import { IsEnum, IsOptional } from 'class-validator';

import { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';

/** `GET /discover/writers` — which slice of writers, cursor-paginated. */
export class WriterDiscoverQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({
    enum: Object.values(WriterKind),
    default: WriterKind.Popular,
    description: 'featured | popular | new.',
  })
  @IsOptional()
  @IsEnum(WriterKind)
  kind: WriterKind = WriterKind.Popular;
}

/** `GET /discover/pieces` — which slice of pieces, cursor-paginated. */
export class PieceDiscoverQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({
    enum: Object.values(DiscoverPieceKind),
    default: DiscoverPieceKind.Recent,
    description: 'featured | recent | most_clapped | most_discussed.',
  })
  @IsOptional()
  @IsEnum(DiscoverPieceKind)
  kind: DiscoverPieceKind = DiscoverPieceKind.Recent;
}

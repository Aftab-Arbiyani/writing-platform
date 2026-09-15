import { ApiPropertyOptional } from '@nestjs/swagger';
import { PieceStatus } from '@umberleaf/shared';
import { IsEnum, IsOptional } from 'class-validator';

import { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';

/** `GET /me/pieces` query — cursor pagination + optional status filter. */
export class PieceListQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({ enum: Object.values(PieceStatus) })
  @IsOptional()
  @IsEnum(PieceStatus)
  status?: PieceStatus;
}

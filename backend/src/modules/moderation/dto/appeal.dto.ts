import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppealStatus } from '@qalam/shared';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { OffsetPaginationDto } from '../../../common/dto/offset-pagination.dto';

/** Body for `POST /reports/:id/appeal` — the moderated user contests the decision. */
export class CreateAppealDto {
  @ApiProperty({
    minLength: 10,
    maxLength: 2000,
    description: 'Why the decision should be reversed.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}

/** Body for `POST /admin/appeals/:id/{approve,reject}` — optional reviewer notes. */
export class ReviewAppealDto {
  @ApiPropertyOptional({
    maxLength: 2000,
    description: 'Reviewer notes (shown on the appeal, audited).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/** Query for `GET /admin/appeals` — offset-paginated appeal queue. */
export class AppealFilterDto extends OffsetPaginationDto {
  @ApiPropertyOptional({ enum: Object.values(AppealStatus), default: AppealStatus.Pending })
  @IsOptional()
  @IsEnum(AppealStatus)
  status?: AppealStatus;

  @ApiPropertyOptional({
    description: 'Sort field; `-` prefix = descending.',
    default: '-createdAt',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}

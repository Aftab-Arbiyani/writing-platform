import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RestrictionScope, RestrictionType, StrikeSeverity } from '@qalam/shared';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Body for `POST /admin/users/:id/strikes` — issue a policy strike. */
export class IssueStrikeDto {
  @ApiProperty({
    enum: Object.values(StrikeSeverity),
    description: 'Severity — drives the strike weight (minor=1, moderate=2, severe=4).',
  })
  @IsIn(Object.values(StrikeSeverity))
  severity!: StrikeSeverity;

  @ApiProperty({
    minLength: 1,
    maxLength: 1000,
    description: 'Why the strike was issued (audited).',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The report that prompted the strike, if any.',
  })
  @IsOptional()
  @IsUUID()
  reportId?: string;

  @ApiPropertyOptional({
    description: 'ISO-8601 expiry; omit for a strike that never expires.',
  })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

/** Body for `POST /admin/users/:id/restrictions` — apply an account restriction. */
export class ApplyRestrictionDto {
  @ApiProperty({ enum: Object.values(RestrictionType), description: 'What is restricted.' })
  @IsIn(Object.values(RestrictionType))
  type!: RestrictionType;

  @ApiProperty({
    enum: Object.values(RestrictionScope),
    description: 'The surface the restriction applies to (`global` covers all).',
  })
  @IsIn(Object.values(RestrictionScope))
  scope!: RestrictionScope;

  @ApiProperty({
    minLength: 1,
    maxLength: 1000,
    description: 'Why the restriction was applied (audited).',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({
    description: 'ISO-8601 expiry; omit for a restriction that stays until lifted.',
  })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

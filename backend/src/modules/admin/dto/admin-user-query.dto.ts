import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role, UserStatus } from '@qalam/shared';
import { IsEnum, IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

import { OffsetPaginationDto } from '../../../common/dto/offset-pagination.dto';
import { ADMIN_USER_SORT_TOKENS } from '../admin.constants';

/**
 * Query for the admin user grid (`GET /admin/users`). Extends the shared offset
 * DTO (admin table, docs 05 §5.2). Following the backend convention there are no
 * `@Transform`s: boolean-ish filters arrive as the literal strings `'true'`/
 * `'false'` (validated by `@IsIn`) and are interpreted in the controller;
 * multi-value/date params stay strings. Unknown params are rejected by the
 * global `forbidNonWhitelisted` pipe (docs 05 §6).
 */
export class AdminUserListQueryDto extends OffsetPaginationDto {
  @ApiPropertyOptional({
    description: 'Free-text search over username, display (pen) name, email, or exact user id.',
    example: 'meera',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: Object.values(Role), description: 'Filter by effective role.' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    enum: Object.values(UserStatus),
    description: 'Filter by account status.',
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'Email-verification filter (verified = has a verification timestamp).',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  verified?: string;

  @ApiPropertyOptional({ enum: ['public', 'private'], description: 'Account visibility filter.' })
  @IsOptional()
  @IsIn(['public', 'private'])
  visibility?: string;

  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'Only users with (or without) at least one published piece.',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  hasPublished?: string;

  @ApiPropertyOptional({ description: 'Registered on/after (ISO 8601).', example: '2026-01-01' })
  @IsOptional()
  @IsISO8601()
  registeredFrom?: string;

  @ApiPropertyOptional({ description: 'Registered on/before (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  registeredTo?: string;

  @ApiPropertyOptional({ description: 'Last login on/after (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  lastLoginFrom?: string;

  @ApiPropertyOptional({ description: 'Last login on/before (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  lastLoginTo?: string;

  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'Include soft-deleted (removed) accounts in the results.',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  includeDeleted?: string;

  @ApiPropertyOptional({
    description: 'Sort token: a field, `-` prefix = descending.',
    enum: ADMIN_USER_SORT_TOKENS,
    example: '-createdAt',
  })
  @IsOptional()
  @IsIn(ADMIN_USER_SORT_TOKENS)
  sort?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated column subset to return (unknown columns ignored).',
    example: 'username,email,role,status',
  })
  @IsOptional()
  @IsString()
  fields?: string;
}

/**
 * Query for the streaming export (`GET /admin/users/export`). Reuses every list
 * filter (so an export mirrors what the grid shows) and adds the output format;
 * pagination/sort/fields on the base are ignored — the export streams the full
 * filtered set in id order.
 */
export class ExportUsersQueryDto extends AdminUserListQueryDto {
  @ApiPropertyOptional({ enum: ['csv', 'json'], default: 'csv', description: 'Export format.' })
  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: string;
}

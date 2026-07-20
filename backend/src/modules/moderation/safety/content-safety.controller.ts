import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import { IsString, MaxLength, MinLength } from 'class-validator';

import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { Permissions } from '../../permissions/permissions.decorator';
import { ContentSafetyService } from './content-safety.service';
import type { SafetyVerdict } from './safety.types';

/** Request body for an on-demand content safety scan. */
export class ScanContentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  text!: string;
}

/**
 * Moderator-facing automated safety scan (AF6). Lets a moderator (or a tool)
 * run the same detector pipeline the platform uses internally. `report.review`
 * gates it. The service is also injected directly by other modules — this is
 * just the HTTP surface.
 */
@ApiTags('admin-moderation')
@ApiBearerAuth()
@Controller('admin/safety')
@UseGuards(RateLimitGuard)
export class ContentSafetyController {
  constructor(private readonly safety: ContentSafetyService) {}

  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.ReportReview)
  @RateLimit('write')
  @ApiOperation({ summary: 'Run automated spam/abuse detectors over a piece of text.' })
  @ApiOkResponse({ description: 'The aggregate safety verdict.' })
  scan(@Body() dto: ScanContentDto): Promise<SafetyVerdict> {
    return this.safety.evaluate({ text: dto.text });
  }
}

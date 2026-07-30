import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../auth/decorators/public.decorator';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ShareDto, ShareResponseDto } from './dto/share.dto';
import { SharesService } from './shares.service';

/**
 * Share tracking HTTP surface (E7). `@Public()` + `OptionalAuthGuard`: a public
 * piece can be shared by anonymous readers (user id is recorded when present).
 * Phase 1 stores the count only — no analytics dashboard (ADR §10).
 */
@ApiTags('shares')
@Controller()
export class SharesController {
  constructor(private readonly shares: SharesService) {}

  @Post('pieces/:id/shares')
  @Public()
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a share (internal / external / copy-link); bumps the count.' })
  @ApiOkResponse({ type: ShareResponseDto })
  share(
    @Param('id', ParseUUIDPipe) pieceId: string,
    @Body() dto: ShareDto,
    @Req() req: Request,
  ): Promise<ShareResponseDto> {
    const viewer = (req as Request & { user?: AuthenticatedUser }).user;
    return this.shares.share(pieceId, viewer?.id ?? null, dto.channel);
  }
}

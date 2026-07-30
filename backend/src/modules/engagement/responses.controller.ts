import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { Request } from 'express';

import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import { CreatePieceDto } from '../pieces/dto/create-piece.dto';
import { PieceResponseDto } from '../pieces/dto/piece-response.dto';
import { ResponseItemDto } from './dto/response-item.dto';
import { ResponsesService } from './responses.service';

/**
 * Responses HTTP surface (E7). A response is a new piece linked to a parent —
 * creating one reuses the create-draft body (`CreatePieceDto`). Creation is
 * authenticated; listing is `@Public()` + `OptionalAuthGuard` (visibility-gated).
 */
@ApiTags('responses')
@Controller()
export class ResponsesController {
  constructor(private readonly responses: ResponsesService) {}

  @Post('pieces/:id/responses')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.PieceCreate)
  @ApiOperation({
    summary: 'Write a response to a piece (creates a linked draft piece). Requires `piece.create`.',
  })
  @ApiCreatedResponse({ type: PieceResponseDto })
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) parentId: string,
    @Body() dto: CreatePieceDto,
  ): Promise<PieceResponseDto> {
    return this.responses.create(parentId, user.id, dto);
  }

  @Get('pieces/:id/responses')
  @Public()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'List responses to a piece (cursor-paginated; visibility-gated).' })
  @ApiOkResponse({ type: [ResponseItemDto] })
  async list(
    @Param('id', ParseUUIDPipe) parentId: string,
    @Query() query: CursorPaginationDto,
    @Req() req: Request,
  ) {
    const viewer = (req as Request & { user?: AuthenticatedUser }).user;
    const page = await this.responses.listForPiece(
      parentId,
      viewer?.id ?? null,
      query.cursor,
      query.limit,
    );
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }
}

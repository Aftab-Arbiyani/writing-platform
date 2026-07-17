import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';

import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../../permissions/permissions.decorator';
import { ConversationService } from '../conversations/conversation.service';
import {
  ConversationListQueryDto,
  CreateAiConversationDto,
  UpdateAiConversationDto,
} from '../dto/ai-request.dto';
import { AiConversationDetailDto, AiConversationSummaryDto } from '../dto/ai-response.dto';
import { toConversationDetail, toConversationSummary } from '../ai.mappers';

/**
 * AI conversation management (AF1) — owner-scoped CRUD, history, and export.
 * Requires `ai.use`; a foreign/missing id reads as AI_CONVERSATION_NOT_FOUND.
 * Cursor-paginated, newest first.
 */
@ApiTags('ai-conversations')
@ApiBearerAuth()
@Controller('ai/conversations')
@UseGuards(RateLimitGuard)
export class AiConversationsController {
  constructor(private readonly conversations: ConversationService) {}

  @Post()
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('write')
  @ApiOperation({ summary: 'Start a new AI conversation.' })
  @ApiOkResponse({ type: AiConversationSummaryDto })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAiConversationDto,
  ): Promise<AiConversationSummaryDto> {
    const conversation = await this.conversations.create(user.id, dto.feature, dto.title);
    return toConversationSummary(conversation);
  }

  @Get()
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'Your AI conversations, newest first (cursor-paginated).' })
  @ApiOkResponse({ type: [AiConversationSummaryDto] })
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: ConversationListQueryDto) {
    const page = await this.conversations.list(user.id, query.cursor, query.limit);
    return {
      success: true as const,
      data: page.items.map(toConversationSummary),
      meta: { pagination: page.meta },
    };
  }

  @Get(':id')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'A conversation with its full message history.' })
  @ApiOkResponse({ type: AiConversationDetailDto })
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AiConversationDetailDto> {
    const { conversation, messages } = await this.conversations.getDetail(user.id, id);
    return toConversationDetail(conversation, messages);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('write')
  @ApiOperation({ summary: 'Rename or archive a conversation.' })
  @ApiOkResponse({ type: AiConversationSummaryDto })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAiConversationDto,
  ): Promise<AiConversationSummaryDto> {
    let conversation = await this.conversations.getOwnedOrThrow(user.id, id);
    if (dto.title !== undefined) {
      conversation = await this.conversations.rename(user.id, id, dto.title);
    }
    if (dto.status !== undefined) {
      conversation = await this.conversations.setStatus(user.id, id, dto.status);
    }
    return toConversationSummary(conversation);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation and its messages.' })
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.conversations.remove(user.id, id);
  }

  @Get(':id/export')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'Export a conversation as a portable JSON document.' })
  @ApiOkResponse()
  export(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    return this.conversations.export(user.id, id);
  }
}

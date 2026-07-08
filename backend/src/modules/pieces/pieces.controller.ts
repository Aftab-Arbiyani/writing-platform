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
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreatePieceDto } from './dto/create-piece.dto';
import { PieceListQueryDto } from './dto/piece-list-query.dto';
import {
  PieceCoverResponseDto,
  PieceListItemDto,
  PieceResponseDto,
} from './dto/piece-response.dto';
import { SchedulePieceDto } from './dto/schedule-piece.dto';
import { UpdatePieceDto } from './dto/update-piece.dto';
import { PiecesService } from './pieces.service';

const COVER_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

/**
 * Writing lifecycle HTTP surface (docs 05). All routes are authenticated
 * (global JwtAuthGuard) and owner-scoped in the service, except `GET /pieces/:id`
 * which is `@Public()` + `OptionalAuthGuard` (published pieces are readable by
 * others, honoring piece + account visibility). List endpoints use the ADR §5
 * cursor envelope. Thin controllers (docs 16 §3.6).
 */
@ApiTags('pieces')
@Controller()
export class PiecesController {
  constructor(private readonly pieces: PiecesService) {}

  @Post('pieces')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a draft.' })
  @ApiCreatedResponse({ type: PieceResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePieceDto,
  ): Promise<PieceResponseDto> {
    return this.pieces.createDraft(user.id, dto);
  }

  @Get('me/drafts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my drafts (cursor-paginated).' })
  @ApiOkResponse({ type: [PieceListItemDto] })
  async drafts(@CurrentUser() user: AuthenticatedUser, @Query() query: PieceListQueryDto) {
    const page = await this.pieces.listMine(user.id, {
      ...query,
      status: 'draft',
    } as PieceListQueryDto);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Get('me/pieces')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all my pieces (optional status filter, cursor-paginated).' })
  @ApiOkResponse({ type: [PieceListItemDto] })
  async mine(@CurrentUser() user: AuthenticatedUser, @Query() query: PieceListQueryDto) {
    const page = await this.pieces.listMine(user.id, query);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Get('pieces/:id')
  @Public()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Read a piece (published + visible; owner sees any status).' })
  @ApiOkResponse({ type: PieceResponseDto })
  getById(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request): Promise<PieceResponseDto> {
    const viewer = (req as Request & { user?: AuthenticatedUser }).user;
    return this.pieces.getById(id, viewer?.id ?? null);
  }

  @Patch('pieces/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a piece (owner only; slug never changes).' })
  @ApiOkResponse({ type: PieceResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePieceDto,
  ): Promise<PieceResponseDto> {
    return this.pieces.update(id, user.id, dto);
  }

  @Delete('pieces/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a piece (owner only).' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.pieces.delete(id, user.id);
  }

  @Post('pieces/:id/preview')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview a piece as a reader would see it (owner only, any status).' })
  @ApiOkResponse({ type: PieceResponseDto })
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PieceResponseDto> {
    return this.pieces.preview(id, user.id);
  }

  @Post('pieces/:id/publish')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a piece (generates slug, validates required fields).' })
  @ApiOkResponse({ type: PieceResponseDto })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PieceResponseDto> {
    return this.pieces.publish(id, user.id);
  }

  @Post('pieces/:id/schedule')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Schedule a future publish (stored only; worker is a later epic).' })
  @ApiOkResponse({ type: PieceResponseDto })
  schedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SchedulePieceDto,
  ): Promise<PieceResponseDto> {
    return this.pieces.schedule(id, user.id, dto.scheduledAt);
  }

  @Post('pieces/:id/archive')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a published piece.' })
  @ApiOkResponse({ type: PieceResponseDto })
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PieceResponseDto> {
    return this.pieces.archive(id, user.id);
  }

  @Post('pieces/:id/unarchive')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore an archived piece to published.' })
  @ApiOkResponse({ type: PieceResponseDto })
  unarchive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PieceResponseDto> {
    return this.pieces.unarchive(id, user.id);
  }

  @Post('pieces/:id/duplicate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duplicate a piece into a fresh draft.' })
  @ApiCreatedResponse({ type: PieceResponseDto })
  duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PieceResponseDto> {
    return this.pieces.duplicate(id, user.id);
  }

  @Post('pieces/:id/cover')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: 'Upload/replace the cover image (owner only).' })
  @ApiOkResponse({ type: PieceCoverResponseDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: COVER_UPLOAD_MAX_BYTES } }))
  uploadCover(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<PieceCoverResponseDto> {
    return this.pieces.updateCover(id, user.id, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    });
  }
}

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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PERMISSIONS } from '@qalam/shared';

import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import { CollectionsService } from './collections.service';
import { AddCollectionPieceDto } from './dto/add-collection-piece.dto';
import { CollectionPieceItemDto, CollectionResponseDto } from './dto/collection-response.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

/**
 * Collections HTTP surface (E7). Every route is authenticated and owner-scoped
 * in the service — collections are private in Phase 1. Thin controller.
 */
@ApiTags('collections')
@ApiBearerAuth()
@Controller('collections')
@Permissions(PERMISSIONS.CollectionManage)
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a collection (private by default).' })
  @ApiCreatedResponse({ type: CollectionResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCollectionDto,
  ): Promise<CollectionResponseDto> {
    return this.collections.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my collections ("Favorites" always present; cursor-paginated).' })
  @ApiOkResponse({ type: [CollectionResponseDto] })
  async mine(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorPaginationDto) {
    const page = await this.collections.listMine(user.id, query.cursor, query.limit);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a collection (owner only).' })
  @ApiOkResponse({ type: CollectionResponseDto })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CollectionResponseDto> {
    return this.collections.get(id, user.id);
  }

  @Get(':id/pieces')
  @ApiOperation({ summary: 'List the pieces in a collection (owner only; cursor-paginated).' })
  @ApiOkResponse({ type: [CollectionPieceItemDto] })
  async pieces(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CursorPaginationDto,
  ) {
    const page = await this.collections.listPieces(id, user.id, query.cursor, query.limit);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename / re-describe a collection (owner only).' })
  @ApiOkResponse({ type: CollectionResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCollectionDto,
  ): Promise<CollectionResponseDto> {
    return this.collections.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a collection (owner only; the default cannot be deleted).' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.collections.delete(id, user.id);
  }

  @Post(':id/pieces')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a piece to a collection.' })
  @ApiOkResponse({ type: CollectionResponseDto })
  addPiece(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCollectionPieceDto,
  ): Promise<CollectionResponseDto> {
    return this.collections.addPiece(id, user.id, dto);
  }

  @Delete(':id/pieces/:pieceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a piece from a collection.' })
  async removePiece(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pieceId', ParseUUIDPipe) pieceId: string,
  ): Promise<void> {
    await this.collections.removePiece(id, user.id, pieceId);
  }
}

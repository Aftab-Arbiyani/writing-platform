import { Injectable } from '@nestjs/common';
import { DEFAULT_COLLECTION_SLUG, DEFAULT_COLLECTION_TITLE, Visibility } from '@qalam/shared';
import { slugify } from '@qalam/utils';

import { TransactionRunner } from '../../common/database/transaction-runner';
import { decodeCursor } from '../../common/pagination/cursor.util';
import { buildCursorPage } from '../../common/pagination/pagination.helper';
import type { CursorPage } from '../../common/types/paginated-result';
import { PiecesService } from '../pieces/pieces.service';
import type { AddCollectionPieceDto } from './dto/add-collection-piece.dto';
import type { CollectionPieceItemDto, CollectionResponseDto } from './dto/collection-response.dto';
import type { CreateCollectionDto } from './dto/create-collection.dto';
import type { UpdateCollectionDto } from './dto/update-collection.dto';
import type { CollectionPieceRow } from './collections.repository';
import { CollectionsRepository } from './collections.repository';
import { Collection } from './entities/collection.entity';
import {
  CollectionDefaultImmutableException,
  CollectionNameTakenException,
  CollectionNotFoundException,
  CollectionPieceExistsException,
  CollectionPieceNotFoundException,
} from './exceptions/engagement.exceptions';

/**
 * Collections — private, user-curated lists of pieces (docs 04 §3.5, E7). Every
 * user gets an auto-created default "Favorites" collection (lazy get-or-create).
 * Reads and mutations are owner-only; a foreign/missing collection is reported
 * as 404 (privacy-preserving). `pieces_count` is maintained transactionally.
 */
@Injectable()
export class CollectionsService {
  constructor(
    private readonly collections: CollectionsRepository,
    private readonly pieces: PiecesService,
    private readonly transactions: TransactionRunner,
  ) {}

  async create(ownerId: string, dto: CreateCollectionDto): Promise<CollectionResponseDto> {
    const slug = collectionSlug(dto.title);
    if ((await this.collections.findByOwnerAndSlug(ownerId, slug)) !== null) {
      throw new CollectionNameTakenException();
    }
    const created = await this.collections.create({
      ownerId,
      title: dto.title.trim(),
      slug,
      description: dto.description?.trim() ?? null,
      visibility: dto.visibility ?? Visibility.Private,
      isDefault: false,
    });
    return toDto(created);
  }

  /** Returns the owner's "Favorites" collection, creating it on first access. */
  async getOrCreateDefault(ownerId: string): Promise<Collection> {
    const existing = await this.collections.findDefault(ownerId);
    if (existing !== null) {
      return existing;
    }
    try {
      return await this.collections.create({
        ownerId,
        title: DEFAULT_COLLECTION_TITLE,
        slug: DEFAULT_COLLECTION_SLUG,
        visibility: Visibility.Private,
        isDefault: true,
      });
    } catch {
      // Lost a race on the partial-unique default index — the row now exists.
      const again = await this.collections.findDefault(ownerId);
      if (again !== null) {
        return again;
      }
      throw new CollectionNotFoundException();
    }
  }

  /** Owner's collections (Favorites always present), cursor-paginated. */
  async listMine(
    ownerId: string,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<CollectionResponseDto>> {
    await this.getOrCreateDefault(ownerId);
    const rows = await this.collections.listByOwner(ownerId, decodeCursor(rawCursor), limit);
    const page = buildCursorPage(rows, limit, (c) => ({
      k: c.createdAt.toISOString(),
      id: c.id,
    }));
    return { items: page.items.map(toDto), meta: page.meta };
  }

  async get(collectionId: string, ownerId: string): Promise<CollectionResponseDto> {
    return toDto(await this.loadOwned(collectionId, ownerId));
  }

  async update(
    collectionId: string,
    ownerId: string,
    dto: UpdateCollectionDto,
  ): Promise<CollectionResponseDto> {
    const collection = await this.loadOwned(collectionId, ownerId);
    // The default "Favorites" collection cannot be renamed (slug is stable).
    if (collection.isDefault && dto.title !== undefined && dto.title.trim() !== collection.title) {
      throw new CollectionDefaultImmutableException();
    }
    await this.collections.update(collectionId, {
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.description !== undefined && { description: dto.description.trim() }),
      ...(dto.visibility !== undefined && { visibility: dto.visibility }),
    });
    return this.get(collectionId, ownerId);
  }

  async delete(collectionId: string, ownerId: string): Promise<void> {
    const collection = await this.loadOwned(collectionId, ownerId);
    if (collection.isDefault) {
      throw new CollectionDefaultImmutableException();
    }
    await this.collections.softDelete(collectionId);
  }

  /** Add a piece to a collection (piece must be published + visible to the owner). */
  async addPiece(
    collectionId: string,
    ownerId: string,
    dto: AddCollectionPieceDto,
  ): Promise<CollectionResponseDto> {
    await this.loadOwned(collectionId, ownerId);
    await this.pieces.getEngageablePiece(dto.pieceId, ownerId);
    if ((await this.collections.findMembership(collectionId, dto.pieceId)) !== null) {
      throw new CollectionPieceExistsException();
    }
    await this.transactions.run(async (manager) => {
      const position = await this.collections.nextPosition(collectionId, manager);
      await this.collections.addPiece(
        { collectionId, pieceId: dto.pieceId, position, note: dto.note ?? null },
        manager,
      );
      await this.collections.incrementPiecesCount(collectionId, 1, manager);
    });
    return this.get(collectionId, ownerId);
  }

  async removePiece(collectionId: string, ownerId: string, pieceId: string): Promise<void> {
    await this.loadOwned(collectionId, ownerId);
    await this.transactions.run(async (manager) => {
      if (!(await this.collections.removePiece(collectionId, pieceId, manager))) {
        throw new CollectionPieceNotFoundException();
      }
      await this.collections.incrementPiecesCount(collectionId, -1, manager);
    });
  }

  /** A collection's pieces (owner-only), cursor-paginated. */
  async listPieces(
    collectionId: string,
    ownerId: string,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<CollectionPieceItemDto>> {
    await this.loadOwned(collectionId, ownerId);
    const rows = await this.collections.listPieces(collectionId, decodeCursor(rawCursor), limit);
    const page = buildCursorPage(rows, limit, (r) => ({
      k: new Date(r.createdAt).toISOString(),
      id: r.membershipId,
    }));
    return { items: page.items.map(toPieceItem), meta: page.meta };
  }

  // ── helpers ────────────────────────────────────────────────────────────

  /** Loads a collection the caller owns, or throws 404 (privacy-preserving). */
  private async loadOwned(collectionId: string, ownerId: string): Promise<Collection> {
    const collection = await this.collections.findById(collectionId);
    if (collection === null || collection.ownerId !== ownerId) {
      throw new CollectionNotFoundException();
    }
    return collection;
  }
}

function collectionSlug(title: string): string {
  return slugify(title, { maxLength: 80 }) || 'untitled';
}

function toDto(c: Collection): CollectionResponseDto {
  return {
    id: c.id,
    title: c.title,
    slug: c.slug,
    description: c.description,
    coverImageKey: c.coverImageKey,
    visibility: c.visibility,
    isDefault: c.isDefault,
    piecesCount: c.piecesCount,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function toPieceItem(row: CollectionPieceRow): CollectionPieceItemDto {
  return {
    pieceId: row.pieceId,
    slug: row.slug,
    title: row.title,
    position: row.position,
    note: row.note,
    addedAt: new Date(row.createdAt).toISOString(),
  };
}

import { Injectable } from '@nestjs/common';

import { TransactionRunner } from '../../common/database/transaction-runner';
import { decodeCursor } from '../../common/pagination/cursor.util';
import { buildCursorPage } from '../../common/pagination/pagination.helper';
import type { CursorPage } from '../../common/types/paginated-result';
import type { CreatePieceDto } from '../pieces/dto/create-piece.dto';
import type { PieceResponseDto } from '../pieces/dto/piece-response.dto';
import { PiecesService } from '../pieces/pieces.service';
import type { ResponseItemDto } from './dto/response-item.dto';
import type { ResponseRow } from './responses.repository';
import { ResponsesRepository } from './responses.repository';
import { PieceStatsRepository } from './piece-stats.repository';
import { ResponseToSelfException } from './exceptions/engagement.exceptions';

/**
 * Responses (docs 04 §3.2, docs 18 E7): a response IS a new piece linked to a
 * parent piece. Creating one reuses `PiecesService.createDraft` (no duplicated
 * piece logic), then records the `responses` link and bumps the parent's
 * `responses_count`. Listing shows only responses whose piece is published +
 * visible to the viewer (docs 13 §4.2).
 */
@Injectable()
export class ResponsesService {
  constructor(
    private readonly responses: ResponsesRepository,
    private readonly pieceStats: PieceStatsRepository,
    private readonly pieces: PiecesService,
    private readonly transactions: TransactionRunner,
  ) {}

  /**
   * Creates a response piece to `parentPieceId`. The parent must be published +
   * visible to the author; the response is created as a draft (the author
   * publishes it through the normal lifecycle) and linked to the parent.
   */
  async create(
    parentPieceId: string,
    authorId: string,
    dto: CreatePieceDto,
  ): Promise<PieceResponseDto> {
    await this.pieces.getEngageablePiece(parentPieceId, authorId);

    // A response is a fresh piece — reuse the existing draft-creation path.
    const responsePiece = await this.pieces.createDraft(authorId, dto);
    if (responsePiece.id === parentPieceId) {
      // Defensive — a freshly created piece can never equal the parent.
      throw new ResponseToSelfException();
    }

    await this.transactions.run(async (manager) => {
      await this.responses.create(responsePiece.id, parentPieceId, manager);
      await this.pieceStats.increment(parentPieceId, { responses: 1 }, manager);
    });
    return responsePiece;
  }

  /** Responses to a piece, cursor-paginated (visibility-filtered). */
  async listForPiece(
    parentPieceId: string,
    viewerId: string | null,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<ResponseItemDto>> {
    await this.pieces.getEngageablePiece(parentPieceId, viewerId);
    const rows = await this.responses.listByParent(
      parentPieceId,
      viewerId,
      decodeCursor(rawCursor),
      limit,
    );
    const page = buildCursorPage(rows, limit, (r) => ({
      k: new Date(r.respondedAt).toISOString(),
      id: r.responseId,
    }));
    return { items: page.items.map(toResponseItem), meta: page.meta };
  }
}

function toResponseItem(row: ResponseRow): ResponseItemDto {
  return {
    pieceId: row.pieceId,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    author: { username: row.username, penName: row.penName },
    publishedAt: row.publishedAt !== null ? new Date(row.publishedAt).toISOString() : null,
    respondedAt: new Date(row.respondedAt).toISOString(),
  };
}

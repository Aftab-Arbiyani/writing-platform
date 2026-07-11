import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PieceStatus, Visibility } from '@qalam/shared';
import { slugify } from '@qalam/utils';
import { randomBytes } from 'node:crypto';

import { TransactionRunner } from '../../common/database/transaction-runner';
import { DomainEventBus } from '../../common/events/domain-event-bus';
import { DomainEventType } from '../../common/events/domain-events';
import { JOB_ENQUEUER, type JobEnqueuer } from '../../common/queue/job-enqueuer.port';
import { JOB } from '../../common/queue/queue.constants';
import { decodeCursor } from '../../common/pagination/cursor.util';
import { buildCursorPage } from '../../common/pagination/pagination.helper';
import type { CursorPage } from '../../common/types/paginated-result';
import type { UploadedImage } from '../../media/image.service';
import { MediaService } from '../../media/media.service';
import { ProfileService } from '../users/profile.service';
import { FollowService } from '../users/follow.service';
import { UsersService } from '../users/users.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { sanitizeContent } from './content/content-sanitizer';
import { deriveContentMetrics } from './content/content.util';
import type { CreatePieceDto } from './dto/create-piece.dto';
import type { PieceListQueryDto } from './dto/piece-list-query.dto';
import type {
  PieceCoverResponseDto,
  PieceListItemDto,
  PieceResponseDto,
} from './dto/piece-response.dto';
import type { UpdatePieceDto } from './dto/update-piece.dto';
import { Piece } from './entities/piece.entity';
import {
  PieceAlreadyPublishedException,
  PieceForbiddenException,
  PieceIncompleteException,
  PieceInvalidTransitionException,
  PieceNotFoundException,
  PieceNotPublishedException,
  PieceScheduleInPastException,
} from './exceptions/pieces.exceptions';
import { PiecesRepository } from './pieces.repository';

const EMPTY_DOC = { type: 'doc', content: [] };

/**
 * Writing lifecycle (docs 18 E3/E4): draft → (scheduled) → published → archived.
 * Content is sanitized (docs 13 §5.2) + derived (word count / reading time) on
 * every content write; slug is generated at first publish/schedule and then
 * permanent; publish/archive maintain the author's denormalized piece count.
 * Owner-only for every mutation; reads honor piece + account visibility (§4.2).
 */
@Injectable()
export class PiecesService {
  constructor(
    private readonly pieces: PiecesRepository,
    private readonly taxonomy: TaxonomyService,
    private readonly users: UsersService,
    private readonly profiles: ProfileService,
    private readonly follows: FollowService,
    private readonly media: MediaService,
    private readonly transactions: TransactionRunner,
    private readonly events: DomainEventBus,
    // Optional so unit tests (and any worker-less context) construct without the
    // queue; when present, `schedule()` also enqueues a delayed publish job.
    @Optional() @Inject(JOB_ENQUEUER) private readonly jobs?: JobEnqueuer,
  ) {}

  private readonly logger = new Logger(PiecesService.name);

  /**
   * Counts one author's non-deleted pieces, optionally by status (admin per-user
   * statistics, E12.5). Published count is also available denormalized on the
   * profile; this covers drafts/others which have no counter.
   */
  countByAuthor(authorId: string, status?: PieceStatus): Promise<number> {
    return this.pieces.countByAuthor(authorId, status);
  }

  /**
   * Draft counts for many authors, keyed by author id (admin grid). One batched
   * query — no per-row N+1. Authors with zero drafts are absent from the map.
   */
  async countDraftsByAuthors(authorIds: string[]): Promise<Record<string, number>> {
    const rows = await this.pieces.countDraftsByAuthors(authorIds);
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.authorId] = row.count;
    }
    return counts;
  }

  async createDraft(authorId: string, dto: CreatePieceDto): Promise<PieceResponseDto> {
    const languageId = await this.taxonomy.resolveLanguageCode(dto.languageCode);
    const genreId =
      dto.genreSlug !== undefined
        ? (await this.taxonomy.resolveGenreSlugs([dto.genreSlug]))[0]
        : null;
    const content = dto.content ?? EMPTY_DOC;
    sanitizeContent(content);
    const metrics = deriveContentMetrics(content);

    const piece = await this.transactions.run(async (manager) => {
      const created = await this.pieces.create(
        {
          authorId,
          title: dto.title?.trim() ?? '',
          subtitle: dto.subtitle ?? null,
          featuredQuote: dto.featuredQuote ?? null,
          content,
          contentText: metrics.contentText,
          wordCount: metrics.wordCount,
          readingTimeSeconds: metrics.readingTimeSeconds,
          languageId,
          genreId,
          visibility: dto.visibility ?? Visibility.Public,
          status: PieceStatus.Draft,
        },
        manager,
      );
      if (dto.tags !== undefined) {
        await this.pieces.setTags(created.id, await this.resolveTagIds(dto.tags), manager);
      }
      return created;
    });
    return this.buildResponse(piece);
  }

  async getById(id: string, viewerId: string | null): Promise<PieceResponseDto> {
    const piece = await this.pieces.findById(id);
    if (piece === null) {
      throw new PieceNotFoundException();
    }
    await this.assertReadable(piece, viewerId);
    return this.buildResponse(piece);
  }

  /** Owner preview — renders the piece as a reader would see it, at any status. */
  async preview(id: string, ownerId: string): Promise<PieceResponseDto> {
    return this.buildResponse(await this.loadOwned(id, ownerId));
  }

  async update(id: string, ownerId: string, dto: UpdatePieceDto): Promise<PieceResponseDto> {
    const piece = await this.loadOwned(id, ownerId);
    if (piece.status === PieceStatus.Archived) {
      throw new PieceInvalidTransitionException(piece.status, 'edited');
    }

    const patch: Partial<Piece> = {};
    if (dto.title !== undefined) patch.title = dto.title.trim();
    if (dto.subtitle !== undefined) patch.subtitle = dto.subtitle;
    if (dto.featuredQuote !== undefined) patch.featuredQuote = dto.featuredQuote;
    if (dto.visibility !== undefined) patch.visibility = dto.visibility;
    if (dto.languageCode !== undefined)
      patch.languageId = await this.taxonomy.resolveLanguageCode(dto.languageCode);
    if (dto.genreSlug !== undefined)
      patch.genreId = (await this.taxonomy.resolveGenreSlugs([dto.genreSlug]))[0] ?? null;
    if (dto.content !== undefined) {
      sanitizeContent(dto.content);
      const metrics = deriveContentMetrics(dto.content);
      patch.content = dto.content;
      patch.contentText = metrics.contentText;
      patch.wordCount = metrics.wordCount;
      patch.readingTimeSeconds = metrics.readingTimeSeconds;
    }

    await this.transactions.run(async (manager) => {
      await this.pieces.update(id, patch, manager);
      if (dto.tags !== undefined) {
        await this.pieces.setTags(id, await this.resolveTagIds(dto.tags), manager);
      }
    });
    return this.getOwn(id, ownerId);
  }

  async delete(id: string, ownerId: string): Promise<void> {
    const piece = await this.loadOwned(id, ownerId);
    await this.transactions.run(async (manager) => {
      await this.pieces.softDelete(id, manager);
      if (piece.status === PieceStatus.Published) {
        await this.profiles.adjustPublishedCount(ownerId, -1);
      }
    });
  }

  async publish(id: string, ownerId: string): Promise<PieceResponseDto> {
    const piece = await this.loadOwned(id, ownerId);
    if (piece.status === PieceStatus.Published) {
      throw new PieceAlreadyPublishedException();
    }
    if (piece.status === PieceStatus.Archived) {
      throw new PieceInvalidTransitionException(piece.status, PieceStatus.Published);
    }
    this.assertPublishable(piece);
    const slug = piece.slug ?? (await this.generateSlug(piece.title));

    await this.transactions.run(async (manager) => {
      await this.pieces.update(
        id,
        {
          status: PieceStatus.Published,
          slug,
          publishedAt: piece.publishedAt ?? new Date(),
          scheduledAt: null,
        },
        manager,
      );
      await this.profiles.adjustPublishedCount(ownerId, 1);
    });
    // E9: notify users @mentioned in the published piece (listener reads content).
    await this.events.emit(DomainEventType.PiecePublished, { pieceId: id, authorId: ownerId });
    return this.getOwn(id, ownerId);
  }

  async schedule(id: string, ownerId: string, scheduledAtIso: string): Promise<PieceResponseDto> {
    const piece = await this.loadOwned(id, ownerId);
    if (piece.status === PieceStatus.Published) {
      throw new PieceAlreadyPublishedException();
    }
    if (piece.status === PieceStatus.Archived) {
      throw new PieceInvalidTransitionException(piece.status, PieceStatus.Scheduled);
    }
    const scheduledAt = new Date(scheduledAtIso);
    if (scheduledAt.getTime() <= Date.now()) {
      throw new PieceScheduleInPastException();
    }
    this.assertPublishable(piece);
    const slug = piece.slug ?? (await this.generateSlug(piece.title));
    await this.pieces.update(id, { status: PieceStatus.Scheduled, scheduledAt, slug });

    // Enqueue a delayed publish job (docs 02 §6.2): the low-latency path that
    // fires at publishAt. jobId = pieceId so a reschedule replaces the pending
    // job rather than stacking a second one. Best-effort — the per-minute
    // reconciliation sweep is the durable guarantee, so a failed enqueue is
    // logged and swallowed, never failing the schedule request.
    if (this.jobs !== undefined) {
      try {
        await this.jobs.enqueue(
          JOB.PublishOne,
          { pieceId: id },
          { jobId: `publish:${id}`, delayMs: Math.max(0, scheduledAt.getTime() - Date.now()) },
        );
      } catch (error) {
        this.logger.warn(
          `failed to enqueue delayed publish for ${id}: ${(error as Error).message}`,
        );
      }
    }
    return this.getOwn(id, ownerId);
  }

  // ── Scheduled-publish worker entry points (Epic 11) ─────────────────────────

  /**
   * Publishes every scheduled piece whose time has arrived — the reconciliation
   * sweep run every minute by the `scheduled-publish` worker (docs 18 E4). Reuses
   * the owner-scoped {@link publish} path per piece (system context = the piece's
   * own author), so the publish transaction, slug, count bump, and
   * `PiecePublished` event are never duplicated. Idempotent: an already-published
   * piece no longer matches the due query, and `publish` guards double-publish.
   * Each piece is isolated — one failure is recorded and the sweep continues.
   */
  async publishDueScheduled(limit = 100): Promise<{ published: string[]; failed: string[] }> {
    const due = await this.pieces.findDueScheduled(new Date(), limit);
    const published: string[] = [];
    const failed: string[] = [];
    for (const piece of due) {
      try {
        await this.publish(piece.id, piece.authorId);
        published.push(piece.id);
      } catch (error) {
        failed.push(piece.id);
        this.logger.error(
          `scheduled publish failed for piece ${piece.id}: ${(error as Error).message}`,
        );
      }
    }
    return { published, failed };
  }

  /**
   * Publishes one scheduled piece by id — the delayed-job path. Re-verifies the
   * piece is still scheduled and actually due before publishing (the writer may
   * have edited, unscheduled, or deleted it since — docs 02 §6.2), so a stale
   * delayed job is a safe no-op. Returns whether it published.
   */
  async publishScheduledById(pieceId: string): Promise<boolean> {
    const piece = await this.pieces.findById(pieceId);
    if (
      piece === null ||
      piece.status !== PieceStatus.Scheduled ||
      piece.scheduledAt === null ||
      piece.scheduledAt.getTime() > Date.now()
    ) {
      return false;
    }
    await this.publish(pieceId, piece.authorId);
    return true;
  }

  /** Hard-purges soft-deleted pieces older than `cutoff` (maintenance). Returns count removed. */
  purgeSoftDeleted(cutoff: Date): Promise<number> {
    return this.pieces.hardDeleteSoftDeletedBefore(cutoff);
  }

  async archive(id: string, ownerId: string): Promise<PieceResponseDto> {
    const piece = await this.loadOwned(id, ownerId);
    if (piece.status !== PieceStatus.Published) {
      throw new PieceInvalidTransitionException(piece.status, PieceStatus.Archived);
    }
    await this.transactions.run(async (manager) => {
      await this.pieces.update(
        id,
        { status: PieceStatus.Archived, archivedAt: new Date() },
        manager,
      );
      await this.profiles.adjustPublishedCount(ownerId, -1);
    });
    // E10: analytics tracks pieces archived per writer.
    await this.events.emit(DomainEventType.PieceArchived, { pieceId: id, authorId: ownerId });
    return this.getOwn(id, ownerId);
  }

  async unarchive(id: string, ownerId: string): Promise<PieceResponseDto> {
    const piece = await this.loadOwned(id, ownerId);
    if (piece.status !== PieceStatus.Archived) {
      throw new PieceInvalidTransitionException(piece.status, PieceStatus.Published);
    }
    await this.transactions.run(async (manager) => {
      await this.pieces.update(id, { status: PieceStatus.Published, archivedAt: null }, manager);
      await this.profiles.adjustPublishedCount(ownerId, 1);
    });
    return this.getOwn(id, ownerId);
  }

  /**
   * Moderator take-down (A5 Moderation) — acts on ANY piece regardless of author
   * by resolving the real `authorId` and delegating to the owner-scoped path, so
   * all transaction / counter / event logic runs unchanged. Tolerant: a
   * missing/already-gone target is a no-op (the report still resolves).
   */
  async moderateHide(id: string): Promise<void> {
    const piece = await this.pieces.findById(id);
    if (piece !== null && piece.status === PieceStatus.Published) {
      await this.archive(id, piece.authorId);
    }
  }

  async moderateRestore(id: string): Promise<void> {
    const piece = await this.pieces.findById(id);
    if (piece !== null) {
      if (piece.status === PieceStatus.Archived) {
        await this.unarchive(id, piece.authorId);
      }
      return;
    }
    // Removed (soft-deleted) content: reverse the delete and re-increment the
    // published counter if it was live (A5 appeal-approve restore).
    const removed = await this.pieces.findByIdWithDeleted(id);
    if (removed !== null) {
      await this.transactions.run(async (manager) => {
        await this.pieces.restore(id, manager);
        if (removed.status === PieceStatus.Published) {
          await this.profiles.adjustPublishedCount(removed.authorId, 1);
        }
      });
    }
  }

  async moderateRemove(id: string): Promise<void> {
    const piece = await this.pieces.findById(id);
    if (piece !== null) {
      await this.delete(id, piece.authorId);
    }
  }

  /** The author id of a piece, for moderation report attribution. Null if absent. */
  async findAuthorId(id: string): Promise<string | null> {
    const piece = await this.pieces.findById(id);
    return piece?.authorId ?? null;
  }

  async duplicate(id: string, ownerId: string): Promise<PieceResponseDto> {
    const source = await this.loadOwned(id, ownerId);
    const tagIds = await this.pieces.getTagIds(id);
    const copy = await this.transactions.run(async (manager) => {
      const created = await this.pieces.create(
        {
          authorId: ownerId,
          title: `${source.title} (copy)`.trim(),
          subtitle: source.subtitle,
          featuredQuote: source.featuredQuote,
          content: source.content,
          contentText: source.contentText,
          wordCount: source.wordCount,
          readingTimeSeconds: source.readingTimeSeconds,
          languageId: source.languageId,
          genreId: source.genreId,
          visibility: source.visibility,
          status: PieceStatus.Draft, // always a fresh draft: no slug, no published_at
        },
        manager,
      );
      if (tagIds.length > 0) {
        await this.pieces.setTags(created.id, tagIds, manager);
      }
      return created;
    });
    return this.buildResponse(copy);
  }

  async updateCover(
    id: string,
    ownerId: string,
    file: UploadedImage,
  ): Promise<PieceCoverResponseDto> {
    const piece = await this.loadOwned(id, ownerId);
    const key = await this.media.uploadPieceCover(id, file);
    await this.pieces.update(id, { coverImageKey: key });
    await this.media.deleteQuietly(piece.coverImageKey);
    return { key };
  }

  async listMine(
    authorId: string,
    query: PieceListQueryDto,
  ): Promise<CursorPage<PieceListItemDto>> {
    const rows = await this.pieces.listByAuthor(authorId, {
      status: query.status,
      cursor: decodeCursor(query.cursor),
      limit: query.limit,
    });
    const page = buildCursorPage(rows, query.limit, (p) => ({
      k: p.createdAt.toISOString(),
      id: p.id,
    }));
    return { items: page.items.map(toListItem), meta: page.meta };
  }

  /**
   * Loads a piece for **engagement** (like/clap/bookmark/comment/respond/share),
   * enforcing the two gates every engagement path shares: read visibility (a
   * hidden piece is 404, privacy-preserving — docs 13 §4.2) and publication
   * (engagement is only allowed on a published piece — `PIECE_NOT_PUBLISHED`
   * 409). Exported so the engagement module (E7) reuses this exact
   * logic instead of duplicating it or importing this module's repository
   * (docs 16 §3.1). Returns the entity; callers read `id` / `authorId`.
   */
  async getEngageablePiece(pieceId: string, viewerId: string | null): Promise<Piece> {
    const piece = await this.pieces.findById(pieceId);
    if (piece === null) {
      throw new PieceNotFoundException();
    }
    await this.assertReadable(piece, viewerId);
    if (piece.status !== PieceStatus.Published) {
      throw new PieceNotPublishedException();
    }
    return piece;
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private async getOwn(id: string, ownerId: string): Promise<PieceResponseDto> {
    return this.buildResponse(await this.loadOwned(id, ownerId));
  }

  private async loadOwned(id: string, ownerId: string): Promise<Piece> {
    const piece = await this.pieces.findById(id);
    if (piece === null) {
      throw new PieceNotFoundException();
    }
    if (piece.authorId !== ownerId) {
      // A published piece is public — honest 403. A draft/scheduled/archived
      // piece is invisible to non-owners — 404, never revealing it exists (docs 05 §4).
      throw piece.status === PieceStatus.Published
        ? new PieceForbiddenException()
        : new PieceNotFoundException();
    }
    return piece;
  }

  /** Read visibility (docs 13 §4.2). Denials are 404 (privacy-preserving). */
  private async assertReadable(piece: Piece, viewerId: string | null): Promise<void> {
    if (viewerId === piece.authorId) {
      return; // owner sees any status
    }
    if (piece.status !== PieceStatus.Published || piece.visibility === Visibility.Private) {
      throw new PieceNotFoundException();
    }
    // public/unlisted + published: gate on the author's account privacy.
    const author = await this.profiles.getOrCreateByUserId(piece.authorId);
    if (author.isPrivate) {
      if (viewerId === null || !(await this.follows.isAcceptedFollower(viewerId, piece.authorId))) {
        throw new PieceNotFoundException();
      }
    }
  }

  private assertPublishable(piece: Piece): void {
    const missing: string[] = [];
    if (piece.title.trim() === '') missing.push('title');
    if (piece.genreId === null) missing.push('genre');
    if (piece.wordCount === 0) missing.push('content');
    if (missing.length > 0) {
      throw new PieceIncompleteException(missing);
    }
  }

  private async generateSlug(title: string): Promise<string> {
    const base = slugify(title, { maxLength: 80 }) || 'untitled';
    if (!(await this.pieces.slugExists(base))) {
      return base;
    }
    for (let i = 0; i < 5; i++) {
      const candidate = `${base}-${randomBytes(3).toString('hex')}`;
      if (!(await this.pieces.slugExists(candidate))) {
        return candidate;
      }
    }
    return `${base}-${randomBytes(8).toString('hex')}`;
  }

  private async resolveTagIds(names: string[]): Promise<string[]> {
    const tags = await this.taxonomy.resolveTags(names);
    return tags.map((t) => t.id);
  }

  private async buildResponse(piece: Piece): Promise<PieceResponseDto> {
    const [user, authorProfile, language, tagIds] = await Promise.all([
      this.users.findById(piece.authorId),
      this.profiles.getOrCreateByUserId(piece.authorId),
      this.taxonomy.getLanguage(piece.languageId),
      this.pieces.getTagIds(piece.id),
    ]);
    const [tags, genres] = await Promise.all([
      this.taxonomy.getTagsByIds(tagIds),
      piece.genreId !== null ? this.taxonomy.getGenresByIds([piece.genreId]) : Promise.resolve([]),
    ]);
    const genre = genres[0] ?? null;

    return {
      id: piece.id,
      author: { username: user?.username ?? '', penName: authorProfile.penName },
      title: piece.title,
      subtitle: piece.subtitle,
      slug: piece.slug,
      content: piece.content,
      featuredQuote: piece.featuredQuote,
      coverImageKey: piece.coverImageKey,
      language,
      genre,
      tags,
      status: piece.status,
      visibility: piece.visibility,
      wordCount: piece.wordCount,
      readingTimeSeconds: piece.readingTimeSeconds,
      scheduledAt: piece.scheduledAt?.toISOString() ?? null,
      publishedAt: piece.publishedAt?.toISOString() ?? null,
      archivedAt: piece.archivedAt?.toISOString() ?? null,
      seoMetadata: piece.seoMetadata,
      createdAt: piece.createdAt.toISOString(),
      updatedAt: piece.updatedAt.toISOString(),
    };
  }
}

function toListItem(piece: Piece): PieceListItemDto {
  return {
    id: piece.id,
    title: piece.title,
    slug: piece.slug,
    status: piece.status,
    visibility: piece.visibility,
    coverImageKey: piece.coverImageKey,
    wordCount: piece.wordCount,
    readingTimeSeconds: piece.readingTimeSeconds,
    publishedAt: piece.publishedAt?.toISOString() ?? null,
    scheduledAt: piece.scheduledAt?.toISOString() ?? null,
    updatedAt: piece.updatedAt.toISOString(),
  };
}

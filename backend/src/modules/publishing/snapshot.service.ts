import { Injectable } from '@nestjs/common';
import {
  MAX_SNAPSHOTS_PER_STORY,
  POLICY_ACTIONS,
  PolicyResourceType,
  type SnapshotReason,
} from '@qalam/shared';

import { AuditService } from '../audit/audit.service';
import { PieceNotFoundException } from '../pieces/exceptions/pieces.exceptions';
import { PiecesService } from '../pieces/pieces.service';
import { PolicyEngineService } from '../policy';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { PieceResponseDto } from '../pieces/dto/piece-response.dto';
import type { SnapshotDto, SnapshotHistoryDto } from './dto/publishing-response.dto';
import { PUBLISHING_AUDIT_ACTIONS, PUBLISHING_AUDIT_TARGET } from './publishing.constants';
import { SnapshotNotFoundException } from './publishing.exceptions';
import { PublishingRepository } from './publishing.repository';
import { SnapshotHistoryService } from './snapshot-history.service';
import {
  buildStoryResource,
  subjectOf,
  toSnapshotDto,
  type StoryContext,
} from './publishing.mappers';

/**
 * Content versioning (AF6). {@link create} captures the current story content as
 * an immutable, versioned snapshot (on publish, before a destructive edit, at
 * review time, or on manual request) and prunes the oldest non-pinned ones past
 * {@link MAX_SNAPSHOTS_PER_STORY}. {@link revert} restores a snapshot's content
 * back onto the live piece — authorized through the Policy Engine.
 *
 * Content is captured via `PiecesService.preview(storyId, authorId)` (the owner
 * preview at any status) and restored via `PiecesService.update` — this module
 * never reimplements the piece content lifecycle.
 *
 * **B7 (docs/45 §4.12) clamps the three READS and none of the writes.** How deep the
 * history goes is the story OWNER's plan ({@link SnapshotHistoryService}), applied in
 * {@link list}, {@link get} and {@link revert}. {@link create}, {@link capture} and the
 * private `write` below are deliberately outside it — see the note on `write`.
 */
@Injectable()
export class SnapshotService {
  constructor(
    private readonly pieces: PiecesService,
    private readonly engine: PolicyEngineService,
    private readonly audit: AuditService,
    private readonly repo: PublishingRepository,
    private readonly history: SnapshotHistoryService,
  ) {}

  /**
   * Captures the current story content as the next version. Authorized through
   * the Policy Engine (publish-level authority). When called on the publish path
   * the actor was already asserted, so this is a cache hit; when called from the
   * manual-snapshot route it is the real per-story authorization.
   */
  async create(
    storyId: string,
    actor: AuthenticatedUser,
    reason: SnapshotReason,
  ): Promise<SnapshotDto> {
    const ctx = await this.requireContext(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.PublicationPublish,
      resource: buildStoryResource(storyId, ctx, PolicyResourceType.Publication),
    });
    return this.write(storyId, ctx, actor, reason);
  }

  /**
   * Captures the current content as the next version WITHOUT authorizing — for a
   * caller that has already asserted its own action on this story and must not be
   * put through a second, unrelated one (`publication.publish`). Collaboration
   * uses this when accepting an edit suggestion: `suggestion.resolve` is the
   * decision that gates the write, so re-asserting publish authority here would
   * deny a co-author who may legitimately accept but not publish.
   *
   * Callers own authorization. {@link create} is the authorizing entry point.
   */
  async capture(
    storyId: string,
    actor: AuthenticatedUser,
    reason: SnapshotReason,
  ): Promise<SnapshotDto> {
    return this.write(storyId, await this.requireContext(storyId), actor, reason);
  }

  /**
   * The single write path for every snapshot, from every caller.
   *
   * **It has no plan check and must never acquire one (B7, docs/45 §4.12).** Version-history depth
   * is a READ-time clamp: an author at their limit still gets new versions and simply cannot see
   * the oldest, and upgrading brings those back because nothing is deleted. Gating capture instead
   * would break more than the snapshot button — `SuggestionService.accept` calls {@link capture}
   * inside the transaction that settles a suggestion (`f6827e0`), so a refusal here would make
   * **accepting a suggestion fail** for a free author. A monetization limit would have become a
   * correctness bug in the collaboration flow. `snapshot.service.spec.ts` fails if this changes.
   */
  private async write(
    storyId: string,
    ctx: StoryContext,
    actor: AuthenticatedUser,
    reason: SnapshotReason,
  ): Promise<SnapshotDto> {
    const piece = await this.pieces.preview(storyId, ctx.authorId);
    const version = await this.repo.nextSnapshotVersion(storyId);

    const snapshot = await this.repo.createSnapshot({
      storyId,
      version,
      title: piece.title,
      content: piece.content,
      wordCount: piece.wordCount,
      reason,
      createdById: actor.id,
    });

    await this.repo.pruneSnapshots(storyId, MAX_SNAPSHOTS_PER_STORY);
    await this.repo.recordEvent({
      storyId,
      actorId: actor.id,
      type: 'snapshot_created',
      metadata: { snapshotId: snapshot.id, version, reason },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: PUBLISHING_AUDIT_ACTIONS.SnapshotCreated,
      targetType: PUBLISHING_AUDIT_TARGET.Snapshot,
      targetId: snapshot.id,
      metadata: { storyId, version, reason },
    });
    return toSnapshotDto(snapshot);
  }

  /**
   * A story's version history, newest first — clamped to what the OWNER's plan shows, with the
   * TRUE total alongside it (B7). Per-story read authorization first, as before.
   *
   * The total rides with the clamped list because a client that can only see five rows cannot tell
   * a five-version story from a thirty-two-version one, and would have to say "5 versions" — which
   * is false — instead of "5 of 32". Hiding the count makes the upsell dishonest and the hidden
   * versions invisible.
   */
  async list(storyId: string, actor: AuthenticatedUser): Promise<SnapshotHistoryDto> {
    const ctx = await this.requireContext(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.StoryView,
      resource: buildStoryResource(storyId, ctx, PolicyResourceType.Story),
    });
    // `ctx.authorId`, not `actor.id`: a collaborator reads the history the story's owner pays for.
    const window = await this.history.window(storyId, ctx.authorId);
    const rows = await this.repo.listSnapshots(
      storyId,
      window.unlimited ? undefined : window.limit,
    );
    return {
      items: rows.map(toSnapshotDto),
      total: window.total,
      visible: rows.length,
      hidden: window.hidden,
      limit: window.limit,
      unlimited: window.unlimited,
    };
  }

  /**
   * One snapshot by id (404 if absent). Authorized against its owning story, then checked against
   * that story owner's history depth — a version outside the window is refused, not returned.
   *
   * Without this, clamping the list would only hide the ids; anyone who kept one could still read
   * the body straight out of the hidden history.
   */
  async get(id: string, actor: AuthenticatedUser): Promise<SnapshotDto> {
    const snapshot = await this.repo.findSnapshotById(id);
    if (snapshot === null) {
      throw new SnapshotNotFoundException();
    }
    const ctx = await this.requireContext(snapshot.storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.StoryView,
      resource: buildStoryResource(snapshot.storyId, ctx, PolicyResourceType.Story),
    });
    await this.history.assertVisible(snapshot.storyId, ctx.authorId, snapshot.version);
    return toSnapshotDto(snapshot);
  }

  /**
   * Restores a snapshot's content onto the live piece.
   *
   * **Also gated on the owner's history depth (B7).** Reverting is the reason a version history
   * exists, so it is precisely the door someone holding an old id would try — clamping only the
   * list view would leave it open, which is the unenforced-gate shape docs/48 §5.2 catalogues.
   */
  async revert(
    storyId: string,
    snapshotId: string,
    actor: AuthenticatedUser,
  ): Promise<PieceResponseDto> {
    const ctx = await this.requireContext(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.PublicationPublish,
      resource: buildStoryResource(storyId, ctx, PolicyResourceType.Publication),
    });

    const snapshot = await this.repo.findSnapshotById(snapshotId);
    if (snapshot === null || snapshot.storyId !== storyId) {
      throw new SnapshotNotFoundException();
    }
    await this.history.assertVisible(storyId, ctx.authorId, snapshot.version);

    const result = await this.pieces.update(storyId, ctx.authorId, { content: snapshot.content });
    await this.repo.recordEvent({
      storyId,
      actorId: actor.id,
      type: 'reverted',
      metadata: { snapshotId, version: snapshot.version },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: PUBLISHING_AUDIT_ACTIONS.Reverted,
      targetType: PUBLISHING_AUDIT_TARGET.Story,
      targetId: storyId,
      metadata: { snapshotId, version: snapshot.version },
    });
    return result;
  }

  private async requireContext(storyId: string): Promise<StoryContext> {
    const ctx = await this.pieces.getStoryContext(storyId);
    if (ctx === null) {
      throw new PieceNotFoundException();
    }
    return ctx;
  }
}

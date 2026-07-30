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
import type { SnapshotDto } from './dto/publishing-response.dto';
import { PUBLISHING_AUDIT_ACTIONS, PUBLISHING_AUDIT_TARGET } from './publishing.constants';
import { SnapshotNotFoundException } from './publishing.exceptions';
import { PublishingRepository } from './publishing.repository';
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
 */
@Injectable()
export class SnapshotService {
  constructor(
    private readonly pieces: PiecesService,
    private readonly engine: PolicyEngineService,
    private readonly audit: AuditService,
    private readonly repo: PublishingRepository,
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

  /** All snapshots for a story, newest version first. Per-story read authorization. */
  async list(storyId: string, actor: AuthenticatedUser): Promise<SnapshotDto[]> {
    const ctx = await this.requireContext(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.StoryView,
      resource: buildStoryResource(storyId, ctx, PolicyResourceType.Story),
    });
    const rows = await this.repo.listSnapshots(storyId);
    return rows.map(toSnapshotDto);
  }

  /** One snapshot by id (404 if absent). Authorized against its owning story. */
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
    return toSnapshotDto(snapshot);
  }

  /** Restores a snapshot's content onto the live piece. */
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

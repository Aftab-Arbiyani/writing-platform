import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ReviewState } from '@qalam/shared';
import type { PublicationEvent as PublicationEventType, SnapshotReason } from '@qalam/shared';
import { Repository } from 'typeorm';

import { PublicationEvent } from './entities/publication-event.entity';
import { ReviewSession } from './entities/review-session.entity';
import { StorySnapshot } from './entities/story-snapshot.entity';

/** A story is review-gated while an OPEN (not-yet-closed) session exists. */
const CLOSED_REVIEW_STATES: readonly ReviewState[] = [ReviewState.Approved, ReviewState.Published];

/** Snapshot reasons that are never pruned (kept for the permanent record). */
const KEEP_FOREVER_REASONS: readonly SnapshotReason[] = ['publish', 'review'];

/** A new review session (id/timestamps assigned by the entity). */
export interface NewReviewSession {
  storyId: string;
  requestedById: string;
  state: ReviewState;
  reviewerId: string | null;
  decision: null;
  notes: string | null;
  submittedAt: Date;
  decidedAt: Date | null;
}

/** A new story snapshot (id/created_at assigned by the entity). */
export interface NewSnapshot {
  storyId: string;
  version: number;
  title: string;
  content: Record<string, unknown>;
  wordCount: number;
  reason: SnapshotReason;
  createdById: string;
}

/** A new publication-history event. */
export interface NewPublicationEvent {
  storyId: string;
  actorId: string;
  type: PublicationEventType;
  metadata?: Record<string, unknown>;
}

/**
 * Data access for the publishing tables (docs 16 §3.3 — only the repository
 * touches query builders). Every read is `story_id`-scoped; reviews and history
 * order newest-first, snapshots by version.
 */
@Injectable()
export class PublishingRepository {
  constructor(
    @InjectRepository(ReviewSession)
    private readonly reviews: Repository<ReviewSession>,
    @InjectRepository(StorySnapshot)
    private readonly snapshots: Repository<StorySnapshot>,
    @InjectRepository(PublicationEvent)
    private readonly events: Repository<PublicationEvent>,
  ) {}

  // ── Review sessions ─────────────────────────────────────────────────────────

  /** Persists a new review session. */
  createReviewSession(input: NewReviewSession): Promise<ReviewSession> {
    return this.reviews.save(this.reviews.create(input));
  }

  /** Persists an updated review session (state transition). */
  saveReviewSession(session: ReviewSession): Promise<ReviewSession> {
    return this.reviews.save(session);
  }

  /** The most recent review session for a story, or null. */
  findCurrentSession(storyId: string): Promise<ReviewSession | null> {
    return this.reviews
      .createQueryBuilder('r')
      .where('r.story_id = :storyId', { storyId })
      .orderBy('r.created_at', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .getOne();
  }

  /**
   * The OPEN review session (state not in approved/published) for a story, or
   * null — the story's review gate. Its presence means the story is
   * review-gated and not yet cleared to publish.
   */
  findOpenSession(storyId: string): Promise<ReviewSession | null> {
    return this.reviews
      .createQueryBuilder('r')
      .where('r.story_id = :storyId', { storyId })
      .andWhere('r.state NOT IN (:...closed)', { closed: [...CLOSED_REVIEW_STATES] })
      .orderBy('r.created_at', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .getOne();
  }

  // ── Snapshots ────────────────────────────────────────────────────────────────

  /** The next per-story snapshot version (1-based). */
  async nextSnapshotVersion(storyId: string): Promise<number> {
    const row = await this.snapshots
      .createQueryBuilder('s')
      .select('MAX(s.version)', 'max')
      .where('s.story_id = :storyId', { storyId })
      .getRawOne<{ max: string | null }>();
    const max = row?.max != null ? Number(row.max) : 0;
    return max + 1;
  }

  /** Persists a new snapshot. */
  createSnapshot(input: NewSnapshot): Promise<StorySnapshot> {
    return this.snapshots.save(this.snapshots.create(input));
  }

  /**
   * Snapshots for a story, newest version first — the whole history, or the `take` most recent.
   *
   * `take` is B7's read-time clamp (docs/45 §4.12) and is applied in SQL rather than by slicing the
   * result: a snapshot row carries the full story body, so fetching 100 to show 5 would read the
   * hidden versions into memory on every list. Nothing is deleted either way.
   */
  listSnapshots(storyId: string, take?: number): Promise<StorySnapshot[]> {
    const query = this.snapshots
      .createQueryBuilder('s')
      .where('s.story_id = :storyId', { storyId })
      .orderBy('s.version', 'DESC');
    return take === undefined ? query.getMany() : query.take(take).getMany();
  }

  /** How many snapshots a story actually has — the TRUE total, before any plan clamp. */
  countSnapshots(storyId: string): Promise<number> {
    return this.snapshots
      .createQueryBuilder('s')
      .where('s.story_id = :storyId', { storyId })
      .getCount();
  }

  /**
   * The `version` of the snapshot at `offset` counting back from the newest (0-based), or null if
   * the story has no snapshot that far back.
   *
   * This is the floor of B7's visible window, and it is read as a POSITION rather than computed as
   * `maxVersion - limit`: `pruneSnapshots` deletes older prunable rows while keeping pinned
   * `publish`/`review` ones, so versions have gaps and arithmetic on them would hide rows that are
   * inside the window and reveal rows that are outside it.
   */
  async snapshotVersionAtOffset(storyId: string, offset: number): Promise<number | null> {
    const row = await this.snapshots
      .createQueryBuilder('s')
      .select('s.version', 'version')
      .where('s.story_id = :storyId', { storyId })
      .orderBy('s.version', 'DESC')
      .offset(offset)
      .limit(1)
      .getRawOne<{ version: string | number }>();
    return row === undefined || row.version == null ? null : Number(row.version);
  }

  /** One snapshot by id, or null. */
  findSnapshotById(id: string): Promise<StorySnapshot | null> {
    return this.snapshots.createQueryBuilder('s').where('s.id = :id', { id }).getOne();
  }

  /**
   * Prunes the oldest prunable snapshots (reason not `publish`/`review`) once a
   * story exceeds {@link cap}. `publish`/`review` snapshots are kept forever, so
   * the retained count may stay above the cap when most snapshots are pinned.
   */
  async pruneSnapshots(storyId: string, cap: number): Promise<number> {
    const total = await this.snapshots
      .createQueryBuilder('s')
      .where('s.story_id = :storyId', { storyId })
      .getCount();
    const excess = total - cap;
    if (excess <= 0) {
      return 0;
    }
    const prunable = await this.snapshots
      .createQueryBuilder('s')
      .select('s.id', 'id')
      .where('s.story_id = :storyId', { storyId })
      .andWhere('s.reason NOT IN (:...keep)', { keep: [...KEEP_FOREVER_REASONS] })
      .orderBy('s.version', 'ASC')
      .limit(excess)
      .getRawMany<{ id: string }>();
    if (prunable.length === 0) {
      return 0;
    }
    await this.snapshots.delete(prunable.map((p) => p.id));
    return prunable.length;
  }

  // ── Publication history ────────────────────────────────────────────────────

  /** Appends one publishing-history event. */
  recordEvent(input: NewPublicationEvent): Promise<PublicationEvent> {
    return this.events.save(
      this.events.create({
        storyId: input.storyId,
        actorId: input.actorId,
        type: input.type,
        metadata: input.metadata ?? {},
      }),
    );
  }

  /** A story's publishing history, newest first. */
  listEvents(storyId: string): Promise<PublicationEvent[]> {
    return this.events
      .createQueryBuilder('e')
      .where('e.story_id = :storyId', { storyId })
      .orderBy('e.created_at', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .getMany();
  }
}

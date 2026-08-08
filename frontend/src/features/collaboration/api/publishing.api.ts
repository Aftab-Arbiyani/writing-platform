import type { Visibility } from '@qalam/shared';

import { get, patch, post } from '@/lib/api-client';

import type {
  PublicationHistoryEvent,
  ReviewSession,
  StoryPublicationState,
  StorySnapshot,
  StorySnapshotHistory,
} from '../types/collaboration.types';

/**
 * The publishing feature's `api/` layer (AF6, W3c — docs/49 §5) — the only place the editorial
 * publish/review/snapshot routes are named (docs/32 §10). A "story" IS a piece
 * (`storyId === pieceId`).
 *
 * Every shape here is pinned to `publishing.controller.ts` + `publishing-{request,response}.dto.ts`
 * and cross-checked against the repaired mobile client, which paid for four of them:
 *
 * 1. **Five calls answer `PieceResponseDto`**, not an event or a snapshot row (P-1).
 * 2. **`schedule` takes `scheduledAt`**, not `scheduledFor`, and rejects anything else (P-2).
 * 3. **Four handlers declare no `@Body()`** — publish, unpublish, requestReview, createSnapshot —
 *    so a body sent to them is discarded in silence rather than refused (P-8). Sending none is the
 *    only way to know the server agreed with you.
 * 4. **`GET /stories/:id/review` answers `data: null`** for a story that has never been submitted.
 *    That is the Draft state, not an error (P-4) — see {@link review}.
 */
const story = (id: string): string => `/stories/${encodeURIComponent(id)}`;

export const publishingApi = {
  // ── Publication lifecycle ────────────────────────────────────────────────────────────────

  /**
   * POST /stories/:id/publish — no body.
   *
   * The handler declares no `@Body()`, so the `{visibility, note}` mobile used to send never
   * reached the server: the writer's chosen visibility was silently dropped (P-8). Visibility is
   * its own call ({@link changeVisibility}).
   *
   * Blocked with `PUBLICATION_NOT_APPROVED` while an open, non-approved review session exists — a
   * named UI state, not a generic failure.
   */
  publish: (storyId: string): Promise<StoryPublicationState> =>
    post<StoryPublicationState>(`${story(storyId)}/publish`),

  /** POST /stories/:id/unpublish — archives a published story. No body, same reason as publish. */
  unpublish: (storyId: string): Promise<StoryPublicationState> =>
    post<StoryPublicationState>(`${story(storyId)}/unpublish`),

  /**
   * POST /stories/:id/schedule — `{scheduledAt}`, an ISO-8601 instant.
   *
   * The key is `scheduledAt` (`@IsDateString()`). Mobile sent `scheduledFor` plus a `visibility`
   * the DTO does not declare, so under `forbidNonWhitelisted` every schedule 400'd on two extra
   * keys *and* a missing required one (P-2). A past instant is refused downstream with
   * `PIECE_SCHEDULE_IN_PAST`.
   */
  schedule: (storyId: string, scheduledAt: string): Promise<StoryPublicationState> =>
    post<StoryPublicationState>(`${story(storyId)}/schedule`, { scheduledAt }),

  /**
   * PATCH /stories/:id/visibility — `{visibility}`.
   *
   * `Visibility` is `public | unlisted | private`. There is **no** `followers` value; mobile
   * offered one and every tap on it returned `400 VALIDATION_FAILED` (P-3). Followers-only is a
   * profile privacy setting, not a piece visibility.
   */
  changeVisibility: (storyId: string, visibility: Visibility): Promise<StoryPublicationState> =>
    patch<StoryPublicationState>(`${story(storyId)}/visibility`, { visibility }),

  /** GET /stories/:id/publication-history — the immutable audit trail, newest first. */
  history: (storyId: string, signal?: AbortSignal): Promise<PublicationHistoryEvent[]> =>
    get<PublicationHistoryEvent[]>(`${story(storyId)}/publication-history`, { signal }),

  // ── Review workflow ──────────────────────────────────────────────────────────────────────

  /**
   * GET /stories/:id/review — the current session, or **null** when the story has never been
   * submitted.
   *
   * The route is typed `Promise<ReviewDto | null>` and answers a 200 carrying `{data: null}`. That
   * is the **Draft** state of every story before the flow starts, so it must not read as an error;
   * mobile's client threw `API_MALFORMED_RESPONSE` on it and surfaced the default state of every
   * story as a failure (P-4).
   *
   * Web's `api-client` passes `data` through untouched, so no client change is needed here — the
   * fix is to stop lying in the type. Declaring the null explicitly is what forces every consumer
   * to handle Draft, and `use-review.spec` pins it.
   */
  review: (storyId: string, signal?: AbortSignal): Promise<ReviewSession | null> =>
    get<ReviewSession | null>(`${story(storyId)}/review`, { signal }),

  /**
   * POST /stories/:id/review — request an editorial review. No body.
   *
   * The handler declares no `@Body()`; the `reviewerId` mobile sent was discarded without error
   * (P-8). Reviewer assignment is not part of the contract — the reviewer is whoever approves.
   */
  requestReview: (storyId: string): Promise<ReviewSession> =>
    post<ReviewSession>(`${story(storyId)}/review`),

  /** POST /stories/:id/review/approve — unlocks publish. No body. */
  approveReview: (storyId: string): Promise<ReviewSession> =>
    post<ReviewSession>(`${story(storyId)}/review/approve`),

  /**
   * POST /stories/:id/review/changes — bounce back to the author with optional `{notes}`.
   *
   * The key is `notes` (plural — `RequestChangesDto`). Mobile sent `note`, which passed only
   * because no caller ever set it (P-5).
   */
  requestChanges: (storyId: string, notes?: string): Promise<ReviewSession> =>
    post<ReviewSession>(`${story(storyId)}/review/changes`, notes ? { notes } : undefined),

  // ── Snapshots ────────────────────────────────────────────────────────────────────────────

  /**
   * GET /stories/:id/snapshots — the versions the story OWNER's plan shows, newest first, with the
   * TRUE total alongside them (B7, docs/45 §4.12).
   *
   * It answers an object, not an array. The clamp is invisible without `total`: five rows out of
   * thirty-two look exactly like five rows out of five, so a client reading only the array would
   * report "5 versions" — false — instead of "5 of 32".
   */
  snapshots: (storyId: string, signal?: AbortSignal): Promise<StorySnapshotHistory> =>
    get<StorySnapshotHistory>(`${story(storyId)}/snapshots`, { signal }),

  /**
   * POST /stories/:id/snapshots — capture the current content. No body.
   *
   * The handler hard-codes `SnapshotReason.Manual` and declares no `@Body()`, so the `label` mobile
   * sent was discarded (P-7/P-8). A version is identified by its `version` number and its `reason`,
   * never by a label the client invented.
   */
  createSnapshot: (storyId: string): Promise<StorySnapshot> =>
    post<StorySnapshot>(`${story(storyId)}/snapshots`),

  /** GET /snapshots/:id — one version, addressed by the SNAPSHOT's id. */
  snapshot: (snapshotId: string, signal?: AbortSignal): Promise<StorySnapshot> =>
    get<StorySnapshot>(`/snapshots/${encodeURIComponent(snapshotId)}`, { signal }),

  /**
   * POST /stories/:id/snapshots/:sid/revert — restore a version onto the live piece.
   *
   * Answers the **piece** in its reverted state, not the snapshot. Mobile decoded it as a snapshot,
   * producing one whose `id` was the piece id — which would then 404 against `GET /snapshots/:id`
   * (P-1).
   */
  revert: (storyId: string, snapshotId: string): Promise<StoryPublicationState> =>
    post<StoryPublicationState>(
      `${story(storyId)}/snapshots/${encodeURIComponent(snapshotId)}/revert`,
    ),
};

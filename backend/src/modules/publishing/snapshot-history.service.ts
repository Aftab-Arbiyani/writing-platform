import { Injectable } from '@nestjs/common';
import { resolvePlanLimit } from '@qalam/shared';

import { EntitlementService } from '../monetization/entitlement.service';
import { SnapshotHistoryLimitedException } from '../monetization/monetization.exceptions';
import { PublishingRepository } from './publishing.repository';

/**
 * The `PlanLimits` key B7 clamps version history with.
 *
 * **Ordinary sentinel: `0` = unlimited.** B6's `maxCollaborators` is the one key in this codebase
 * that inverts (-1 unlimited, 0 none) and it inverts only because Free needs *zero* seats. B7's
 * Free tier is five versions, not zero, so there is nothing for an inverted sentinel to express and
 * this key stays on the house convention — which is what keeps the exception list at one entry.
 * Reading it through `resolvePlanLimit` is what applies the right convention either way.
 */
export const MAX_SNAPSHOT_HISTORY_LIMIT_KEY = 'maxSnapshotHistory';

/** The window of versions a story owner's plan makes visible, plus the true totals behind it. */
export interface SnapshotWindow {
  /** The owner's configured depth, as stored (`0` = unlimited). */
  limit: number;
  unlimited: boolean;
  /** Every version stored for the story — including the ones outside the window. */
  total: number;
  /** How many the plan shows. */
  visible: number;
  /** Stored but not shown. Never deleted. */
  hidden: number;
  /**
   * The oldest version inside the window, or null when nothing is hidden. A version BELOW this is
   * refused; a version at or above it is readable.
   */
  cutoffVersion: number | null;
}

/**
 * B7's version-history depth (docs/45 §4.12) — how many story versions the OWNER's plan makes
 * visible. Free 5 · Plus 25 · Pro/Enterprise unlimited.
 *
 * ## Read time only. Capture is never gated, by anything, ever
 *
 * This service is reachable from `list`, `get` and `revert` and from nowhere else. `SnapshotService`
 * captures through a private `write()` that this file cannot see, and that is deliberate: D1's
 * accept-a-suggestion path takes a `pre_edit` snapshot INSIDE the transaction that settles the
 * suggestion (`f6827e0`), so a plan check on the write would make **accepting a suggestion fail**
 * for a free author — a monetization limit silently turning into a correctness bug in the
 * collaboration flow. An author at their limit keeps getting new versions; they only stop seeing the
 * oldest, and they get them all back by upgrading because nothing was deleted.
 *
 * ## Three doors, one decision
 *
 * Clamping the list alone would leave `GET /snapshots/:id` and revert open to anyone still holding
 * an old id — the unenforced-gate shape docs/48 §5.2 catalogues seven instances of. Revert is the
 * one that matters most: it is the whole reason a version history exists, so it is exactly the door
 * someone would try. All three resolve the same window from the same place.
 *
 * ## The plan is the OWNER's, never the actor's
 *
 * A collaborator reading a Free author's history sees five versions no matter what they pay
 * themselves, and a Free collaborator on a Pro story sees everything. Every method therefore takes
 * `ownerId` explicitly (the caller resolves it from `StoryContext.authorId`) rather than an
 * `AuthenticatedUser`, so passing the actor by accident is not possible without renaming the
 * argument. B6 named this its likeliest bug and the same trap is here.
 */
@Injectable()
export class SnapshotHistoryService {
  constructor(
    private readonly repo: PublishingRepository,
    // AF5's Entitlement Service, resolved from the @Global MonetizationModule — the same edge B4
    // and B6 use, so the clamp needs no new module import.
    private readonly entitlements: EntitlementService,
  ) {}

  /** The visible window for one story, resolved from the plan of the author who owns it. */
  async window(storyId: string, ownerId: string): Promise<SnapshotWindow> {
    const [limits, total] = await Promise.all([
      this.entitlements.getLimits(ownerId),
      this.repo.countSnapshots(storyId),
    ]);
    const { value: limit, unlimited } = resolvePlanLimit(limits, MAX_SNAPSHOT_HISTORY_LIMIT_KEY);

    if (unlimited || total <= limit) {
      return { limit, unlimited, total, visible: total, hidden: 0, cutoffVersion: null };
    }
    // The floor is read as a position, not computed from `total` or a max version: pruning leaves
    // gaps in the version sequence (docs — `pruneSnapshots` keeps publish/review rows forever).
    const cutoffVersion = await this.repo.snapshotVersionAtOffset(storyId, limit - 1);
    return {
      limit,
      unlimited,
      total,
      visible: limit,
      hidden: total - limit,
      cutoffVersion,
    };
  }

  /**
   * Refuses a version the owner's plan does not show — the gate on `GET /snapshots/:id` and on
   * revert, with an upgrade sentence rather than an error.
   *
   * Takes the version rather than the row so it cannot be handed a snapshot from another story.
   */
  async assertVisible(storyId: string, ownerId: string, version: number): Promise<void> {
    const window = await this.window(storyId, ownerId);
    if (window.cutoffVersion !== null && version < window.cutoffVersion) {
      throw new SnapshotHistoryLimitedException(version, window.limit);
    }
  }
}

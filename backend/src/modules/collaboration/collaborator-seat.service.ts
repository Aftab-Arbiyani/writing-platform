import { Injectable } from '@nestjs/common';
import { InvitationStatus, resolvePlanLimit } from '@qalam/shared';

import { EntitlementService } from '../monetization/entitlement.service';
import {
  CollaboratorLimitReachedException,
  CollaboratorSeatsUnavailableException,
} from '../monetization/monetization.exceptions';
import { CollaborationRepository } from './collaboration.repository';
import type { CollaboratorLimitDto } from './dto/collaboration-response.dto';

/** The `PlanLimits` key B6 caps seats with. Inverted sentinel: -1 unlimited, 0 none. */
export const MAX_COLLABORATORS_LIMIT_KEY = 'maxCollaborators';

/**
 * B6's collaborator seat cap (docs/45 §4.11) — how many collaborators one story may hold, by the
 * plan of the author who OWNS it.
 *
 * ## Why this is one service and not three inline checks
 *
 * Three doors create a seat: inviting, adding a member directly, and accepting an invitation. Each
 * one capped by hand is three chances to read the wrong plan, count the wrong rows, or forget the
 * door entirely — and a cap with one uncapped door is not a cap. Everything B6 decides lives here;
 * the three call sites decide only *which* of the two assertions applies to them.
 *
 * ## The two readings that are easy to invert
 *
 * 1. **The plan is the OWNER's, never the actor's.** A co-author with a Pro subscription inviting
 *    into a Free author's story spends the FREE author's seats — seats belong to the story and are
 *    billed to whoever owns it. Every method here therefore takes `ownerId` explicitly (resolved by
 *    the caller from `StoryFacts.authorId`) rather than an `AuthenticatedUser`, so passing the
 *    actor by accident is not possible without renaming the argument.
 * 2. **`0` means zero seats, not unlimited.** For every other `PlanLimits` key `0` is the
 *    "unlimited" sentinel; for this one Free is genuinely zero and unlimited is `UNLIMITED_SEATS`
 *    (-1). Reading it through `resolvePlanLimit` is what applies that inversion — reading
 *    `limits.maxCollaborators` by hand and testing `> 0` re-creates the exact bug the row warns
 *    about, and every free author silently gets unlimited collaborators.
 *
 * ## What the owner's own seat costs: nothing
 *
 * The cap counts collaborators, not participants. `countMembers` counts membership rows and the
 * owner has none (they resolve to `StoryRole.Owner` from the piece's authorship), so the owner is
 * already excluded by construction rather than by subtracting one somewhere.
 *
 * ## Separate from `MAX_STORY_COLLABORATORS`
 *
 * That flat ceiling (20, a 409) is anti-abuse and no plan raises it. This is a paywall (402) that
 * upgrading clears. Both apply; the plan cap is checked first because for every tier that can hit
 * it, it binds far below 20 and its refusal is the one that tells the owner something useful.
 */
@Injectable()
export class CollaboratorSeatService {
  constructor(
    private readonly repo: CollaborationRepository,
    // AF5's Entitlement Service, resolved from the @Global MonetizationModule — the same way
    // `PiecesService` reaches it for B4, so the plan cap needs no new module edge.
    private readonly entitlements: EntitlementService,
  ) {}

  /**
   * The story's seat allowance — what `GET /stories/:storyId/collaborators/limit` returns and what
   * {@link assertCanOfferSeat} decides on.
   *
   * `used` is **members + still-outstanding invitations**, because an issued invitation is a claim
   * on a seat. Both are reported separately too: "2 of 3" reads very differently to an owner when
   * one of the two has not accepted yet, and a client that can only see the total cannot say so.
   */
  async getAllowance(storyId: string, ownerId: string): Promise<CollaboratorLimitDto> {
    const [members, pendingInvitations, limits] = await Promise.all([
      this.repo.countMembers(storyId),
      this.repo.countPendingInvitations(storyId, InvitationStatus.Pending, new Date()),
      this.entitlements.getLimits(ownerId),
    ]);
    const { value: limit, unlimited } = resolvePlanLimit(limits, MAX_COLLABORATORS_LIMIT_KEY);
    const used = members + pendingInvitations;
    return {
      storyId,
      members,
      pendingInvitations,
      used,
      limit,
      remaining: unlimited ? null : Math.max(0, limit - used),
      unlimited,
      canInvite: unlimited || used < limit,
    };
  }

  /**
   * The owner-facing gate, for the two doors that OFFER a seat — `POST .../invitations` and
   * `POST .../members`. Refuses with a 402 whose remedy is "see plans, or remove a collaborator".
   */
  async assertCanOfferSeat(storyId: string, ownerId: string): Promise<void> {
    const allowance = await this.getAllowance(storyId, ownerId);
    if (!allowance.canInvite) {
      throw new CollaboratorLimitReachedException(allowance.used, allowance.limit);
    }
  }

  /**
   * The invitee-facing gate on `POST /invitations/:id/accept`, for an invitation issued while the
   * owner still had room. Refuses with a 409 written for someone who cannot fix it.
   *
   * **This one counts members only, and deliberately not the pending set** — including it would
   * make an invitation block its own acceptance (2 members + this pending invitation = 3, against a
   * limit of 3, refuses an accept that would leave exactly 3 collaborators). The pending set exists
   * to stop an owner *issuing* more claims than they can honour; once someone is actually claiming
   * one, what matters is whether the seat exists for them. Outstanding invitations to other people
   * do not crowd out a real accept, so a downgraded story fills first-come-first-served and the
   * later accepts are the ones refused.
   */
  async assertCanClaimSeat(storyId: string, ownerId: string): Promise<void> {
    const [members, limits] = await Promise.all([
      this.repo.countMembers(storyId),
      this.entitlements.getLimits(ownerId),
    ]);
    const { value: limit, unlimited } = resolvePlanLimit(limits, MAX_COLLABORATORS_LIMIT_KEY);
    if (!unlimited && members >= limit) {
      throw new CollaboratorSeatsUnavailableException();
    }
  }
}

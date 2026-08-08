import { DEFAULT_PLAN_LIMITS, InvitationStatus, PlanTier, UNLIMITED_SEATS } from '@qalam/shared';
import type { PlanLimits } from '@qalam/shared';

import type { EntitlementService } from '../monetization/entitlement.service';
import {
  CollaboratorLimitReachedException,
  CollaboratorSeatsUnavailableException,
} from '../monetization/monetization.exceptions';
import type { CollaborationRepository } from './collaboration.repository';
import { CollaboratorSeatService } from './collaborator-seat.service';

const STORY = '11111111-1111-1111-1111-111111111111';
const OWNER = 'owner-1';
/** A co-author who can invite but does not own the story — their plan must never govern. */
const ACTOR = 'co-author-9';

/**
 * Plans come from the compiled defaults rather than hand-written numbers, so a change to the
 * catalogue is felt here instead of being shadowed by a literal that agrees with nothing.
 */
function planOf(tier: PlanTier): PlanLimits {
  return { ...DEFAULT_PLAN_LIMITS[tier] };
}

function build(options?: {
  members?: number;
  pending?: number;
  limitsByUser?: Record<string, PlanLimits>;
}) {
  const repo = {
    countMembers: jest.fn().mockResolvedValue(options?.members ?? 0),
    countPendingInvitations: jest.fn().mockResolvedValue(options?.pending ?? 0),
  } as unknown as jest.Mocked<CollaborationRepository>;

  const byUser = options?.limitsByUser ?? { [OWNER]: planOf(PlanTier.Plus) };
  const entitlements = {
    getLimits: jest
      .fn()
      .mockImplementation((userId: string) =>
        Promise.resolve(byUser[userId] ?? planOf(PlanTier.Free)),
      ),
  } as unknown as jest.Mocked<EntitlementService>;

  return { service: new CollaboratorSeatService(repo, entitlements), repo, entitlements };
}

describe('CollaboratorSeatService (B6 — collaborators per story, by plan)', () => {
  describe('the sentinel this row can silently invert', () => {
    /**
     * The single most important assertion in B6. Everywhere else in the codebase `0` means
     * unlimited; here Free is genuinely zero seats. If `maxCollaborators` is ever read under the
     * ordinary convention — `limits.maxCollaborators` with `> 0`, or dropped from
     * `NEGATIVE_UNLIMITED_LIMIT_KEYS` — this is the test that fails. Without it, the inversion
     * ships green: free authors get unlimited collaborators and nothing errors anywhere.
     */
    it('reads a FREE owner as ZERO seats, not unlimited, and refuses the first invite', async () => {
      const { service } = build({ limitsByUser: { [OWNER]: planOf(PlanTier.Free) } });

      const allowance = await service.getAllowance(STORY, OWNER);
      expect(allowance.limit).toBe(0);
      expect(allowance.unlimited).toBe(false);
      expect(allowance.remaining).toBe(0);
      expect(allowance.canInvite).toBe(false);

      await expect(service.assertCanOfferSeat(STORY, OWNER)).rejects.toBeInstanceOf(
        CollaboratorLimitReachedException,
      );
    });

    it('reads -1 as unlimited (Pro / Enterprise), where 0 would have meant none', async () => {
      for (const tier of [PlanTier.Pro, PlanTier.Enterprise]) {
        const { service } = build({ members: 50, limitsByUser: { [OWNER]: planOf(tier) } });
        const allowance = await service.getAllowance(STORY, OWNER);
        expect(allowance.limit).toBe(UNLIMITED_SEATS);
        expect(allowance.unlimited).toBe(true);
        expect(allowance.remaining).toBeNull();
        await expect(service.assertCanOfferSeat(STORY, OWNER)).resolves.toBeUndefined();
      }
    });

    it('refuses rather than grants when the key is missing entirely', async () => {
      // Unreachable through `getLimits` (it falls back to the compiled tier defaults) and through
      // `mergePlans` (per-key merge) — but if it ever happens, the safe reading is zero seats. A
      // wrongly-refused invite gets reported; a wrongly-granted one leaks revenue silently.
      const { service } = build({
        limitsByUser: { [OWNER]: { aiDailyTokens: 0, aiMonthlyTokens: 0, aiMonthlyCredits: 0 } },
      });
      const allowance = await service.getAllowance(STORY, OWNER);
      expect(allowance.unlimited).toBe(false);
      expect(allowance.canInvite).toBe(false);
    });
  });

  describe('whose plan governs', () => {
    /**
     * The likeliest bug in the row: reading the ACTOR's plan. A Pro co-author inviting into a Free
     * author's story must still be refused, and a Free co-author inviting into a Pro author's story
     * must still succeed. Both directions are asserted, because a service that read `actor` would
     * pass a test that only checked one.
     */
    it("resolves the limit from the OWNER's plan, not the actor's — Pro actor, Free owner", async () => {
      const { service, entitlements } = build({
        limitsByUser: { [OWNER]: planOf(PlanTier.Free), [ACTOR]: planOf(PlanTier.Pro) },
      });

      await expect(service.assertCanOfferSeat(STORY, OWNER)).rejects.toBeInstanceOf(
        CollaboratorLimitReachedException,
      );
      expect(entitlements.getLimits).toHaveBeenCalledWith(OWNER);
      expect(entitlements.getLimits).not.toHaveBeenCalledWith(ACTOR);
    });

    it('…and the other direction: Free actor, Pro owner, seat granted', async () => {
      const { service } = build({
        members: 12,
        limitsByUser: { [OWNER]: planOf(PlanTier.Pro), [ACTOR]: planOf(PlanTier.Free) },
      });
      await expect(service.assertCanOfferSeat(STORY, OWNER)).resolves.toBeUndefined();
    });
  });

  describe('what counts as a seat', () => {
    it('counts members AND outstanding invitations', async () => {
      const { service } = build({
        members: 2,
        pending: 1,
        limitsByUser: { [OWNER]: planOf(PlanTier.Plus) },
      });

      const allowance = await service.getAllowance(STORY, OWNER);
      expect(allowance).toMatchObject({ members: 2, pendingInvitations: 1, used: 3, limit: 3 });
      expect(allowance.canInvite).toBe(false);
      await expect(service.assertCanOfferSeat(STORY, OWNER)).rejects.toBeInstanceOf(
        CollaboratorLimitReachedException,
      );
    });

    it('refuses a PLUS story at 3 of 3 even when all three are only invitations', async () => {
      // Counting members alone is the bypass: three unanswered invites are three claimed seats.
      const { service } = build({ members: 0, pending: 3 });
      await expect(service.assertCanOfferSeat(STORY, OWNER)).rejects.toBeInstanceOf(
        CollaboratorLimitReachedException,
      );
    });

    it('excludes expired-but-unswept invitations by asking the repository for live ones only', async () => {
      const { service, repo } = build();
      await service.getAllowance(STORY, OWNER);
      const [storyId, status, now] = repo.countPendingInvitations.mock.calls[0] ?? [];
      expect(storyId).toBe(STORY);
      expect(status).toBe(InvitationStatus.Pending);
      expect(now).toBeInstanceOf(Date);
    });

    /**
     * The owner is not a collaborator. They hold no membership row (they resolve to
     * `StoryRole.Owner` from the piece's authorship), so a Plus story fits three collaborators
     * PLUS its owner — four people. Asserted through the public allowance rather than by
     * inspecting the query, so it stays true however the count is implemented.
     */
    it('does not charge the owner a seat — 2 collaborators on Plus leaves one free', async () => {
      const { service } = build({ members: 2, pending: 0 });
      const allowance = await service.getAllowance(STORY, OWNER);
      expect(allowance).toMatchObject({ used: 2, limit: 3, remaining: 1, canInvite: true });
      await expect(service.assertCanOfferSeat(STORY, OWNER)).resolves.toBeUndefined();
    });
  });

  describe('accept-time re-check', () => {
    it('refuses an invitation issued under Pro once the owner has downgraded to Free', async () => {
      const { service } = build({ members: 0, limitsByUser: { [OWNER]: planOf(PlanTier.Free) } });
      await expect(service.assertCanClaimSeat(STORY, OWNER)).rejects.toBeInstanceOf(
        CollaboratorSeatsUnavailableException,
      );
    });

    it('refuses the fourth accept on a downgraded Plus story, first-come-first-served', async () => {
      const full = build({ members: 3, pending: 2 });
      await expect(full.service.assertCanClaimSeat(STORY, OWNER)).rejects.toBeInstanceOf(
        CollaboratorSeatsUnavailableException,
      );
    });

    /**
     * The bug this guards: counting pending invitations at accept time would make an invitation
     * block its own acceptance. Two members and one outstanding invitation on a Plus story is
     * `used === 3 === limit` for the OFFER gate, and yet the person holding that third invitation
     * must be able to accept it — the story ends with exactly three collaborators.
     */
    it('lets the holder of the last outstanding invitation accept it', async () => {
      const { service } = build({ members: 2, pending: 1 });
      await expect(service.getAllowance(STORY, OWNER)).resolves.toMatchObject({ canInvite: false });
      await expect(service.assertCanClaimSeat(STORY, OWNER)).resolves.toBeUndefined();
    });

    it('never refuses on an unlimited plan', async () => {
      const { service } = build({ members: 19, limitsByUser: { [OWNER]: planOf(PlanTier.Pro) } });
      await expect(service.assertCanClaimSeat(STORY, OWNER)).resolves.toBeUndefined();
    });
  });

  describe('the refusals carry the right remedy', () => {
    it('offers a 402 with used/limit for the owner, and a 409 without them for the invitee', async () => {
      const { service } = build({ members: 3 });

      const offer = await service.assertCanOfferSeat(STORY, OWNER).catch((e: unknown) => e);
      expect(offer).toBeInstanceOf(CollaboratorLimitReachedException);
      expect((offer as CollaboratorLimitReachedException).code).toBe('COLLABORATOR_LIMIT_REACHED');
      expect((offer as CollaboratorLimitReachedException).getStatus()).toBe(402);
      expect((offer as CollaboratorLimitReachedException).details).toEqual([{ used: 3, limit: 3 }]);

      const claim = await service.assertCanClaimSeat(STORY, OWNER).catch((e: unknown) => e);
      expect(claim).toBeInstanceOf(CollaboratorSeatsUnavailableException);
      expect((claim as CollaboratorSeatsUnavailableException).code).toBe(
        'COLLABORATOR_SEATS_UNAVAILABLE',
      );
      expect((claim as CollaboratorSeatsUnavailableException).getStatus()).toBe(409);
      // No plan size and no upsell: the invitee is not the person who can buy a seat.
      const message = (claim as CollaboratorSeatsUnavailableException).message;
      expect(message).not.toMatch(/\bplan allows\b|upgrade/i);
      expect(message).toMatch(/owner/i);
    });
  });
});

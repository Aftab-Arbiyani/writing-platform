import { DEFAULT_PLAN_LIMITS, PlanTier } from '@qalam/shared';

import type { EntitlementService } from '../monetization/entitlement.service';
import { SnapshotHistoryLimitedException } from '../monetization/monetization.exceptions';
import type { PublishingRepository } from './publishing.repository';
import { SnapshotHistoryService } from './snapshot-history.service';

/**
 * B7's read-time clamp at the decision layer (docs/45 §4.12) — the window, and the two readings
 * that are easy to invert: whose plan governs, and what `0` means on this key.
 *
 * Nothing here asserts a shape; every case asserts what the service DECIDES, because a clamp that
 * is wired and computes the wrong window is the defect class this codebase keeps finding (R-1,
 * M5-1, W5-3, W8-1 — code that looked wired and was not).
 */

const STORY_ID = 'story-1';
const OWNER_ID = 'owner-1';

/** Versions with a gap, as `pruneSnapshots` really leaves them: 12, 11, 9, 6, 5, 3, 2, 1. */
const VERSIONS = [12, 11, 9, 6, 5, 3, 2, 1];

function build(tier: PlanTier, versions: readonly number[] = VERSIONS) {
  const getLimits = jest.fn().mockResolvedValue({ ...DEFAULT_PLAN_LIMITS[tier] });
  const countSnapshots = jest.fn().mockResolvedValue(versions.length);
  // The repository answers by POSITION, newest first — which is what the real query does.
  const snapshotVersionAtOffset = jest
    .fn()
    .mockImplementation((_: string, offset: number) => Promise.resolve(versions[offset] ?? null));

  const service = new SnapshotHistoryService(
    { countSnapshots, snapshotVersionAtOffset } as unknown as PublishingRepository,
    { getLimits } as unknown as EntitlementService,
  );
  return { service, getLimits, countSnapshots, snapshotVersionAtOffset };
}

describe('SnapshotHistoryService — the visible window', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows a free author the 5 most recent versions and reports the true total', async () => {
    const t = build(PlanTier.Free);

    const window = await t.service.window(STORY_ID, OWNER_ID);

    expect(window).toEqual({
      limit: 5,
      unlimited: false,
      total: 8,
      visible: 5,
      hidden: 3,
      // The 5th-newest version, read as a position — NOT `12 - 5`, which the gap would break.
      cutoffVersion: 5,
    });
  });

  it('shows a Plus author 25 — the whole history when it is shorter than the depth', async () => {
    const t = build(PlanTier.Plus);

    const window = await t.service.window(STORY_ID, OWNER_ID);

    expect(window).toMatchObject({ limit: 25, total: 8, visible: 8, hidden: 0 });
    // Nothing hidden means no floor, so no read can be refused.
    expect(window.cutoffVersion).toBeNull();
    expect(t.snapshotVersionAtOffset).not.toHaveBeenCalled();
  });

  it.each([PlanTier.Pro, PlanTier.Enterprise])(
    'reads `0` on %s as UNLIMITED — the ordinary sentinel, not B6’s -1',
    async (tier) => {
      const t = build(tier);

      const window = await t.service.window(STORY_ID, OWNER_ID);

      // If this key were ever added to NEGATIVE_UNLIMITED_LIMIT_KEYS, `0` would resolve to a hard
      // zero and these tiers would show NO versions at all — silently, with no error anywhere.
      expect(window.unlimited).toBe(true);
      expect(window.visible).toBe(8);
      expect(window.hidden).toBe(0);
      expect(window.cutoffVersion).toBeNull();
    },
  );

  it('resolves the limit from the OWNER’s plan, never the actor’s', async () => {
    const t = build(PlanTier.Free);

    await t.service.window(STORY_ID, OWNER_ID);

    // The one call that decides this row, asserted on its argument: a Pro collaborator reading a
    // Free author's history still gets five, and a Free collaborator on a Pro story gets all of it.
    expect(t.getLimits).toHaveBeenCalledTimes(1);
    expect(t.getLimits).toHaveBeenCalledWith(OWNER_ID);
  });

  it('restores the hidden versions retroactively when the plan grows — nothing was deleted', async () => {
    // Same story, same eight stored rows; only the owner's plan changes.
    const free = await build(PlanTier.Free).service.window(STORY_ID, OWNER_ID);
    const pro = await build(PlanTier.Pro).service.window(STORY_ID, OWNER_ID);

    expect(free.total).toBe(8);
    expect(free.visible).toBe(5);
    expect(pro.total).toBe(8);
    expect(pro.visible).toBe(8);
    expect(pro.hidden).toBe(0);
  });
});

describe('SnapshotHistoryService — assertVisible', () => {
  afterEach(() => jest.clearAllMocks());

  it('allows every version inside the window, including the oldest visible one', async () => {
    const t = build(PlanTier.Free);

    for (const version of [12, 11, 9, 6, 5]) {
      await expect(t.service.assertVisible(STORY_ID, OWNER_ID, version)).resolves.toBeUndefined();
    }
  });

  it('refuses a version below the floor, with the upgrade code and the numbers', async () => {
    const t = build(PlanTier.Free);

    await expect(t.service.assertVisible(STORY_ID, OWNER_ID, 3)).rejects.toBeInstanceOf(
      SnapshotHistoryLimitedException,
    );

    const error = (await t.service
      .assertVisible(STORY_ID, OWNER_ID, 3)
      .catch((e: unknown) => e)) as SnapshotHistoryLimitedException;
    expect(error).toMatchObject({
      code: 'SNAPSHOT_HISTORY_LIMITED',
      details: [{ version: 3, limit: 5 }],
    });
    // 402, not 404: the version is still there and the plan is what stands between it and the author.
    expect(error.getStatus()).toBe(402);
    // The remedy is an upgrade, not a wait and not a deletion (the W4 conflation, docs/48 §3.6).
    expect((error as Error).message).toContain('upgrade');
    expect((error as Error).message).not.toMatch(/wait|reset|delete|remove/i);
  });

  it('refuses nothing on an unlimited plan', async () => {
    const t = build(PlanTier.Pro);

    await expect(t.service.assertVisible(STORY_ID, OWNER_ID, 1)).resolves.toBeUndefined();
  });

  it('judges the version against the OWNER’s plan, not the reader’s', async () => {
    const t = build(PlanTier.Free);

    await expect(t.service.assertVisible(STORY_ID, OWNER_ID, 2)).rejects.toBeInstanceOf(
      SnapshotHistoryLimitedException,
    );
    expect(t.getLimits).toHaveBeenCalledWith(OWNER_ID);
  });
});

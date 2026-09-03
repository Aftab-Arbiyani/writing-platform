import {
  AiFeature,
  AI_MASTER_FLAG_KEY,
  ERROR_CODES,
  FLAGGED_AI_FEATURES,
  aiFeatureFlagKey,
} from '@qalam/shared';

import type { SettingsService } from '../settings/settings.service';
import type { SettingsService as UserPreferencesService } from '../users/settings.service';
import { AiFeatureService } from './ai-feature.service';

/**
 * B5 (docs/45 §4.10) — the author's own "turn AI off" switch, at the gate.
 *
 * The gate is the single enforcement point for every AI path (docs/35), so these are
 * the tests that decide whether "off" actually means off. The orchestrator half —
 * that a refusal meters NOTHING — lives in
 * `orchestration/ai-completion.user-switch.spec.ts`, next to the meter it is about.
 */

/** A feature flag row shaped the way `evaluateFeatureFlag` reads it. */
function flag(key: string, enabled: boolean) {
  return { key, enabled, envScope: null, rolloutPercentage: null };
}

/**
 * Every AI flag on, so the only variable in a test is the user's own switch.
 *
 * Derived from `FLAGGED_AI_FEATURES` rather than listed by hand: the "everything off"
 * assertion below is only meaningful if the fixture covers every feature the endpoint
 * reports, and a hand-written list would quietly stop covering the next one added.
 */
function allFlagsOn() {
  return [
    flag(AI_MASTER_FLAG_KEY, true),
    ...FLAGGED_AI_FEATURES.map((feature) => flag(aiFeatureFlagKey(feature), true)),
  ];
}

function build(opts: { flags?: ReturnType<typeof allFlagsOn>; userAiEnabled?: boolean } = {}) {
  const getFeatureFlags = jest.fn().mockResolvedValue(opts.flags ?? allFlagsOn());
  const isAiEnabledFor = jest.fn().mockResolvedValue(opts.userAiEnabled ?? true);
  const service = new AiFeatureService(
    { getFeatureFlags } as unknown as SettingsService,
    { isAiEnabledFor } as unknown as UserPreferencesService,
  );
  return { service, getFeatureFlags, isAiEnabledFor };
}

describe('AiFeatureService — the per-account AI switch (B5)', () => {
  describe('assertEnabled', () => {
    it('refuses an opted-out user with AI_DISABLED_BY_USER, not the platform code', async () => {
      const { service } = build({ userAiEnabled: false });

      await expect(service.assertEnabled(AiFeature.WritingAssistant, 'u1')).rejects.toMatchObject({
        code: ERROR_CODES.AI_DISABLED_BY_USER,
      });
    });

    it('points the refusal at settings — never at plans, never at a reset', async () => {
      const { service } = build({ userAiEnabled: false });

      // The remedy is the whole reason this code exists (docs/48 §3.6 was the opposite).
      await expect(service.assertEnabled(AiFeature.CraftCoach, 'u1')).rejects.toMatchObject({
        message: expect.stringContaining('settings') as unknown as string,
      });
    });

    it('lets a user who has NOT opted out straight through', async () => {
      const { service } = build({ userAiEnabled: true });

      await expect(
        service.assertEnabled(AiFeature.WritingAssistant, 'u1'),
      ).resolves.toBeUndefined();
    });

    it('DEFAULTS to on — an existing user with no settings row is unaffected by the deploy', async () => {
      // What `SettingsService.isAiEnabledFor` returns for a user with no row: `?? true`.
      const { service } = build({ userAiEnabled: true });

      await expect(
        service.assertEnabled(AiFeature.CraftCoach, 'never-opened-settings'),
      ).resolves.toBeUndefined();
    });

    it('admin off beats user on — the platform switch answers first', async () => {
      const flags = allFlagsOn().map((f) =>
        f.key === AI_MASTER_FLAG_KEY ? flag(AI_MASTER_FLAG_KEY, false) : f,
      );
      const { service } = build({ flags, userAiEnabled: true });

      // AI_DISABLED, not AI_DISABLED_BY_USER: telling this user to change their own
      // setting would send them to a switch that is already on and would not help.
      await expect(service.assertEnabled(AiFeature.WritingAssistant, 'u1')).rejects.toMatchObject({
        code: ERROR_CODES.AI_DISABLED,
      });
    });

    it('admin off ALSO beats user off — the master flag stays the outer gate', async () => {
      const flags = allFlagsOn().map((f) =>
        f.key === AI_MASTER_FLAG_KEY ? flag(AI_MASTER_FLAG_KEY, false) : f,
      );
      const { service } = build({ flags, userAiEnabled: false });

      await expect(service.assertEnabled(AiFeature.WritingAssistant, 'u1')).rejects.toMatchObject({
        code: ERROR_CODES.AI_DISABLED,
      });
    });

    it('covers the playground too — an author who turned AI off turned all of it off', async () => {
      const { service } = build({ userAiEnabled: false });

      // Playground rides the master flag alone among the FLAGS, but the user switch is
      // not a flag: it is the account saying "do not offer me these tools".
      await expect(service.assertEnabled(AiFeature.Playground, 'u1')).rejects.toMatchObject({
        code: ERROR_CODES.AI_DISABLED_BY_USER,
      });
    });

    it('governs the USER, not the story — a co-author with AI on is unaffected', async () => {
      const isAiEnabledFor = jest
        .fn()
        .mockImplementation((userId: string) => Promise.resolve(userId !== 'opted-out'));
      const service = new AiFeatureService(
        {
          getFeatureFlags: jest.fn().mockResolvedValue(allFlagsOn()),
        } as unknown as SettingsService,
        { isAiEnabledFor } as unknown as UserPreferencesService,
      );

      await expect(service.assertEnabled(AiFeature.CraftCoach, 'opted-out')).rejects.toMatchObject({
        code: ERROR_CODES.AI_DISABLED_BY_USER,
      });
      // Same story, different author: their switch is theirs alone.
      await expect(
        service.assertEnabled(AiFeature.CraftCoach, 'co-author'),
      ).resolves.toBeUndefined();
    });
  });

  describe('listFeatureStates (GET /ai/features)', () => {
    it('reports EVERYTHING off for an opted-out user', async () => {
      const { service } = build({ userAiEnabled: false });

      const states = await service.listFeatureStates('u1');

      expect(states.aiEnabled).toBe(false);
      expect(states.userAiEnabled).toBe(false);
      // This is what the clients gate on, so "everything" has to mean every entry.
      expect(states.features).not.toHaveLength(0);
      expect(states.features.every((f) => !f.enabled)).toBe(true);
    });

    it('reports everything on for a user who has not opted out', async () => {
      const { service } = build({ userAiEnabled: true });

      const states = await service.listFeatureStates('u1');

      expect(states.aiEnabled).toBe(true);
      expect(states.userAiEnabled).toBe(true);
      expect(states.features.every((f) => f.enabled)).toBe(true);
    });

    it('distinguishes the two causes of off, so the client can offer the right remedy', async () => {
      const flags = allFlagsOn().map((f) =>
        f.key === AI_MASTER_FLAG_KEY ? flag(AI_MASTER_FLAG_KEY, false) : f,
      );
      const { service } = build({ flags, userAiEnabled: true });

      const states = await service.listFeatureStates('u1');

      // Off, but NOT the user's doing — a client must not tell them to check a setting.
      expect(states.aiEnabled).toBe(false);
      expect(states.userAiEnabled).toBe(true);
    });

    it('reads the switch for the CALLER, not for whoever asked last', async () => {
      const { service, isAiEnabledFor } = build({ userAiEnabled: true });

      await service.listFeatureStates('u-42');

      expect(isAiEnabledFor).toHaveBeenCalledWith('u-42');
    });
  });

  describe('isAiEnabledForUser', () => {
    it('is the AND of the platform switch and the user switch', async () => {
      const off = allFlagsOn().map((f) =>
        f.key === AI_MASTER_FLAG_KEY ? flag(AI_MASTER_FLAG_KEY, false) : f,
      );

      await expect(build({ userAiEnabled: true }).service.isAiEnabledForUser('u1')).resolves.toBe(
        true,
      );
      await expect(build({ userAiEnabled: false }).service.isAiEnabledForUser('u1')).resolves.toBe(
        false,
      );
      await expect(
        build({ flags: off, userAiEnabled: true }).service.isAiEnabledForUser('u1'),
      ).resolves.toBe(false);
    });

    it('does not consult the user switch once the platform switch is down', async () => {
      const off = allFlagsOn().map((f) =>
        f.key === AI_MASTER_FLAG_KEY ? flag(AI_MASTER_FLAG_KEY, false) : f,
      );
      const { service, isAiEnabledFor } = build({ flags: off, userAiEnabled: true });

      await service.isAiEnabledForUser('u1');

      // Precedence made concrete: with AI off platform-wide there is no per-user read
      // to make, so the gate costs no extra query on the path that refuses everyone.
      expect(isAiEnabledFor).not.toHaveBeenCalled();
    });
  });
});

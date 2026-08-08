import { AiFeature, ERROR_CODES } from '@qalam/shared';
import type { AiFeaturesResponse, AiUsageResponse } from '@qalam/api-types';
import { describe, expect, it } from 'vitest';

import {
  AVAILABILITY_COPY,
  availabilityFromErrorCode,
  resolveAvailability,
} from './ai-availability';

function features(over: Partial<AiFeaturesResponse> = {}): AiFeaturesResponse {
  return {
    aiEnabled: true,
    userAiEnabled: true,
    features: [
      {
        feature: AiFeature.WritingAssistant,
        flagKey: 'feature.ai.writingAssistant.enabled',
        enabled: true,
      },
      { feature: AiFeature.CraftCoach, flagKey: 'feature.ai.craftCoach.enabled', enabled: true },
    ],
    ...over,
  };
}

function window(over: Partial<AiUsageResponse['daily']> = {}): AiUsageResponse['daily'] {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    requests: 0,
    estimatedCostUsd: 0,
    tokenLimit: 10_000,
    usedFraction: 0.1,
    ...over,
  };
}

function usage(over: Partial<AiUsageResponse> = {}): AiUsageResponse {
  return { daily: window(), monthly: window(), ...over } as AiUsageResponse;
}

const feature = AiFeature.WritingAssistant;

describe('resolveAvailability', () => {
  it('is unknown until the flags have loaded (no wall flashes on first paint)', () => {
    expect(resolveAvailability({ feature, features: undefined, usage: undefined })).toBe('unknown');
  });

  it('is available when AI is on, the feature is flagged on, and there is allowance left', () => {
    expect(resolveAvailability({ feature, features: features(), usage: usage() })).toBe(
      'available',
    );
  });

  it('reports the master switch being off', () => {
    expect(
      resolveAvailability({ feature, features: features({ aiEnabled: false }), usage: usage() }),
    ).toBe('off');
  });

  /**
   * B5 (docs/45 §4.10). Both causes of "AI is off for you" arrive as `aiEnabled: false`; only
   * `userAiEnabled` separates them, and they need different copy and different remedies.
   */
  describe('the account\u2019s own AI switch (B5)', () => {
    it('reports self-off when the reader turned AI off themselves', () => {
      expect(
        resolveAvailability({
          feature,
          features: features({ aiEnabled: false, userAiEnabled: false }),
          usage: usage(),
        }),
      ).toBe('self-off');
    });

    it('still reports plain off when it is the PLATFORM switch, not the reader', () => {
      // Admin off beats user on: blaming the reader here would send them to a switch that is
      // already on and would change nothing.
      expect(
        resolveAvailability({
          feature,
          features: features({ aiEnabled: false, userAiEnabled: true }),
          usage: usage(),
        }),
      ).toBe('off');
    });

    it('hides a master-switch-only surface too (feature: null skips flags, not this)', () => {
      // W9's Story Explorer and the editor's assistant button ask the `null` question. A reader
      // who switched AI off must lose those as well, or they are stranded entry points.
      expect(
        resolveAvailability({
          feature: null,
          features: features({ aiEnabled: false, userAiEnabled: false }),
          usage: usage(),
        }),
      ).toBe('self-off');
    });

    it('leaves an ordinary reader entirely unaffected — the default is on', () => {
      expect(resolveAvailability({ feature, features: features(), usage: usage() })).toBe(
        'available',
      );
    });

    it('maps AI_DISABLED_BY_USER, and never onto the platform or quota states', () => {
      expect(availabilityFromErrorCode(ERROR_CODES.AI_DISABLED_BY_USER)).toBe('self-off');
      // The distinctness that matters: three neighbouring codes, three different remedies.
      expect(availabilityFromErrorCode(ERROR_CODES.AI_DISABLED)).toBe('off');
      expect(availabilityFromErrorCode(ERROR_CODES.QUOTA_EXCEEDED)).toBe('quota');
      expect(availabilityFromErrorCode(ERROR_CODES.ENTITLEMENT_DENIED)).toBe('upgrade');
    });

    it('has copy that points at settings — not at plans and not at waiting', () => {
      const copy = AVAILABILITY_COPY['self-off'];
      expect(copy.description).toMatch(/settings/i);
      expect(copy.description).not.toMatch(/plan/i);
      expect(copy.description).not.toMatch(/reset/i);
    });
  });

  it('distinguishes this feature being dark-launched from AI being off entirely', () => {
    const flags = features({
      features: [
        {
          feature: AiFeature.WritingAssistant,
          flagKey: 'feature.ai.writingAssistant.enabled',
          enabled: false,
        },
      ],
    });
    expect(resolveAvailability({ feature, features: flags, usage: usage() })).toBe('feature-off');
  });

  it('reports quota when either window is spent', () => {
    expect(
      resolveAvailability({
        feature,
        features: features(),
        usage: usage({ daily: window({ usedFraction: 1 }) }),
      }),
    ).toBe('quota');
    expect(
      resolveAvailability({
        feature,
        features: features(),
        usage: usage({ monthly: window({ usedFraction: 1.2 }) }),
      }),
    ).toBe('quota');
  });

  it('never reports quota for an unlimited window, whatever the fraction says', () => {
    expect(
      resolveAvailability({
        feature,
        features: features(),
        usage: usage({ daily: window({ tokenLimit: null, usedFraction: 1 }) }),
      }),
    ).toBe('available');
  });

  it('stays available while usage is still loading', () => {
    expect(resolveAvailability({ feature, features: features(), usage: undefined })).toBe(
      'available',
    );
  });

  /**
   * A usage payload missing a window must not throw. This is a pre-flight courtesy read whose
   * authoritative answer comes back from the request itself, and since W5 it runs on two features'
   * surfaces — so a partial payload throwing here would blank a whole page instead of degrading to
   * "we'll find out when we ask".
   */
  it('treats a missing window as not exhausted rather than throwing', () => {
    expect(
      resolveAvailability({
        feature,
        features: features(),
        usage: {} as unknown as Parameters<typeof resolveAvailability>[0]['usage'],
      }),
    ).toBe('available');
  });
});

describe('availabilityFromErrorCode', () => {
  it('maps both quota codes to the same writer-facing state', () => {
    // A plan cap and the AI module's own token cap are indistinguishable to a writer: they are
    // out of allowance either way.
    expect(availabilityFromErrorCode('QUOTA_EXCEEDED')).toBe('quota');
    expect(availabilityFromErrorCode('AI_USAGE_LIMIT_EXCEEDED')).toBe('quota');
  });

  it('maps the disabled codes', () => {
    expect(availabilityFromErrorCode('AI_DISABLED')).toBe('off');
    expect(availabilityFromErrorCode('AI_FEATURE_DISABLED')).toBe('feature-off');
  });

  /**
   * W4/AF5. Both codes are raised by the monetization meter on the way INTO a generation
   * (`AiUsageMeterService.checkQuota` asserts the `ai_budget` entitlement — the only premium feature
   * any server route actually enforces), and both were unmapped before W4.
   *
   * Unmapped means null, which resolves to the pre-flight answer — "available" — so a writer refused
   * for either reason saw a generic failure over a panel still inviting them to try again.
   */
  it('maps the monetization refusals to the upgrade state', () => {
    expect(availabilityFromErrorCode('ENTITLEMENT_DENIED')).toBe('upgrade');
    expect(availabilityFromErrorCode('INSUFFICIENT_CREDITS')).toBe('upgrade');
  });

  it('keeps upgrade distinct from quota, because the remedies differ', () => {
    // An allowance resets on its own and waiting is enough; a denied entitlement never resets and only
    // a plan changes it. Collapsing the two would tell someone to wait for something that never comes.
    expect(availabilityFromErrorCode('ENTITLEMENT_DENIED')).not.toBe(
      availabilityFromErrorCode('QUOTA_EXCEEDED'),
    );
  });

  it('returns null for unrelated failures, leaving the pre-flight state in charge', () => {
    expect(availabilityFromErrorCode('AI_STREAM_ERROR')).toBeNull();
    expect(availabilityFromErrorCode(null)).toBeNull();
  });
});

describe('AVAILABILITY_COPY', () => {
  it('has copy for every blocked state, so no state renders an undefined notice', () => {
    // The notice component indexes this map by state. A new state without an entry would render
    // `undefined.title` — which is why this asserts the whole set rather than one addition.
    for (const state of ['off', 'feature-off', 'quota', 'upgrade'] as const) {
      expect(AVAILABILITY_COPY[state].title).toBeTruthy();
      expect(AVAILABILITY_COPY[state].description).toBeTruthy();
    }
  });

  it('reassures that writing is unaffected in both metering states', () => {
    // A writer hitting a wall mid-draft needs to know their words are safe before anything else.
    expect(AVAILABILITY_COPY.quota.description).toMatch(/writing is unaffected/i);
    expect(AVAILABILITY_COPY.upgrade.description).toMatch(/writing is unaffected/i);
  });
});

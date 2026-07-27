import { AiFeature } from '@qalam/shared';
import type { AiFeaturesResponse, AiUsageResponse } from '@qalam/api-types';
import { describe, expect, it } from 'vitest';

import { availabilityFromErrorCode, resolveAvailability } from './ai-availability';

function features(over: Partial<AiFeaturesResponse> = {}): AiFeaturesResponse {
  return {
    aiEnabled: true,
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

  it('returns null for unrelated failures, leaving the pre-flight state in charge', () => {
    expect(availabilityFromErrorCode('AI_STREAM_ERROR')).toBeNull();
    expect(availabilityFromErrorCode(null)).toBeNull();
  });
});

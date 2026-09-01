import { beforeEach, describe, expect, it } from 'vitest';

import { useOnboardingStore } from './onboarding.store';

beforeEach(() => {
  useOnboardingStore.setState({ complete: false });
});

describe('onboarding store', () => {
  it('starts incomplete, so a fresh browser sees the intro', () => {
    expect(useOnboardingStore.getState().complete).toBe(false);
  });

  it('markComplete is idempotent', () => {
    // Skip and Get started can both fire from a double-tap; writing twice must be harmless.
    useOnboardingStore.getState().markComplete();
    useOnboardingStore.getState().markComplete();
    expect(useOnboardingStore.getState().complete).toBe(true);
  });

  it('persists ONLY the flag, never the action', () => {
    // `partialize` guards the stored shape: persisting a function would round-trip as undefined and
    // leave the rehydrated store without `markComplete`.
    const persisted = useOnboardingStore.persist.getOptions().partialize?.({
      complete: true,
      markComplete: () => undefined,
    });
    expect(persisted).toEqual({ complete: true });
  });

  it('is stored under the qalam-* key convention', () => {
    expect(useOnboardingStore.persist.getOptions().name).toBe('qalam-onboarding');
  });
});

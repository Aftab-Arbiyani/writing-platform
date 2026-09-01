import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * The durable "has this browser seen the intro" bit (docs/48 §2 row 7).
 *
 * **Why it is app-level and not inside `features/onboarding`.** The router guard reads it, and
 * `app/` may not reach into a feature's internals any more than a feature may reach into another's
 * (docs/26 §4). Mobile's equivalent makes the identical split for the identical reason — its
 * `OnboardingController` lives in `core/session/`, not in the onboarding feature, because
 * "the router guard and the launch-phase provider read it; a feature-owned provider would force a
 * cross-feature/app import" (`qalam-mobile/lib/core/session/onboarding_controller.dart`).
 *
 * So this holds only the durable flag. The carousel and its transient page index belong to the
 * feature, exactly as they do on mobile.
 *
 * **Per browser, not per account, and that is a real limitation stated rather than hidden.** Mobile
 * persists to device preferences and shows the intro once per install; the honest web analogue is
 * `localStorage`, so a second browser or a cleared profile sees it again. Making it per-account
 * would need a server field that the frozen `v1` does not have, and inventing one for a three-slide
 * intro is not a trade worth making — being shown a 20-second introduction twice is a small cost,
 * and it is the same cost mobile pays on a reinstall.
 *
 * Persisted under `qalam-onboarding`, matching `theme.store`'s `qalam-*` key convention.
 */
interface OnboardingState {
  /** False until Skip or Get started is pressed. Persisted; nothing else here is. */
  complete: boolean;
  /**
   * Mark the intro seen — from Skip or from the last slide, which are the same commitment: the
   * reader has been offered it and is done with it. Idempotent, so a double-tap writes once.
   */
  markComplete: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      complete: false,
      markComplete: () => {
        set({ complete: true });
      },
    }),
    {
      name: 'qalam-onboarding',
      partialize: (state) => ({ complete: state.complete }),
    },
  ),
);

import { PremiumFeature } from '@qalam/shared';
import type { ReactElement } from 'react';

import { AiAvailabilityNotice } from '@/components/ai-availability-notice';
import { WritingAssistantPanel } from '@/features/ai';
import { PremiumGate } from '@/features/monetization';
import { EditorPage } from '@/features/writing';

/**
 * Lazy route module (docs/11 §9) — the distraction-free editor (`/write`, `/write/:draftId`).
 *
 * This is where the editor and the AI assistant are composed (W2, docs/45 §4.2). Only `app/`
 * knows about both features (docs/26 §4): the editor exposes an `assistant` slot and registers
 * itself on the app-level AI-editor-target seam; the panel drives that seam. Neither feature
 * imports the other, and either can be deleted without touching the other's code.
 *
 * **D3 adds a third feature to that composition** (docs/45 §4 row D3, docs/48 §6.13): AI writing is
 * a paid capability, so the two AF2 tabs are wrapped in monetization's existing `PremiumGate`. It is
 * supplied from here for the same reason the editor's slot is — `features/ai` may not import
 * `features/monetization`, and the panel already documented that `upgrade` was reachable only
 * reactively for exactly this boundary reason. Passing the gate down closes that gap without
 * either feature learning about the other, and without a new endpoint: `PremiumGate` reads the
 * `GET /monetization/entitlements` snapshot both clients already consume.
 *
 * The gate wraps ONLY the Assistant and Craft Coach tabs. Explorer and Ask My Book are AF4
 * surfaces belonging to D4, whose scope the owner deferred, and 48 §5.2 consequence 1 still forbids
 * gating them — a client-side wall in front of a route the server serves.
 */
export function Component(): ReactElement {
  return (
    <EditorPage
      assistant={
        <WritingAssistantPanel
          writingGate={(children) => (
            <PremiumGate
              feature={PremiumFeature.AiWriting}
              /**
               * The same notice the mid-flight 402 renders, deliberately: a writer who is walled
               * on page load and one who is walled between load and generation are in the same
               * situation and must not be told two different stories about it.
               */
              locked={<AiAvailabilityNotice availability="upgrade-writing" />}
            >
              {children}
            </PremiumGate>
          )}
        />
      }
    />
  );
}

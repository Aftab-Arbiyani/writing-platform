import { PremiumFeature } from '@qalam/shared';
import { QEmptyState } from '@qalam/ui';
import { Sparkles } from 'lucide-react';
import type { ReactElement } from 'react';

import { AiAvailabilityNotice } from '@/components/ai-availability-notice';
import { WritingAssistantPanel } from '@/features/ai';
import { PremiumGate, isMonetizationEnabled } from '@/features/monetization';
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
 * **D4 adds the second gate** (decided 2026-08-21, docs/48 §5.2; backend + mobile built 2026-08-24,
 * web here). `story_intelligence` is the one premium code of the six that D4 chose to enforce, so the
 * Story Explorer gets its own gate — and **Ask My Book deliberately does not**: the same decision
 * declared `ai_discovery` and four others included in every tier, so walling that tab would now
 * contradict a settled call rather than pre-empt an open one. Two props rather than one, because the
 * two gates answer different questions with different remedies and the panel must not be able to
 * confuse them.
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
          explorerGate={(children) =>
            /**
             * **The dark-launch branch comes BEFORE the gate, and mobile's build is why.**
             * `PremiumGate` fails closed, and that includes the client flag being off — but with
             * monetization dark no subscription can exist, so every viewer would be told a feature
             * that has not shipped "needs a paid plan", and sent to a plans page that is itself
             * switched off. Mobile hit this first (`story_explorer_screen.dart`) and answered it the
             * same way: say the honest thing instead, which is that the graph is not available yet.
             */
            isMonetizationEnabled() ? (
              <PremiumGate feature={PremiumFeature.StoryIntelligence}>{children}</PremiumGate>
            ) : (
              <QEmptyState
                icon={Sparkles}
                title="Story Explorer isn’t available yet"
                description="The story knowledge graph arrives with subscriptions."
                minHeight={220}
              />
            )
          }
        />
      }
    />
  );
}

import { AiFeature } from '@qalam/shared';
import { QDrawer } from '@qalam/ui';
import { Tabs } from 'antd';
import { useState, type ReactElement, type ReactNode } from 'react';

import { useAiEditorTarget } from '@/stores/ai-editor-target.store';

import { AiAvailabilityNotice } from '@/components/ai-availability-notice';
import { AskBookTab } from './ask-book-tab';
import { AssistantTab } from './assistant-tab';
import { CoachTab } from './coach-tab';
import { StoryExplorerTab } from './story-explorer-tab';
import { availabilityFromErrorCode, resolveAvailability } from '@/lib/ai-availability';
import { useAiFeatures, useAiUsage } from '../hooks/use-ai-meta';
import { useAiStreamStore } from '../stores/ai-stream.store';
import { useAskBookStore } from '../stores/ask-book.store';

/**
 * The in-editor AI panel (W2/AF2, docs/45 §4.2) — Writing Assistant + Craft Coach in a side
 * sheet over the editor.
 *
 * It is mounted by the **app-level** `/write` route rather than by the editor, because the editor
 * lives in `features/writing` and may not import `features/ai` (docs/26 §4). The two meet at the
 * app-level [`ai-editor-target`](../../../stores/ai-editor-target.store.ts) seam: the editor
 * registers a target, this panel drives it, and the panel is simply inert wherever no editor
 * registered.
 *
 * Availability is resolved per tab, since the assistant and the coach are separately flagged
 * features, and a quota wall is shown **before** the writer composes an instruction rather than
 * after they lose it to a rejection.
 *
 * **W9 adds the two STORY-scoped AF4 surfaces here rather than on routes of their own** — Story
 * Explorer and Ask My Book. Mobile reaches both from the editor's AI overflow menu
 * (`editor_screen.dart:280-291`); this drawer is the web's editor AI menu, and docs/45 §4.1 already
 * treats "editor-scoped AI hangs off the editor" as the accepted arrangement (W8's `/settings/ai`
 * hub is for the ACCOUNT-scoped surfaces, a different category). Both tabs appear only once the
 * draft has a server id, which is the web reading of mobile's `isRemote` gate: a draft that lives
 * only in this browser has no story to explore or ask about.
 */
export interface WritingAssistantPanelProps {
  /**
   * Wraps the two AF2 tabs — Assistant and Craft Coach — in the `ai_writing` entitlement gate
   * (D3, docs/45 §4 row D3). Supplied by `app/routes/write.tsx`, which is the only layer that may
   * know about both `features/ai` and `features/monetization` (docs/26 §4) — the same reason the
   * editor and this panel meet at an app-level seam rather than importing each other.
   *
   * **Required, not optional with an identity default.** An omitted gate would silently serve AI
   * writing to a free user, which is the exact regression D3 exists to prevent, so omitting it is
   * a compile error instead. It wraps only these two tabs — the Explorer has its own gate below, and
   * **Ask My Book has none**, deliberately.
   */
  writingGate: (children: ReactNode) => ReactNode;

  /**
   * Wraps the Story Explorer tab in the `story_intelligence` entitlement gate (**D4**, decided
   * 2026-08-21, docs/48 §5.2). Supplied from `app/routes/write.tsx` for the same boundary reason as
   * {@link writingGate}.
   *
   * **Why this tab and not the one beside it.** D4 checked all six unenforced premium codes against
   * the live product and made `story_intelligence` the single exception: its graph is never
   * populated, so enforcing it costs nothing observable, while the other five — Ask My Book's
   * `ai_discovery` among them — are live and in real use for free users and were declared included
   * in every tier. So the Ask tab stays ungated **permanently**, and gating it would now contradict a
   * settled decision rather than pre-empt an open one.
   *
   * Required for the same reason as `writingGate`: the server enforces this on all six graph reads
   * (`story-intelligence.service.ts`, `retrieval/consumers/story-explorer.service.ts`), so an omitted
   * gate means a 402 rendered as a generic failure instead of a lock with a way out.
   */
  explorerGate: (children: ReactNode) => ReactNode;
}

export function WritingAssistantPanel({
  writingGate,
  explorerGate,
}: WritingAssistantPanelProps): ReactElement | null {
  const open = useAiEditorTarget((s) => s.open);
  const setOpen = useAiEditorTarget((s) => s.setOpen);
  const target = useAiEditorTarget((s) => s.target);
  const storyId = useAiEditorTarget((s) => s.storyId);

  const features = useAiFeatures();
  const usage = useAiUsage();
  const errorCode = useAiStreamStore((s) => s.errorCode);
  const askErrorCode = useAskBookStore((s) => s.errorCode);
  const [tab, setTab] = useState('assistant');

  // Nothing to assist until an editor registers itself.
  if (!target) return null;

  /**
   * A wall hit mid-flight wins over the pre-flight read: it is newer, and it is authoritative.
   *
   * `failedCode` is the surface's OWN last failure, not "the last AI failure anywhere" — Ask My Book
   * streams from a separate store for exactly this reason (see `ask-book.store.ts`). Sharing one
   * code would let a spent allowance on the assistant present as a wall on the ask, and the writer
   * would be told to upgrade over a request they never made.
   */
  const resolve = (feature: AiFeature, failedCode: string | null) =>
    availabilityFromErrorCode(failedCode, feature) ??
    resolveAvailability({ feature, features: features.data, usage: usage.data });

  const assistant = resolve(AiFeature.WritingAssistant, errorCode);
  const coach = resolve(AiFeature.CraftCoach, errorCode);
  const ask = resolve(AiFeature.AskBook, askErrorCode);
  /**
   * The explorer has no FEATURE FLAG and makes no model call, so `null` asks for the
   * master-switch-only gate — see `resolveAvailability`. It also opts out of the mid-flight
   * `errorCode` override the other tabs share: that code comes from whichever AI request last
   * failed, and a spent allowance on the assistant must not wall off a read that spends nothing.
   *
   * **This is the FLAG question only, and since D4 it is no longer the whole answer.** The sentence
   * that used to live here — "`story-explorer.controller.ts` carries `ai.use` alone" — stopped being
   * true on 2026-08-24: the consumer now asserts `story_intelligence` before it reads
   * (`retrieval/consumers/story-explorer.service.ts`). Availability and entitlement are separate
   * questions with separate answers, so the second one is `explorerGate`, not this line.
   */
  const explorer = resolveAvailability({
    feature: null,
    features: features.data,
    usage: usage.data,
  });

  return (
    <QDrawer
      open={open}
      onClose={() => {
        setOpen(false);
      }}
      title="AI assistant"
      width={420}
    >
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          /**
           * D3: the entitlement gate wraps the WHOLE tab body, including the availability notice.
           * A free writer is not entitled to AI writing whatever the flags and allowance say, so
           * showing them "you've used your AI allowance" would be answering a question they are
           * not being asked. The gate wins and says the one thing that is true and actionable.
           *
           * The mid-flight path needs no wrapper: a 402 arriving during a generation lands in
           * `errorCode`, which `resolve` maps to `upgrade-writing` — the same copy this gate's
           * locked slot renders, so a wall hit between page load and generation reads identically
           * to one that was there all along.
           */
          {
            key: 'assistant',
            label: 'Assistant',
            children: writingGate(
              assistant === 'available' || assistant === 'unknown' ? (
                <AssistantTab disabled={assistant !== 'available'} />
              ) : (
                <AiAvailabilityNotice availability={assistant} />
              ),
            ),
          },
          {
            key: 'coach',
            label: 'Craft Coach',
            children: writingGate(
              coach === 'available' || coach === 'unknown' ? (
                <CoachTab disabled={coach !== 'available'} />
              ) : (
                <AiAvailabilityNotice availability={coach} />
              ),
            ),
          },
          // Hidden outright without a story id rather than shown disabled: there is nothing the
          // writer can do about it here except keep writing, and autosave adds the tab the moment
          // the draft first syncs.
          ...(storyId === null
            ? []
            : [
                {
                  key: 'explorer',
                  label: 'Explorer',
                  /**
                   * D4: availability first, entitlement second, and in that order deliberately.
                   * A writer whose instance has AI switched off is not in a position to buy
                   * anything, so "AI is turned off" beats "this needs a paid plan" — the same
                   * precedence D3's gate documents on the two tabs above, and the same one mobile's
                   * screen applies by checking `aiEnabled` before it reaches its `PremiumGate`.
                   */
                  children:
                    explorer === 'available' || explorer === 'unknown' ? (
                      explorerGate(<StoryExplorerTab storyId={storyId} />)
                    ) : (
                      <AiAvailabilityNotice availability={explorer} />
                    ),
                },
                {
                  key: 'ask',
                  label: 'Ask',
                  children:
                    ask === 'available' || ask === 'unknown' ? (
                      <AskBookTab storyId={storyId} disabled={ask !== 'available'} />
                    ) : (
                      <AiAvailabilityNotice availability={ask} />
                    ),
                },
              ]),
        ]}
      />
    </QDrawer>
  );
}

import { AiFeature } from '@qalam/shared';
import { QDrawer } from '@qalam/ui';
import { Tabs } from 'antd';
import { useState, type ReactElement, type ReactNode } from 'react';

import { useAiEditorTarget } from '@/stores/ai-editor-target.store';

import { AiAvailabilityNotice } from '@/components/ai-availability-notice';
import { FeedbackTab } from './feedback-tab';
import { PolishTab } from './polish-tab';
import { StoryMapTab } from './story-map-tab';
import { availabilityFromErrorCode, resolveAvailability } from '@/lib/ai-availability';
import { useAiFeatures } from '../hooks/use-ai-meta';
import { useAiStreamStore } from '../stores/ai-stream.store';

/**
 * The in-editor **Writing tools** drawer (D5, was the AI assistant panel) — Polish, Manuscript
 * feedback and Story Map in a side sheet over the editor.
 *
 * It is mounted by the **app-level** `/write` route rather than by the editor, because the editor
 * lives in `features/writing` and may not import `features/ai` (docs/26 §4). The two meet at the
 * app-level [`ai-editor-target`](../../../stores/ai-editor-target.store.ts) seam: the editor
 * registers a target, this drawer drives it, and the drawer is simply inert wherever no editor
 * registered.
 *
 * **D5 deleted the fourth tab, Ask My Book**, along with the separate error store it needed. The
 * three that remain are the three the decision kept: two that work on the writer's prose and one
 * that reads their story back to them.
 *
 * Availability is resolved per tab, since Polish and feedback are separately flagged features, and a
 * quota wall is shown **before** the writer commits to an action rather than after.
 */
export interface WritingToolsDrawerProps {
  /**
   * Wraps Polish and Manuscript feedback in the `ai_writing` entitlement gate (D3, docs/45 §4 row
   * D3). Supplied by `app/routes/write.tsx`, which is the only layer that may know about both
   * `features/ai` and `features/monetization` (docs/26 §4) — the same reason the editor and this
   * drawer meet at an app-level seam rather than importing each other.
   *
   * **Required, not optional with an identity default.** An omitted gate would silently serve paid
   * tools to a free writer, which is the exact regression D3 exists to prevent, so omitting it is a
   * compile error instead.
   */
  writingGate: (children: ReactNode) => ReactNode;

  /**
   * Wraps the Story Map tab in the `story_intelligence` entitlement gate (**D4**, decided
   * 2026-08-21, docs/48 §5.2). Supplied from `app/routes/write.tsx` for the same boundary reason as
   * {@link writingGate}.
   *
   * Required for the same reason: the server enforces this on all six graph reads
   * (`story-intelligence.service.ts`, `retrieval/consumers/story-explorer.service.ts`) and on the
   * D5 map trigger, so an omitted gate means a 402 rendered as a generic failure instead of a lock
   * with a way out.
   */
  storyMapGate: (children: ReactNode) => ReactNode;
}

export function WritingToolsDrawer({
  writingGate,
  storyMapGate,
}: WritingToolsDrawerProps): ReactElement | null {
  const open = useAiEditorTarget((s) => s.open);
  const setOpen = useAiEditorTarget((s) => s.setOpen);
  const target = useAiEditorTarget((s) => s.target);
  const storyId = useAiEditorTarget((s) => s.storyId);

  const features = useAiFeatures();
  const errorCode = useAiStreamStore((s) => s.errorCode);
  const [tab, setTab] = useState('polish');

  // Nothing to assist until an editor registers itself.
  if (!target) return null;

  /**
   * A wall hit mid-flight wins over the pre-flight read: it is newer, and it is authoritative.
   *
   * The `usage` argument is gone with D5's token windows — availability no longer has a "you are out
   * of tokens" state to resolve from a rollup, because the allowance is a per-tool count and the
   * only authority on it is the 429 that arrives when it runs out.
   */
  const resolve = (feature: AiFeature, failedCode: string | null) =>
    availabilityFromErrorCode(failedCode, feature) ??
    resolveAvailability({ feature, features: features.data });

  const polish = resolve(AiFeature.WritingAssistant, errorCode);
  const feedback = resolve(AiFeature.CraftCoach, errorCode);
  /**
   * Story Map has no FEATURE FLAG and its reads make no model call, so `null` asks for the
   * master-switch-only gate — see `resolveAvailability`. It also opts out of the mid-flight
   * `errorCode` override the other tabs share: that code comes from whichever request last failed,
   * and a spent Polish allowance must not wall off a read that spends nothing.
   *
   * **This is the FLAG question only, and since D4 it is not the whole answer.** The consumer
   * asserts `story_intelligence` before it reads. Availability and entitlement are separate
   * questions with separate answers, so the second one is `storyMapGate`, not this line.
   */
  const storyMap = resolveAvailability({ feature: null, features: features.data });

  return (
    <QDrawer
      open={open}
      onClose={() => {
        setOpen(false);
      }}
      title="Writing tools"
      width={420}
    >
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          /**
           * D3: the entitlement gate wraps the WHOLE tab body, including the availability notice.
           * A free writer is not entitled to these tools whatever the flags say, so showing them
           * "you've used today's Polish actions" would answer a question they are not being asked.
           * The gate wins and says the one thing that is true and actionable.
           *
           * The mid-flight path needs no wrapper: a 402 arriving during a generation lands in
           * `errorCode`, which `resolve` maps to `upgrade-writing` — the same copy this gate's
           * locked slot renders, so a wall hit between page load and generation reads identically
           * to one that was there all along.
           */
          {
            key: 'polish',
            label: 'Polish',
            children: writingGate(
              polish === 'available' || polish === 'unknown' ? (
                <PolishTab disabled={polish !== 'available'} />
              ) : (
                <AiAvailabilityNotice availability={polish} />
              ),
            ),
          },
          {
            key: 'feedback',
            label: 'Feedback',
            children: writingGate(
              feedback === 'available' || feedback === 'unknown' ? (
                <FeedbackTab disabled={feedback !== 'available'} />
              ) : (
                <AiAvailabilityNotice availability={feedback} />
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
                  key: 'story-map',
                  label: 'Story Map',
                  /**
                   * D4: availability first, entitlement second, and in that order deliberately.
                   * A writer whose instance has the platform switched off is not in a position to
                   * buy anything, so "Writing tools aren't available" beats "this needs a paid
                   * plan" — the same precedence D3's gate documents on the two tabs above.
                   */
                  children:
                    storyMap === 'available' || storyMap === 'unknown' ? (
                      storyMapGate(<StoryMapTab storyId={storyId} />)
                    ) : (
                      <AiAvailabilityNotice availability={storyMap} />
                    ),
                },
              ]),
        ]}
      />
    </QDrawer>
  );
}

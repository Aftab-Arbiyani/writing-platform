import { AiFeature } from '@qalam/shared';
import { QDrawer } from '@qalam/ui';
import { Tabs } from 'antd';
import { useState, type ReactElement } from 'react';

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
export function WritingAssistantPanel(): ReactElement | null {
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
    availabilityFromErrorCode(failedCode) ??
    resolveAvailability({ feature, features: features.data, usage: usage.data });

  const assistant = resolve(AiFeature.WritingAssistant, errorCode);
  const coach = resolve(AiFeature.CraftCoach, errorCode);
  const ask = resolve(AiFeature.AskBook, askErrorCode);
  /**
   * The explorer has NO feature flag and makes NO model call (`story-explorer.controller.ts` carries
   * `ai.use` alone), so `null` asks for the master-switch-only gate — see `resolveAvailability`. It
   * also opts out of the mid-flight `errorCode` override the other tabs share: that code comes from
   * whichever AI request last failed, and a spent allowance on the assistant must not wall off a
   * read that spends nothing.
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
          {
            key: 'assistant',
            label: 'Assistant',
            children:
              assistant === 'available' || assistant === 'unknown' ? (
                <AssistantTab disabled={assistant !== 'available'} />
              ) : (
                <AiAvailabilityNotice availability={assistant} />
              ),
          },
          {
            key: 'coach',
            label: 'Craft Coach',
            children:
              coach === 'available' || coach === 'unknown' ? (
                <CoachTab disabled={coach !== 'available'} />
              ) : (
                <AiAvailabilityNotice availability={coach} />
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
                  children:
                    explorer === 'available' || explorer === 'unknown' ? (
                      <StoryExplorerTab storyId={storyId} />
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

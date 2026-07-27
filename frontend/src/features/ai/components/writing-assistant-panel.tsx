import { AiFeature } from '@qalam/shared';
import { QDrawer } from '@qalam/ui';
import { Tabs } from 'antd';
import { useState, type ReactElement } from 'react';

import { useAiEditorTarget } from '@/stores/ai-editor-target.store';

import { AiAvailabilityNotice } from './ai-availability-notice';
import { AssistantTab } from './assistant-tab';
import { CoachTab } from './coach-tab';
import { availabilityFromErrorCode, resolveAvailability } from '../lib/ai-availability';
import { useAiFeatures, useAiUsage } from '../hooks/use-ai-meta';
import { useAiStreamStore } from '../stores/ai-stream.store';

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
 */
export function WritingAssistantPanel(): ReactElement | null {
  const open = useAiEditorTarget((s) => s.open);
  const setOpen = useAiEditorTarget((s) => s.setOpen);
  const target = useAiEditorTarget((s) => s.target);

  const features = useAiFeatures();
  const usage = useAiUsage();
  const errorCode = useAiStreamStore((s) => s.errorCode);
  const [tab, setTab] = useState('assistant');

  // Nothing to assist until an editor registers itself.
  if (!target) return null;

  const resolve = (feature: AiFeature) => {
    // A wall hit mid-flight wins over the pre-flight read: it is newer, and it is authoritative.
    const fromError = availabilityFromErrorCode(errorCode);
    return (
      fromError ?? resolveAvailability({ feature, features: features.data, usage: usage.data })
    );
  };

  const assistant = resolve(AiFeature.WritingAssistant);
  const coach = resolve(AiFeature.CraftCoach);

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
        ]}
      />
    </QDrawer>
  );
}

import type { ReactElement } from 'react';

import { WritingAssistantPanel } from '@/features/ai';
import { EditorPage } from '@/features/writing';

/**
 * Lazy route module (docs/11 §9) — the distraction-free editor (`/write`, `/write/:draftId`).
 *
 * This is where the editor and the AI assistant are composed (W2, docs/45 §4.2). Only `app/`
 * knows about both features (docs/26 §4): the editor exposes an `assistant` slot and registers
 * itself on the app-level AI-editor-target seam; the panel drives that seam. Neither feature
 * imports the other, and either can be deleted without touching the other's code.
 */
export function Component(): ReactElement {
  return <EditorPage assistant={<WritingAssistantPanel />} />;
}

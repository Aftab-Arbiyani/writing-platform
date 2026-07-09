import { countWords, extractPlainText, readingTime } from '@qalam/utils';
import type { Editor } from '@tiptap/react';
import { useEffect, useState, type ReactElement } from 'react';

import { formatReadingTime } from '@/lib/format';

/**
 * Live word / character count + reading time (docs/06 §3.3 — opt-in, bottom corner). Uses the
 * SAME `@qalam/utils` functions the server derives with, so the numbers match exactly. Isolated
 * into its own component so recomputing on `update` re-renders only this small counter, never
 * the document (docs/12 §5). Debounced so long pieces don't recompute per keystroke.
 */
export function EditorMetrics({ editor }: { editor: Editor }): ReactElement {
  const [metrics, setMetrics] = useState(() => compute(editor));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const recompute = (): void => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setMetrics(compute(editor));
      }, 300);
    };
    editor.on('update', recompute);
    return () => {
      if (timer) clearTimeout(timer);
      editor.off('update', recompute);
    };
  }, [editor]);

  return (
    <div className="flex items-center gap-3 text-xs text-ink-muted tabular-nums" aria-live="polite">
      <span>{metrics.words} words</span>
      <span aria-hidden>·</span>
      <span>{metrics.characters} characters</span>
      <span aria-hidden>·</span>
      <span>{formatReadingTime(metrics.readingTimeSeconds)} read</span>
    </div>
  );
}

function compute(editor: Editor): {
  words: number;
  characters: number;
  readingTimeSeconds: number;
} {
  const text = extractPlainText(editor.getJSON());
  const words = countWords(text);
  return { words, characters: text.length, readingTimeSeconds: readingTime(words) };
}

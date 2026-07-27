import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { STORAGE_KEYS } from '@/lib/constants';

/**
 * Reader typography preferences (W1, docs/45 §4.1) — the web analog of mobile's
 * `reader_preferences_controller`, with the same three axes so a reader who uses both surfaces
 * finds the same controls.
 *
 * This is **client state, not server state** (docs/12 §3): it is device-scoped, never synced, and
 * survives logout. Theme is deliberately NOT here — it is app-wide and already owned by
 * `stores/theme.store`; the reader panel drives that store rather than duplicating it.
 *
 * The values are emitted as CSS custom properties onto the prose element (`--q-prose-size`,
 * `--q-prose-leading`) and as a column max-width, so a change repaints without re-rendering the
 * article tree.
 */

export type ReaderTextSize = 'sm' | 'md' | 'lg';
export type ReaderLineSpacing = 'compact' | 'normal' | 'relaxed';
export type ReaderWidth = 'narrow' | 'medium' | 'wide';

/** Body size in rem. `md` is the design-system reading default (docs/07 §Typography). */
export const TEXT_SIZE_REM: Record<ReaderTextSize, number> = {
  sm: 1.125,
  md: 1.25,
  lg: 1.5,
};

/**
 * Unitless leading multipliers. `normal` is `--q-leading-latin` (1.7); the Nastaliq floor of 2.0
 * (docs/06 §7 — "never < 2.0") is enforced separately, at the point the value is applied, so a
 * reader cannot pick a spacing that makes Urdu illegible.
 */
export const LINE_SPACING: Record<ReaderLineSpacing, number> = {
  compact: 1.5,
  normal: 1.7,
  relaxed: 2.0,
};

/** Reading-column max width in px. `medium` matches the shipped 720px column. */
export const COLUMN_WIDTH_PX: Record<ReaderWidth, number> = {
  narrow: 620,
  medium: 720,
  wide: 860,
};

export interface ReaderPreferences {
  textSize: ReaderTextSize;
  lineSpacing: ReaderLineSpacing;
  width: ReaderWidth;
}

interface ReaderPreferencesState extends ReaderPreferences {
  setTextSize: (value: ReaderTextSize) => void;
  setLineSpacing: (value: ReaderLineSpacing) => void;
  setWidth: (value: ReaderWidth) => void;
  reset: () => void;
}

const DEFAULTS: ReaderPreferences = { textSize: 'md', lineSpacing: 'normal', width: 'medium' };

export const useReaderPreferences = create<ReaderPreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTextSize: (textSize) => {
        set({ textSize });
      },
      setLineSpacing: (lineSpacing) => {
        set({ lineSpacing });
      },
      setWidth: (width) => {
        set({ width });
      },
      reset: () => {
        set(DEFAULTS);
      },
    }),
    { name: STORAGE_KEYS.readerPreferences },
  ),
);

/**
 * The CSS the article column renders with. Nastaliq overrides the reader's leading upward when
 * their choice falls below the script's 2.0 floor — the preference is honoured where it is safe
 * and clamped where it is not (docs/06 §7, docs/07 §Typography).
 */
export function readerStyle(
  prefs: ReaderPreferences,
  script?: string | null,
): { fontSize: string; lineHeight: number } {
  const nastaliq = script?.toLowerCase() === 'nastaliq';
  const leading = LINE_SPACING[prefs.lineSpacing];
  return {
    fontSize: `${String(TEXT_SIZE_REM[prefs.textSize])}rem`,
    lineHeight: nastaliq ? Math.max(leading, 2.1) : leading,
  };
}

import type { ReactElement } from 'react';

import { SuggestEditAffordance } from '@/features/collaboration';
import { PiecePage } from '@/features/reading';

/**
 * Lazy route module (docs/11 §9) — the reading view `/p/:slug` (public, optional auth).
 *
 * This is where the reader and "propose an edit" are composed (C-15, docs/48 §3.22a) — the same
 * arrangement [`write.tsx`](./write.tsx) uses for the editor and the AI panel, and for the same
 * reason: only `app/` may know about two features (docs/26 §4). The reader exposes a `suggest`
 * slot and publishes what it is showing on the app-level `suggest-target` seam; the affordance
 * drives that seam. Neither feature imports the other, and either can be deleted without touching
 * the other's code.
 *
 * The affordance is passed unconditionally and decides for itself whether to render anything: it
 * is null unless collaboration is switched on AND the Policy Engine says this viewer may suggest on
 * this story. Gating it here instead would put collaboration's vocabulary — a capability code — into
 * the route, and would make the reader's own tests depend on it.
 */
export function Component(): ReactElement {
  return <PiecePage suggest={<SuggestEditAffordance />} />;
}

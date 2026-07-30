import { PresenceState } from '@qalam/shared';
import { QAvatar } from '@qalam/ui';
import type { ReactElement } from 'react';

import type { StoryPresence } from '../types/collaboration.types';

/**
 * Who is in the workspace right now (AF6, W3a) — mobile's `PresenceBar`.
 *
 * Renders nothing when the roster is empty: "nobody else is here" is the normal state of a story
 * with one author, and a permanent empty strip would be chrome that never earns its space.
 *
 * The roster is polled (docs/49 §6), so it is always slightly behind reality. That is why entries
 * are avatars with a state hint rather than a hard "3 people online" count — the shape of the UI
 * matches the confidence of the data.
 */
const STATE_LABEL: Record<PresenceState, string> = {
  [PresenceState.Active]: 'active',
  [PresenceState.Idle]: 'idle',
  [PresenceState.Typing]: 'typing',
};

const STATE_DOT: Record<PresenceState, string> = {
  [PresenceState.Active]: 'bg-success',
  [PresenceState.Idle]: 'bg-warning',
  [PresenceState.Typing]: 'bg-accent',
};

function shortId(userId: string): string {
  return userId.length > 12 ? `${userId.slice(0, 4)}…${userId.slice(-4)}` : userId;
}

export interface PresenceBarProps {
  presence: StoryPresence[];
}

export function PresenceBar({ presence }: PresenceBarProps): ReactElement | null {
  if (presence.length === 0) return null;

  return (
    <section aria-labelledby="presence-heading" className="flex items-center gap-3">
      <h2 id="presence-heading" className="text-ink-muted text-xs font-medium uppercase">
        In this story
      </h2>
      <ul className="flex items-center gap-2">
        {presence.map((entry) => {
          const state = STATE_LABEL[entry.state] ?? entry.state;
          const label = `${shortId(entry.userId)} — ${state}`;
          return (
            <li key={entry.userId} className="relative" title={label}>
              <QAvatar size={32} name={shortId(entry.userId)} />
              <span
                aria-hidden
                className={`border-canvas absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full border ${
                  STATE_DOT[entry.state] ?? 'bg-ink-muted'
                }`}
              />
              <span className="sr-only">{label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

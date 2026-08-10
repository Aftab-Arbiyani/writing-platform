import { PresenceState } from '@qalam/shared';
import { QAvatar } from '@qalam/ui';
import type { ReactElement } from 'react';

import { mediaUrl } from '@/lib/media';

import { useCollaboratorIdentity } from '../hooks/use-collaborator-identity';
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

export interface PresenceBarProps {
  presence: StoryPresence[];
}

/**
 * One roster entry. A component rather than an inline branch because the identity resolution is a
 * hook (B3, `useCollaboratorIdentity`) and the roster is a list — one hook call per entry, sharing
 * the same cache as every other surface that names this person.
 */
function PresenceEntry({ entry }: { entry: StoryPresence }): ReactElement {
  const { label: name, profile } = useCollaboratorIdentity(entry.userId);
  const state = STATE_LABEL[entry.state] ?? entry.state;
  const label = `${name} — ${state}`;

  return (
    <li className="relative" title={label}>
      <QAvatar size={32} name={name} src={mediaUrl(profile?.avatarKey)} />
      <span
        aria-hidden
        className={`border-canvas absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full border ${
          STATE_DOT[entry.state] ?? 'bg-ink-muted'
        }`}
      />
      <span className="sr-only">{label}</span>
    </li>
  );
}

export function PresenceBar({ presence }: PresenceBarProps): ReactElement | null {
  if (presence.length === 0) return null;

  return (
    <section aria-labelledby="presence-heading" className="flex items-center gap-3">
      <h2 id="presence-heading" className="text-ink-muted text-xs font-medium uppercase">
        In this story
      </h2>
      <ul className="flex items-center gap-2">
        {presence.map((entry) => (
          <PresenceEntry key={entry.userId} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

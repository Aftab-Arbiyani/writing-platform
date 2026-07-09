import { Switch } from 'antd';
import type { ReactElement } from 'react';

/**
 * Notification preference toggles (docs/06 §3.8). Per-type on/off flags persisted to
 * `PATCH /settings.notificationPreferences` (save-on-interaction). Delivery itself is E9
 * (notifications are out of this epic) — these are stored preferences only. Renders the known
 * follow-related types plus any extra keys already present in the bag (never dropped).
 */
const KNOWN: readonly { key: string; label: string; hint: string }[] = [
  { key: 'newFollower', label: 'New followers', hint: 'When someone follows you.' },
  {
    key: 'followRequest',
    label: 'Follow requests',
    hint: 'When someone asks to follow your private notebook.',
  },
  {
    key: 'followAccepted',
    label: 'Accepted requests',
    hint: 'When a writer accepts your follow request.',
  },
];

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function NotificationPreferences({
  preferences,
  disabled,
  onToggle,
}: {
  preferences: Record<string, boolean>;
  disabled: boolean;
  onToggle: (key: string, value: boolean) => void;
}): ReactElement {
  const extraKeys = Object.keys(preferences).filter((k) => !KNOWN.some((known) => known.key === k));
  const rows = [...KNOWN, ...extraKeys.map((key) => ({ key, label: humanize(key), hint: '' }))];

  return (
    <ul className="flex flex-col divide-y divide-line">
      {rows.map(({ key, label, hint }) => (
        <li key={key} className="flex items-center justify-between gap-4 py-3">
          <span className="flex flex-col">
            <span className="text-sm font-medium text-ink">{label}</span>
            {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
          </span>
          <Switch
            checked={preferences[key] ?? false}
            disabled={disabled}
            aria-label={label}
            onChange={(checked) => onToggle(key, checked)}
          />
        </li>
      ))}
    </ul>
  );
}

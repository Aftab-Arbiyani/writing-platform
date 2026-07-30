import { Switch } from 'antd';
import type { ReactElement } from 'react';

import type {
  NotificationPreferenceKey,
  NotificationPreferences,
} from '../types/notification.types';

/**
 * The seven E9 notification categories — the DELIVERY-GATING preferences (`PATCH
 * /notification-preferences`, `TYPE_PREFERENCE` on the backend). Distinct from the Appearance
 * page's `user_settings` toggle bag (F5), which is a non-gating store; these actually stop the
 * matching notifications from being created. Presentational — the page owns the query + optimistic
 * PATCH. `Switch` matches the settings toggle idiom already in the app.
 */
const CATEGORIES: readonly {
  key: NotificationPreferenceKey;
  label: string;
  hint: string;
}[] = [
  {
    key: 'follow',
    label: 'Follows',
    hint: 'New followers, follow requests, and accepted requests.',
  },
  { key: 'comment', label: 'Comments', hint: 'New comments on your pieces.' },
  { key: 'reply', label: 'Replies', hint: 'Replies to your comments.' },
  { key: 'reaction', label: 'Claps & likes', hint: 'When readers clap for or like your pieces.' },
  { key: 'mention', label: 'Mentions', hint: 'When someone @mentions you in a piece or comment.' },
  { key: 'response', label: 'Responses', hint: 'When someone publishes a response to your piece.' },
  { key: 'system', label: 'Announcements', hint: 'Product updates and announcements from Qalam.' },
];

export function NotificationPreferencesForm({
  preferences,
  disabled,
  onToggle,
}: {
  preferences: NotificationPreferences;
  disabled: boolean;
  onToggle: (key: NotificationPreferenceKey, value: boolean) => void;
}): ReactElement {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {CATEGORIES.map(({ key, label, hint }) => (
        <li key={key} className="flex items-center justify-between gap-4 py-3.5">
          <span className="flex flex-col">
            <span className="text-sm font-medium text-ink">{label}</span>
            <span className="text-xs text-ink-muted">{hint}</span>
          </span>
          <Switch
            checked={preferences[key]}
            disabled={disabled}
            aria-label={label}
            onChange={(checked) => {
              onToggle(key, checked);
            }}
          />
        </li>
      ))}
    </ul>
  );
}

import type { ReactElement } from 'react';

import { settingLabel } from '../settings.constants';
import type { Setting } from '../types/settings.types';
import { SettingField } from './setting-field';

interface SettingGroupProps {
  setting: Setting;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  compact?: boolean;
  id: string;
}

/**
 * One labelled setting row (A7) — label + description + control + inline error.
 * Responsive: label and control stack on mobile, sit side-by-side on ≥sm. The
 * `<label htmlFor>` ties to the control's id for keyboard + screen-reader access.
 */
export function SettingGroup({
  setting,
  value,
  onChange,
  error,
  compact = false,
  id,
}: SettingGroupProps): ReactElement {
  return (
    <div
      className={`grid gap-2 border-b border-line last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] sm:items-start sm:gap-6 ${
        compact ? 'py-2' : 'py-4'
      }`}
    >
      <div>
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {settingLabel(setting.key)}
        </label>
        <p className="mt-0.5 text-xs text-ink-muted">
          {setting.description}
          {!setting.editable ? ' · Managed by the environment (read-only).' : ''}
        </p>
      </div>
      <div className="min-w-0">
        <SettingField setting={setting} value={value} onChange={onChange} id={id} />
        {error !== undefined ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      </div>
    </div>
  );
}

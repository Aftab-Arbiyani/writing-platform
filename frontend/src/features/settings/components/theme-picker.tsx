import { ThemePreference } from '@qalam/shared';
import { cn } from '@qalam/ui';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

const OPTIONS: readonly {
  value: ThemePreference;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  { value: ThemePreference.System, label: 'System', hint: 'Match your device', icon: Monitor },
  { value: ThemePreference.Light, label: 'Light', hint: 'Paper & ink', icon: Sun },
  { value: ThemePreference.Dark, label: 'Dark', hint: 'Ink at night', icon: Moon },
];

/**
 * Theme preference as radio cards (docs/06 §3.8). Native radios (accessible radiogroup) styled as
 * cards; the selected card carries the accent ring. The page wires `onChange` to BOTH the local
 * `useThemeStore` (instant, pre-paint render) and `PATCH /settings` (cross-device persistence).
 */
export function ThemePicker({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}): ReactElement {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">Theme</legend>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {OPTIONS.map(({ value: optionValue, label, hint, icon: Icon }) => {
          const selected = optionValue === value;
          return (
            <label
              key={optionValue}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                selected
                  ? 'border-accent ring-2 ring-accent'
                  : 'border-line hover:border-ink-muted',
              )}
            >
              <input
                type="radio"
                name="theme"
                value={optionValue}
                checked={selected}
                onChange={() => onChange(optionValue)}
                className="sr-only"
              />
              <Icon size={20} strokeWidth={1.5} className="text-ink-secondary" aria-hidden />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-ink">{label}</span>
                <span className="text-xs text-ink-muted">{hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

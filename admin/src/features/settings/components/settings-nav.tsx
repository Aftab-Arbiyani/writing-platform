import type { ReactElement } from 'react';

import type { SettingsSection } from '../settings.constants';

interface SettingsNavProps {
  sections: readonly SettingsSection[];
  activeKey: string;
  onSelect: (key: string) => void;
}

/**
 * Settings section navigation (A7) — grouped, keyboard-navigable list. The active
 * item is marked with `aria-current`; selection is driven by the page (URL owns
 * the active section). Rendered as a sidebar on ≥lg (the page swaps in a Select
 * on smaller screens).
 */
export function SettingsNav({ sections, activeKey, onSelect }: SettingsNavProps): ReactElement {
  const groups = sections.reduce<Record<string, SettingsSection[]>>((acc, section) => {
    (acc[section.group] ??= []).push(section);
    return acc;
  }, {});

  return (
    <nav aria-label="Settings sections" className="flex flex-col gap-4">
      {Object.entries(groups).map(([group, items]) => (
        <div key={group} className="flex flex-col gap-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {group}
          </p>
          {items.map((section) => {
            const Icon = section.icon;
            const active = section.key === activeKey;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => onSelect(section.key)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-sm transition-colors ${
                  active
                    ? 'bg-accent-subtle font-medium text-accent'
                    : 'text-ink-secondary hover:bg-raised hover:text-ink'
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {section.label}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

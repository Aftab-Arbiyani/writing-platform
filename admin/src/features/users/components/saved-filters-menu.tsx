import { QButton } from '@qalam/ui';
import { Input, Popover } from 'antd';
import { Bookmark, Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useSearchParams } from 'react-router';

import { useUsersTablePrefs } from '../stores/users-table-prefs.store';

/**
 * Saved-filter presets. Captures the current URL query (filters + sort + search)
 * under a name; applying one replaces the URL search params. Presets persist via
 * the prefs store — a per-operator convenience, not server state.
 */
export function SavedFiltersMenu(): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const savedFilters = useUsersTablePrefs((state) => state.savedFilters);
  const saveFilter = useUsersTablePrefs((state) => state.saveFilter);
  const removeFilter = useUsersTablePrefs((state) => state.removeFilter);
  const [name, setName] = useState('');

  const save = (): void => {
    const trimmed = name.trim();
    if (trimmed === '') {
      return;
    }
    saveFilter(trimmed, searchParams.toString());
    setName('');
  };

  const apply = (query: string): void => {
    setSearchParams(new URLSearchParams(query), { replace: true });
  };

  const content = (
    <div className="flex w-64 flex-col gap-3">
      <div className="flex flex-col gap-1">
        {savedFilters.length === 0 ? (
          <p className="text-sm text-ink-muted">No saved views yet.</p>
        ) : (
          savedFilters.map((filter) => (
            <div key={filter.id} className="flex items-center gap-2">
              <button
                type="button"
                className="flex-1 truncate rounded-md px-2 py-1 text-start text-sm text-ink hover:bg-raised"
                onClick={() => apply(filter.query)}
              >
                {filter.name}
              </button>
              <button
                type="button"
                aria-label={`Delete saved view ${filter.name}`}
                className="text-ink-muted hover:text-danger"
                onClick={() => removeFilter(filter.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <Input
          size="small"
          placeholder="Save current view as…"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onPressEnter={save}
        />
        <QButton variant="secondary" size="sm" onClick={save} disabled={name.trim() === ''}>
          Save
        </QButton>
      </div>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight">
      <QButton variant="secondary" size="sm" icon={Bookmark}>
        Views
      </QButton>
    </Popover>
  );
}

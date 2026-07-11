import { beforeEach, describe, expect, it } from 'vitest';

import { useUsersTablePrefs } from './users-table-prefs.store';

function reset(): void {
  useUsersTablePrefs.setState({ hiddenColumns: [], density: 'middle', savedFilters: [] });
}

describe('useUsersTablePrefs', () => {
  beforeEach(reset);

  it('toggles a column into and out of the hidden set', () => {
    const { toggleColumn } = useUsersTablePrefs.getState();
    toggleColumn('email');
    expect(useUsersTablePrefs.getState().hiddenColumns).toContain('email');
    toggleColumn('email');
    expect(useUsersTablePrefs.getState().hiddenColumns).not.toContain('email');
  });

  it('setColumnVisible is idempotent', () => {
    const { setColumnVisible } = useUsersTablePrefs.getState();
    setColumnVisible('email', false);
    setColumnVisible('email', false);
    expect(useUsersTablePrefs.getState().hiddenColumns).toEqual(['email']);
    setColumnVisible('email', true);
    expect(useUsersTablePrefs.getState().hiddenColumns).toEqual([]);
  });

  it('sets density', () => {
    useUsersTablePrefs.getState().setDensity('small');
    expect(useUsersTablePrefs.getState().density).toBe('small');
  });

  it('saves a named filter and de-duplicates by name', () => {
    const { saveFilter } = useUsersTablePrefs.getState();
    saveFilter('Suspended', 'status=suspended');
    saveFilter('Suspended', 'status=suspended&role=admin');
    const saved = useUsersTablePrefs.getState().savedFilters;
    expect(saved).toHaveLength(1);
    expect(saved[0]?.query).toBe('status=suspended&role=admin');
  });

  it('removes a saved filter by id', () => {
    useUsersTablePrefs.getState().saveFilter('View', 'status=active');
    const id = useUsersTablePrefs.getState().savedFilters[0]?.id ?? '';
    useUsersTablePrefs.getState().removeFilter(id);
    expect(useUsersTablePrefs.getState().savedFilters).toHaveLength(0);
  });
});

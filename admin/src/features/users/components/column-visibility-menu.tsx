import { Checkbox, Popover } from 'antd';
import { Columns3 } from 'lucide-react';
import type { ReactElement } from 'react';

import { QButton } from '@qalam/ui';

import { REQUIRED_COLUMNS, USER_COLUMNS } from '../users.constants';
import { useUsersTablePrefs } from '../stores/users-table-prefs.store';

/**
 * Column-visibility control (client-side only — the grid hides columns; the
 * backend still returns every field). Choices persist via the prefs store.
 */
export function ColumnVisibilityMenu(): ReactElement {
  const hiddenColumns = useUsersTablePrefs((state) => state.hiddenColumns);
  const toggleColumn = useUsersTablePrefs((state) => state.toggleColumn);

  const content = (
    <div
      className="flex max-h-80 flex-col gap-2 overflow-y-auto pe-1"
      role="group"
      aria-label="Toggle columns"
    >
      {USER_COLUMNS.filter((column) => !REQUIRED_COLUMNS.has(column.key)).map((column) => (
        <Checkbox
          key={column.key}
          checked={!hiddenColumns.includes(column.key)}
          onChange={() => toggleColumn(column.key)}
        >
          {column.label}
        </Checkbox>
      ))}
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight">
      <QButton variant="secondary" size="sm" icon={Columns3}>
        Columns
      </QButton>
    </Popover>
  );
}

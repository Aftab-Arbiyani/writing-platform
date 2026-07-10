import { QButton } from '@qalam/ui';
import { Dropdown } from 'antd';
import { Download, FileJson, Printer, Sheet } from 'lucide-react';
import type { ReactElement } from 'react';

import { downloadFile, rowsToCsv, toJSON, type ExportRow } from '../lib/export-analytics';

/**
 * Export menu (docs: Export CSV / JSON / Print — NO PDF). All client-side: `v1` has no export
 * endpoint, so we serialize the already-fetched payloads in the browser. Print calls
 * `window.print()` against the print-friendly stylesheet (chrome hidden via `@media print`).
 * Presentational — the page assembles the rows/json; this owns no API logic.
 */
export function ExportMenu({
  rows,
  json,
  filenameBase,
}: {
  rows: ExportRow[];
  json: unknown;
  filenameBase: string;
}): ReactElement {
  const items = [
    { key: 'csv', label: 'Export CSV', icon: <Sheet size={15} strokeWidth={1.75} aria-hidden /> },
    {
      key: 'json',
      label: 'Export JSON',
      icon: <FileJson size={15} strokeWidth={1.75} aria-hidden />,
    },
    { key: 'print', label: 'Print', icon: <Printer size={15} strokeWidth={1.75} aria-hidden /> },
  ];

  const onClick = ({ key }: { key: string }): void => {
    if (key === 'csv') {
      downloadFile(`${filenameBase}.csv`, rowsToCsv(rows), 'text/csv;charset=utf-8');
    } else if (key === 'json') {
      downloadFile(`${filenameBase}.json`, toJSON(json), 'application/json');
    } else if (key === 'print' && typeof window.print === 'function') {
      window.print();
    }
  };

  return (
    <Dropdown menu={{ items, onClick }} trigger={['click']}>
      <QButton variant="secondary" size="sm" icon={Download}>
        Export
      </QButton>
    </Dropdown>
  );
}

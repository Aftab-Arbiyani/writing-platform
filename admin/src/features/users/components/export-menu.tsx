import { QButton } from '@qalam/ui';
import { Dropdown, type MenuProps } from 'antd';
import { Download, FileJson, Printer, Sheet } from 'lucide-react';
import { createElement, type ReactElement } from 'react';

interface ExportMenuProps {
  onExport: (format: 'csv' | 'json') => void;
  onPrint: () => void;
  exporting: boolean;
}

/** Export/print menu — CSV + JSON stream the full filtered set; Print uses the browser. */
export function ExportMenu({ onExport, onPrint, exporting }: ExportMenuProps): ReactElement {
  const items: MenuProps['items'] = [
    { key: 'csv', label: 'Export CSV', icon: createElement(Sheet, { size: 16 }) },
    { key: 'json', label: 'Export JSON', icon: createElement(FileJson, { size: 16 }) },
    { type: 'divider' },
    { key: 'print', label: 'Print view', icon: createElement(Printer, { size: 16 }) },
  ];

  const onClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'csv' || key === 'json') {
      onExport(key);
    } else if (key === 'print') {
      onPrint();
    }
  };

  return (
    <Dropdown menu={{ items, onClick }} trigger={['click']} placement="bottomRight">
      <QButton variant="secondary" size="sm" icon={Download} loading={exporting}>
        Export
      </QButton>
    </Dropdown>
  );
}

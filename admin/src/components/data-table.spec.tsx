import { screen } from '@testing-library/react';
import type { TableColumnsType } from 'antd';
import { describe, expect, it } from 'vitest';

import { DataTable } from '@/components/data-table';
import { renderWithProviders } from '@/test/render';

interface Row {
  id: string;
  name: string;
}

const columns: TableColumnsType<Row> = [{ title: 'Name', dataIndex: 'name', key: 'name' }];

describe('DataTable', () => {
  it('renders rows', () => {
    renderWithProviders(
      <DataTable<Row> columns={columns} data={[{ id: '1', name: 'Alice' }]} rowKey="id" />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows the empty state when there are no rows', () => {
    renderWithProviders(
      <DataTable<Row> columns={columns} data={[]} rowKey="id" emptyTitle="No users yet" />,
    );
    expect(screen.getByText('No users yet')).toBeInTheDocument();
  });

  it('shows an error panel with a retry when the query failed', () => {
    renderWithProviders(
      <DataTable<Row> columns={columns} data={[]} rowKey="id" error={new Error('boom')} />,
    );
    expect(screen.getByText(/please try again/i)).toBeInTheDocument();
  });
});

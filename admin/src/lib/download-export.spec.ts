import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadExport, exportFilename } from './download-export';

vi.mock('@/lib/api-client', () => ({ getAccessToken: () => 'tok-123' }));

describe('exportFilename', () => {
  it('builds qalam-<kind>-<date>.<format>', () => {
    expect(exportFilename('users', 'csv')).toMatch(/^qalam-users-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(exportFilename('analytics-overview', 'json')).toMatch(
      /^qalam-analytics-overview-.*\.json$/,
    );
  });
});

describe('downloadExport', () => {
  beforeEach(() => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('fetches the export with query + format + Bearer token, then downloads', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) });
    vi.stubGlobal('fetch', fetchMock);

    await downloadExport({
      path: '/admin/users/export',
      query: { q: 'meera', page: 1, empty: undefined },
      format: 'csv',
      filename: 'f.csv',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/admin/users/export');
    expect(url).toContain('q=meera');
    expect(url).toContain('page=1');
    expect(url).toContain('format=csv');
    expect(url).not.toContain('empty='); // undefined skipped
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
    expect(init.credentials).toBe('include');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(
      downloadExport({ path: '/x', query: {}, format: 'json', filename: 'f.json' }),
    ).rejects.toThrow('Export failed (500)');
  });
});

import { Role } from '@qalam/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

import { settingsApi } from '../api/settings.api';
import type { FeatureFlag } from '../types/settings.types';
import {
  useCreateFeatureFlag,
  useDeleteFeatureFlag,
  useFeatureFlags,
  useUpdateFeatureFlag,
} from './use-feature-flags';

vi.mock('../api/settings.api', () => ({
  settingsApi: {
    listFlags: vi.fn(),
    createFlag: vi.fn(),
    updateFlag: vi.fn(),
    deleteFlag: vi.fn(),
  },
}));

function flag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return {
    id: 'f1',
    key: 'feature.ai.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: '',
    updatedBy: null,
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
    ...overrides,
  };
}

function makeClient(): QueryClient {
  // gcTime: Infinity so observer-less cache assertions survive (a gcTime of 0
  // would garbage-collect the inactive query the moment the mutation settles).
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useFeatureFlags', () => {
  beforeEach(() => useAuthStore.setState({ status: 'authenticated', role: Role.Admin }));
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.clearAllMocks();
  });

  it('fetches flags for an admin', async () => {
    (settingsApi.listFlags as Mock).mockResolvedValue([flag()]);
    const { result } = renderHook(() => useFeatureFlags(), { wrapper: wrapperFor(makeClient()) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(settingsApi.listFlags).toHaveBeenCalled();
  });

  it('stays idle for a moderator (settings.manage is admin+)', async () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Moderator });
    const { result } = renderHook(() => useFeatureFlags(), { wrapper: wrapperFor(makeClient()) });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(settingsApi.listFlags).not.toHaveBeenCalled();
  });
});

describe('feature-flag mutations', () => {
  beforeEach(() => useAuthStore.setState({ status: 'authenticated', role: Role.Admin }));
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.clearAllMocks();
  });

  it('create calls the endpoint', async () => {
    (settingsApi.createFlag as Mock).mockResolvedValue(flag({ enabled: true }));
    const { result } = renderHook(() => useCreateFeatureFlag(), {
      wrapper: wrapperFor(makeClient()),
    });
    act(() => result.current.mutate({ key: 'feature.ai.enabled', enabled: true }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(settingsApi.createFlag).toHaveBeenCalledWith({
      key: 'feature.ai.enabled',
      enabled: true,
    });
  });

  it('update calls the endpoint and flips the cached flag (optimistic)', async () => {
    const client = makeClient();
    client.setQueryData(qk.settings.featureFlags(), [flag({ enabled: false })]);
    (settingsApi.updateFlag as Mock).mockResolvedValue(flag({ enabled: true }));

    const { result } = renderHook(() => useUpdateFeatureFlag(), { wrapper: wrapperFor(client) });
    act(() => result.current.mutate({ id: 'f1', payload: { enabled: true } }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(settingsApi.updateFlag).toHaveBeenCalledWith('f1', { enabled: true });
    const cached = client.getQueryData<FeatureFlag[]>(qk.settings.featureFlags());
    expect(cached?.[0]?.enabled).toBe(true);
  });

  it('update rolls back the cache on error', async () => {
    const client = makeClient();
    client.setQueryData(qk.settings.featureFlags(), [flag({ enabled: false })]);
    (settingsApi.updateFlag as Mock).mockRejectedValue(new Error('nope'));

    const { result } = renderHook(() => useUpdateFeatureFlag(), { wrapper: wrapperFor(client) });
    act(() => result.current.mutate({ id: 'f1', payload: { enabled: true } }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    // After rollback + settle the row is back to disabled (no observer → no refetch).
    const cached = client.getQueryData<FeatureFlag[]>(qk.settings.featureFlags());
    expect(cached?.[0]?.enabled).toBe(false);
  });

  it('delete calls the endpoint', async () => {
    (settingsApi.deleteFlag as Mock).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteFeatureFlag(), {
      wrapper: wrapperFor(makeClient()),
    });
    act(() => result.current.mutate({ id: 'f1' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(settingsApi.deleteFlag).toHaveBeenCalledWith('f1');
  });
});

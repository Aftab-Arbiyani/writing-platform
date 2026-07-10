import { NotificationStatus, NotificationType } from '@qalam/shared';
import { act, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { useNotificationParams } from './use-notification-params';

function wrapperFor(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
}

describe('useNotificationParams', () => {
  it('defaults to the full active inbox (no params)', () => {
    const { result } = renderHook(() => useNotificationParams(), {
      wrapper: wrapperFor('/notifications'),
    });
    expect(result.current.status).toBe('all');
    expect(result.current.type).toBe('all');
    expect(result.current.statusParam).toBeUndefined();
    expect(result.current.typeParam).toBeUndefined();
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('resolves status + type from the URL to the api params', () => {
    const { result } = renderHook(() => useNotificationParams(), {
      wrapper: wrapperFor('/notifications?status=unread&type=mention'),
    });
    expect(result.current.status).toBe(NotificationStatus.Unread);
    expect(result.current.type).toBe(NotificationType.Mention);
    expect(result.current.statusParam).toBe(NotificationStatus.Unread);
    expect(result.current.typeParam).toBe(NotificationType.Mention);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('updates the status filter', () => {
    const { result } = renderHook(() => useNotificationParams(), {
      wrapper: wrapperFor('/notifications'),
    });
    act(() => {
      result.current.setStatus(NotificationStatus.Read);
    });
    expect(result.current.status).toBe(NotificationStatus.Read);
    expect(result.current.statusParam).toBe(NotificationStatus.Read);
  });

  it('clears filters back to the active inbox', () => {
    const { result } = renderHook(() => useNotificationParams(), {
      wrapper: wrapperFor('/notifications?status=archived&type=clap'),
    });
    expect(result.current.hasActiveFilters).toBe(true);
    act(() => {
      result.current.clearFilters();
    });
    expect(result.current.status).toBe('all');
    expect(result.current.type).toBe('all');
  });
});

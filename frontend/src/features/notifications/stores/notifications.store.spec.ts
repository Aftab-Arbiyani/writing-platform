import { beforeEach, describe, expect, it } from 'vitest';

import { useNotificationsStore } from './notifications.store';

const reset = (): void => {
  useNotificationsStore.setState({ popoverOpen: false, toastsEnabled: true });
};

describe('useNotificationsStore', () => {
  beforeEach(reset);

  it('opens, closes, and toggles the popover', () => {
    useNotificationsStore.getState().openPopover();
    expect(useNotificationsStore.getState().popoverOpen).toBe(true);
    useNotificationsStore.getState().closePopover();
    expect(useNotificationsStore.getState().popoverOpen).toBe(false);
    useNotificationsStore.getState().togglePopover();
    expect(useNotificationsStore.getState().popoverOpen).toBe(true);
  });

  it('persists the toast preference toggle', () => {
    expect(useNotificationsStore.getState().toastsEnabled).toBe(true);
    useNotificationsStore.getState().setToastsEnabled(false);
    expect(useNotificationsStore.getState().toastsEnabled).toBe(false);
  });
});

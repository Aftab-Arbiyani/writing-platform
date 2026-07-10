import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useInstallPrompt } from './use-install-prompt';

/** Build a stand-in for the browser's non-standard beforeinstallprompt event. */
function installEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe('useInstallPrompt', () => {
  it('starts uninstallable', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
    expect(result.current.installed).toBe(false);
  });

  it('becomes installable after beforeinstallprompt and reports the user choice', async () => {
    const { result } = renderHook(() => useInstallPrompt());

    const event = installEvent('accepted');
    act(() => {
      window.dispatchEvent(event);
    });
    expect(result.current.canInstall).toBe(true);

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(outcome).toBe('accepted');
    expect(result.current.canInstall).toBe(false); // consumed
  });

  it('reports "unavailable" when prompted with nothing deferred', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });
    expect(outcome).toBe('unavailable');
  });

  it('marks installed on appinstalled', () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(installEvent('accepted'));
    });
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(result.current.installed).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });
});

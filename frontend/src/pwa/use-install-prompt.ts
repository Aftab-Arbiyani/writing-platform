import { useCallback, useEffect, useState } from 'react';

/** The non-standard event Chromium fires before offering the native install prompt. */
interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt: () => Promise<void>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export interface InstallPrompt {
  /** True when the browser has offered install and the app is not already installed. */
  canInstall: boolean;
  /** True after the app has been installed this session. */
  installed: boolean;
  /** Show the native install dialog; resolves to the user's choice (or 'unavailable'). */
  promptInstall: () => Promise<InstallOutcome>;
}

/**
 * PWA install-prompt architecture (Epic F10) — the plumbing only; no UI is wired.
 *
 * Captures the browser's `beforeinstallprompt` so a later epic can surface a custom
 * "Install Qalam" affordance at the right moment (instead of the browser's default mini-infobar).
 * `canInstall` flips true when install is available; `promptInstall()` triggers the native dialog;
 * `installed` tracks the `appinstalled` event. Safe to call anywhere — it only listens.
 */
export function useInstallPrompt(): InstallPrompt {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event): void => {
      // Suppress the default mini-infobar so the app controls when/if to prompt.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = (): void => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferred) return 'unavailable';
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome;
  }, [deferred]);

  return { canInstall: deferred !== null && !installed, installed, promptInstall };
}

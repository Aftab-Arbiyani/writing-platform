import { App } from 'antd';
import { useMemo } from 'react';

export interface ToastOptions {
  description?: string;
  /** Seconds before auto-dismiss; defaults per variant (docs/07 §7.9). */
  duration?: number;
}

export interface ToastApi {
  neutral: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
}

/**
 * Toast API wrapping AntD `notification` via the `App` context (docs/07 §7.9). Placement
 * is bottom inline-start (desktop). Requires an `<App>` provider above (see app providers).
 * Toasts never carry critical-path info — anything requiring action beyond undo is inline UI.
 */
export function useToast(): ToastApi {
  const { notification } = App.useApp();
  return useMemo<ToastApi>(
    () => ({
      neutral: (message, o) =>
        notification.open({
          message,
          description: o?.description,
          placement: 'bottomLeft',
          duration: o?.duration ?? 3,
        }),
      success: (message, o) =>
        notification.success({
          message,
          description: o?.description,
          placement: 'bottomLeft',
          duration: o?.duration ?? 3,
        }),
      error: (message, o) =>
        notification.error({
          message,
          description: o?.description,
          placement: 'bottomLeft',
          duration: o?.duration ?? 5,
        }),
      warning: (message, o) =>
        notification.warning({
          message,
          description: o?.description,
          placement: 'bottomLeft',
          duration: o?.duration ?? 4,
        }),
      info: (message, o) =>
        notification.info({
          message,
          description: o?.description,
          placement: 'bottomLeft',
          duration: o?.duration ?? 3,
        }),
    }),
    [notification],
  );
}

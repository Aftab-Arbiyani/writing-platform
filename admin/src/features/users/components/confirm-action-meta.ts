import type { UserAction } from '../types/users.types';

/** Copy + behaviour per confirmable action (destructive → confirm + consequences). */
export interface ActionMeta {
  title: (username: string) => string;
  confirmLabel: string;
  danger: boolean;
  consequences: string[];
  reason: boolean;
}

export const ACTION_META: Record<
  Extract<UserAction, 'suspend' | 'deactivate' | 'reset-password' | 'force-logout'>,
  ActionMeta
> = {
  suspend: {
    title: (u) => `Suspend @${u}?`,
    confirmLabel: 'Suspend',
    danger: true,
    consequences: [
      'All active sessions are revoked immediately.',
      'The user cannot sign in until the suspension is lifted.',
      'Their published content stays visible.',
    ],
    reason: true,
  },
  deactivate: {
    title: (u) => `Deactivate @${u}?`,
    confirmLabel: 'Deactivate',
    danger: true,
    consequences: [
      'The account is disabled and signed out of every device.',
      'The user cannot sign in until the account is reactivated.',
    ],
    reason: true,
  },
  'reset-password': {
    title: () => 'Send a password reset?',
    confirmLabel: 'Send reset email',
    danger: false,
    consequences: [
      'A password-reset email is sent to the user.',
      'Their current password keeps working until they complete the reset.',
    ],
    reason: false,
  },
  'force-logout': {
    title: (u) => `Force logout @${u}?`,
    confirmLabel: 'Force logout',
    danger: true,
    consequences: [
      'Every active session is revoked immediately (session-version bump).',
      'The user must sign in again on all devices.',
    ],
    reason: false,
  },
};

export type ConfirmableAction = keyof typeof ACTION_META;

/** Whether an action requires the confirmation dialog (vs. running immediately). */
export function needsConfirmation(action: UserAction): action is ConfirmableAction {
  return action in ACTION_META;
}

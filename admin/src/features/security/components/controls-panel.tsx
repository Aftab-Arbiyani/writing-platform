import { QCard, QTag } from '@qalam/ui';
import { ShieldCheck } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * Renders the Security Platform's active controls (`status.controls`) as a set of badges. Each
 * control is an always-on platform guarantee (default-deny authz, rate limiting, field encryption,
 * immutable audit, …), so they read as "success" pills. Unknown control keys fall back to a
 * humanized label so a new backend control shows up without a frontend change.
 */

/** Friendly labels for known control keys (backend `SecurityPlatformStatus.controls`). */
const CONTROL_LABELS: Record<string, string> = {
  'default-deny-authz': 'Default-deny authorization',
  'global-rate-limit': 'Global rate limiting',
  'refresh-family-reuse-detection': 'Refresh reuse detection',
  'session-version-revocation': 'Session revocation',
  'account-lockout': 'Account lockout',
  'threat-detection': 'Threat detection',
  'field-encryption': 'Field encryption',
  'immutable-audit': 'Immutable audit trail',
  'input-validation': 'Input validation',
  'security-headers': 'Security headers',
  'idempotency-replay-protection': 'Idempotency / replay protection',
};

/** Title-case a dash-delimited control key for controls the label map doesn't cover. */
function humanize(key: string): string {
  return key
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export interface ControlsPanelProps {
  controls: string[];
}

export function ControlsPanel({ controls }: ControlsPanelProps): ReactElement {
  return (
    <QCard as="section" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} strokeWidth={1.75} className="text-ink-secondary" aria-hidden />
        <h2 className="text-base font-semibold text-ink">Platform controls</h2>
      </div>
      <ul className="flex flex-wrap gap-2">
        {controls.map((control) => (
          <li key={control}>
            <QTag color="success" size="md">
              {CONTROL_LABELS[control] ?? humanize(control)}
            </QTag>
          </li>
        ))}
      </ul>
    </QCard>
  );
}

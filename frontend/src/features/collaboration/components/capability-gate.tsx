import type { PolicyActionCode } from '@qalam/shared';
import type { ReactElement, ReactNode } from 'react';

import { useCapability } from '../hooks/use-capabilities';

export interface CapabilityGateProps {
  storyId: string;
  /** The policy action this affordance performs, e.g. `POLICY_ACTIONS.StoryInvite`. */
  action: PolicyActionCode | string;
  /** Rendered only when the SERVER says this viewer may perform the action. */
  children: ReactNode;
  /** Optional stand-in when denied — omit to render nothing (the usual choice). */
  fallback?: ReactNode;
}

/**
 * Renders its children only when the Policy Engine allows `action` on this story (AF6, W3a —
 * docs/49 §3). The web counterpart of mobile's `CapabilityGate`, and the same shape as the
 * monetization `PremiumGate`.
 *
 * **Fails closed.** Loading, errored, and "the map doesn't mention this action" all render the
 * fallback. Being briefly too strict costs a control that appears a moment late; being too
 * permissive shows a control that then fails, which reads as a broken app. The server re-checks
 * every write regardless — this gate is UX, never the security boundary.
 */
export function CapabilityGate({
  storyId,
  action,
  children,
  fallback = null,
}: CapabilityGateProps): ReactElement | null {
  const { allowed } = useCapability(storyId);
  return allowed(action) ? <>{children}</> : <>{fallback}</>;
}

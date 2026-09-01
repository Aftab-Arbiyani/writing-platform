import { QErrorState } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';

import { LoadingState } from '@/components/loading-state';
import { getErrorMessage, getRequestId } from '@/lib/errors';

/**
 * Per-section state wrapper for any admin view composing several independent queries: a skeleton
 * while a query first loads, the house error panel (message + requestId + retry) on failure,
 * otherwise the section body. It keeps one failing read from blanking a whole page.
 *
 * `isLoading` is React Query's FIRST-load flag, so a background refetch keeps content on screen.
 *
 * ## Why this lives here (A3-4, docs/48 §3.22b)
 *
 * It was copied into **five** features — security, system, operations, monetization, ai — because a
 * feature may not import another feature (`features/README.md`, the `rm -rf` deletability rule), and
 * each copy dutifully recorded that lifting it to `src/components/` was "not this row's to make".
 * The fifth copy's own docblock said the quiet part: *"five is the number at which the refactor stops
 * being hypothetical."*
 *
 * The same README names the escape hatch this uses: **"Cross-cutting pieces move up to
 * `src/components/`."** So this is the sanctioned move, not an exception to the rule — the rule
 * forbids feature→feature imports, and app-level is where a shared piece is supposed to go.
 *
 * The consolidation was safe to make mechanically, and that was checked rather than assumed: all
 * five copies were **byte-identical below the docblock** (same MD5 after stripping comments). Only
 * the prose differed, describing whichever slice happened to be writing it.
 */
export interface AsyncSectionProps {
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  loadingRows?: number;
  children: ReactNode;
}

export function AsyncSection({
  isLoading,
  error,
  onRetry,
  loadingRows = 4,
  children,
}: AsyncSectionProps): ReactElement {
  if (error) {
    return (
      <QErrorState
        description={getErrorMessage(error)}
        requestId={getRequestId(error)}
        onRetry={onRetry}
        minHeight={200}
      />
    );
  }
  if (isLoading) {
    return <LoadingState variant="rows" rows={loadingRows} />;
  }
  return <>{children}</>;
}

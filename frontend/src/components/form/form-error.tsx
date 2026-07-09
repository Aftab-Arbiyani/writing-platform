import { TriangleAlert } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * Form-level error banner for code-only server errors (docs/33 §4) — e.g.
 * `AUTH_INVALID_CREDENTIALS` mapped to `errors.root.server`. Announced politely; never used
 * for field-level errors (those render inline under their field).
 */
export function FormError({ message }: { message?: string }): ReactElement | null {
  if (!message) return null;
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/5 px-3 py-2.5 text-sm text-danger"
    >
      <TriangleAlert size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

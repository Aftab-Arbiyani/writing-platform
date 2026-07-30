import { useId } from 'react';

export interface FieldA11y {
  /** id for the control; the label's htmlFor points here. */
  id: string;
  /** id of the hint/error message, or undefined when there is none. */
  describedBy: string | undefined;
  invalid: boolean;
}

/** Stable a11y ids for a labelled field (docs/07 §7.2). */
export function useFieldA11y(error?: string, hint?: string): FieldA11y {
  const base = useId();
  const hasMessage = Boolean(error ?? hint);
  return {
    id: `${base}-control`,
    describedBy: hasMessage ? `${base}-message` : undefined,
    invalid: Boolean(error),
  };
}

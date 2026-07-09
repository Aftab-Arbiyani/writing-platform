import { Input, type InputRef } from 'antd';
import { forwardRef, type ComponentProps, type ReactElement } from 'react';

import { FieldShell } from './field.js';
import { useFieldA11y } from './use-field-a11y.js';

export interface QInputProps extends Omit<ComponentProps<typeof Input>, 'size' | 'status' | 'id'> {
  label?: string;
  hint?: string;
  error?: string;
  /** 40 / 48 px (docs/07 §7.2). */
  size?: 'md' | 'lg';
}

/**
 * Labelled text input wrapping AntD `Input` with hint/error + a11y wiring. `forwardRef` so
 * form libraries can bind and focus it (RHF `Controller` / `setFocus`) — the forwarded ref is
 * AntD's `InputRef` (exposes `.focus()`), not the raw DOM element.
 */
export const QInput = forwardRef<InputRef, QInputProps>(function QInput(
  { label, hint, error, size = 'md', ...rest },
  ref,
): ReactElement {
  const a11y = useFieldA11y(error, hint);
  return (
    <FieldShell label={label} hint={hint} error={error} a11y={a11y}>
      <Input
        ref={ref}
        id={a11y.id}
        size={size === 'lg' ? 'large' : 'middle'}
        status={error ? 'error' : undefined}
        aria-invalid={a11y.invalid}
        aria-describedby={a11y.describedBy}
        {...rest}
      />
    </FieldShell>
  );
});

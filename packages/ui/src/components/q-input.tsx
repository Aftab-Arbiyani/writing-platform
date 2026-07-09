import { Input } from 'antd';
import type { ComponentProps, ReactElement } from 'react';

import { FieldShell } from './field.js';
import { useFieldA11y } from './use-field-a11y.js';

export interface QInputProps extends Omit<ComponentProps<typeof Input>, 'size' | 'status' | 'id'> {
  label?: string;
  hint?: string;
  error?: string;
  /** 40 / 48 px (docs/07 §7.2). */
  size?: 'md' | 'lg';
}

/** Labelled text input wrapping AntD `Input` with hint/error + a11y wiring. */
export function QInput({ label, hint, error, size = 'md', ...rest }: QInputProps): ReactElement {
  const a11y = useFieldA11y(error, hint);
  return (
    <FieldShell label={label} hint={hint} error={error} a11y={a11y}>
      <Input
        id={a11y.id}
        size={size === 'lg' ? 'large' : 'middle'}
        status={error ? 'error' : undefined}
        aria-invalid={a11y.invalid}
        aria-describedby={a11y.describedBy}
        {...rest}
      />
    </FieldShell>
  );
}

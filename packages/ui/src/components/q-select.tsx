import { Select } from 'antd';
import type { ComponentProps, ReactElement } from 'react';

import { FieldShell } from './field.js';
import { useFieldA11y } from './use-field-a11y.js';

export interface QSelectProps extends Omit<ComponentProps<typeof Select>, 'size' | 'status'> {
  label?: string;
  hint?: string;
  error?: string;
  size?: 'md' | 'lg';
}

/**
 * Labelled select wrapping AntD `Select` (its virtual list + keyboard model are why we
 * wrap rather than build — docs/07 §7.2). Options are passed through via props.
 */
export function QSelect({ label, hint, error, size = 'md', ...rest }: QSelectProps): ReactElement {
  const a11y = useFieldA11y(error, hint);
  return (
    <FieldShell label={label} hint={hint} error={error} a11y={a11y}>
      <Select
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

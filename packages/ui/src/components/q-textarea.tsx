import { Input } from 'antd';
import type { ComponentProps, ReactElement } from 'react';

import { FieldShell } from './field.js';
import { useFieldA11y } from './use-field-a11y.js';

const { TextArea } = Input;

export interface QTextAreaProps extends Omit<ComponentProps<typeof TextArea>, 'status' | 'id'> {
  label?: string;
  hint?: string;
  error?: string;
}

/**
 * Labelled multi-line input wrapping AntD `Input.TextArea`. User-content fields default
 * `dir="auto"` so an Urdu title right-aligns as typed (docs/07 §7.2).
 */
export function QTextArea({ label, hint, error, ...rest }: QTextAreaProps): ReactElement {
  const a11y = useFieldA11y(error, hint);
  return (
    <FieldShell label={label} hint={hint} error={error} a11y={a11y}>
      <TextArea
        id={a11y.id}
        dir="auto"
        status={error ? 'error' : undefined}
        aria-invalid={a11y.invalid}
        aria-describedby={a11y.describedBy}
        {...rest}
      />
    </FieldShell>
  );
}

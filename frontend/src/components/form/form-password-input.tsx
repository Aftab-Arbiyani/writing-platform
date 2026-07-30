import { QInput, type QInputProps } from '@qalam/ui';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

/**
 * RHF-bound password input with a visibility toggle (docs/33 §5). The eye button flips the
 * input `type` between `password` and `text`; it is a real `<button>` (keyboard-reachable,
 * `aria-pressed`) placed as the input suffix. `autoComplete` defaults to `current-password` —
 * pass `new-password` on register/reset so browsers offer to generate/save correctly.
 */
export interface FormPasswordInputProps<T extends FieldValues> extends Omit<
  QInputProps,
  'name' | 'value' | 'onChange' | 'onBlur' | 'status' | 'error' | 'type' | 'suffix'
> {
  name: FieldPath<T>;
  control: Control<T>;
}

export function FormPasswordInput<T extends FieldValues>({
  name,
  control,
  autoComplete = 'current-password',
  ...rest
}: FormPasswordInputProps<T>) {
  const [visible, setVisible] = useState(false);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <QInput
          {...rest}
          ref={field.ref}
          name={field.name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={(field.value as string | undefined) ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
          suffix={
            <button
              type="button"
              onClick={() => {
                setVisible((v) => !v);
              }}
              aria-label={visible ? 'Hide password' : 'Show password'}
              aria-pressed={visible}
              className="flex items-center text-ink-muted transition-colors hover:text-ink"
            >
              {visible ? (
                <EyeOff size={18} strokeWidth={1.5} aria-hidden />
              ) : (
                <Eye size={18} strokeWidth={1.5} aria-hidden />
              )}
            </button>
          }
        />
      )}
    />
  );
}

import { QInput, type QInputProps } from '@qalam/ui';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

/**
 * RHF-bound text input wrapping `QInput` (docs/33 §5). Binds via `Controller` (AntD inputs are
 * controlled) so value/onChange/onBlur and the focus ref all flow through React Hook Form;
 * the field's error message renders inline with `aria-invalid` + `aria-describedby` from the
 * primitive. `dir="auto"` may be passed through for user-content fields.
 */
export interface FormInputProps<T extends FieldValues> extends Omit<
  QInputProps,
  'name' | 'value' | 'onChange' | 'onBlur' | 'status' | 'error'
> {
  name: FieldPath<T>;
  control: Control<T>;
}

export function FormInput<T extends FieldValues>({ name, control, ...rest }: FormInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <QInput
          {...rest}
          ref={field.ref}
          name={field.name}
          value={(field.value as string | undefined) ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}

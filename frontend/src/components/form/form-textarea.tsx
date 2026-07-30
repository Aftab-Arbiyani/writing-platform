import { QTextArea, type QTextAreaProps } from '@qalam/ui';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

/**
 * RHF-bound textarea wrapping `QTextArea` (docs/33 §5). Used for user-content fields (e.g. bio);
 * pass `showCount` + `maxLength` for a live counter against the shared limit. `dir="auto"` is the
 * primitive's default so mixed LTR/RTL content aligns as typed. AntD's TextArea has no forwardable
 * ref, so this binds value/onChange/onBlur only (no focus ref).
 */
export interface FormTextAreaProps<T extends FieldValues> extends Omit<
  QTextAreaProps,
  'name' | 'value' | 'onChange' | 'onBlur' | 'status' | 'error'
> {
  name: FieldPath<T>;
  control: Control<T>;
}

export function FormTextArea<T extends FieldValues>({
  name,
  control,
  ...rest
}: FormTextAreaProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <QTextArea
          {...rest}
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

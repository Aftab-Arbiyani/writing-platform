import { Checkbox } from 'antd';
import type { ReactNode } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

/**
 * RHF-bound checkbox wrapping AntD `Checkbox` (themed via the token ConfigProvider). Used for
 * "Remember me" and "Accept terms". The error (e.g. terms not accepted) renders below with
 * `role="alert"` so it is announced.
 */
export interface FormCheckboxProps<T extends FieldValues> {
  name: FieldPath<T>;
  control: Control<T>;
  children: ReactNode;
}

export function FormCheckbox<T extends FieldValues>({
  name,
  control,
  children,
}: FormCheckboxProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-1">
          <Checkbox
            checked={Boolean(field.value)}
            onChange={(e) => {
              field.onChange(e.target.checked);
            }}
            onBlur={field.onBlur}
          >
            <span className="text-sm text-ink-secondary">{children}</span>
          </Checkbox>
          {fieldState.error ? (
            <span role="alert" className="text-xs text-danger">
              {fieldState.error.message}
            </span>
          ) : null}
        </div>
      )}
    />
  );
}

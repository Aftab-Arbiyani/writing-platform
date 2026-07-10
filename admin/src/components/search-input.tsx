import { QSearch } from '@qalam/ui';
import type { ChangeEvent, ReactElement } from 'react';

/**
 * Controlled search field for admin toolbars — wraps the shared `QSearch` and exposes a plain
 * string `onChange` (instead of the raw DOM event). Debouncing is the caller's concern (pair with
 * `useDebounce` in a feature). `allowClear` on by default for quick reset.
 */
export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  onSubmit?: (value: string) => void;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  ariaLabel,
  onSubmit,
}: SearchInputProps): ReactElement {
  return (
    <QSearch
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      allowClear
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      onPressEnter={onSubmit ? () => onSubmit(value) : undefined}
    />
  );
}

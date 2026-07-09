import { Input } from 'antd';
import { Search as SearchIcon } from 'lucide-react';
import type { ComponentProps, ReactElement } from 'react';

export type QSearchProps = Omit<ComponentProps<typeof Input>, 'prefix' | 'type'>;

/**
 * Search field: AntD `Input` + a leading lucide search glyph, clear button, and
 * `role="searchbox"` (docs/07 §7.2). The `/`-to-focus shortcut is wired by the app shell.
 */
export function QSearch(props: QSearchProps): ReactElement {
  return (
    <Input
      role="searchbox"
      allowClear
      prefix={<SearchIcon size={16} strokeWidth={1.5} aria-hidden />}
      {...props}
    />
  );
}

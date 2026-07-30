import { QButton } from '@qalam/ui';
import { Popover, Radio } from 'antd';
import { Settings2 } from 'lucide-react';
import { useId, useState, type ReactElement } from 'react';

import { useTheme } from '@/hooks/use-theme';

import {
  useReaderPreferences,
  type ReaderLineSpacing,
  type ReaderTextSize,
  type ReaderWidth,
} from '../stores/reader-preferences.store';

/**
 * Reading settings (W1, docs/45 §4.1) — the web analog of mobile's `reader_settings_sheet`:
 * reachable without leaving the piece, and every change applies live to the column behind it.
 *
 * Text size, line spacing and column width are device preferences owned by this feature's store;
 * **theme is not** — it is app-wide state already owned by `stores/theme.store`, so this panel
 * drives that store rather than keeping a second copy. Controls are AntD `Radio.Group` in button
 * mode: real radios, so each row is one arrow-key-navigable set rather than a row of unrelated
 * toggle buttons (docs/07 §9).
 *
 * The `radiogroup` role lives on a wrapper rather than on `Radio.Group` itself: AntD forwards
 * `aria-*` and `data-*` to the group element but drops `role`, so a role passed to it silently
 * disappears — the radios would be a labelled set with no group to belong to. The wrapper takes
 * its accessible name from the visible row label via `aria-labelledby`, so the name a screen
 * reader announces is the one on screen.
 */
function Row<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}): ReactElement {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm text-ink-secondary">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId}>
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          size="small"
          value={value}
          onChange={(event) => {
            onChange(event.target.value as T);
          }}
          options={options}
        />
      </div>
    </div>
  );
}

export function ReaderSettings(): ReactElement {
  const [open, setOpen] = useState(false);
  const { mode, setMode } = useTheme();
  const { textSize, lineSpacing, width, setTextSize, setLineSpacing, setWidth } =
    useReaderPreferences();

  const content = (
    <div className="flex w-60 flex-col gap-4 py-1">
      <Row<ReaderTextSize>
        label="Text size"
        value={textSize}
        onChange={setTextSize}
        options={[
          { value: 'sm', label: 'S' },
          { value: 'md', label: 'M' },
          { value: 'lg', label: 'L' },
        ]}
      />
      <Row<ReaderLineSpacing>
        label="Line spacing"
        value={lineSpacing}
        onChange={setLineSpacing}
        options={[
          { value: 'compact', label: 'Compact' },
          { value: 'normal', label: 'Normal' },
          { value: 'relaxed', label: 'Relaxed' },
        ]}
      />
      <Row<ReaderWidth>
        label="Column width"
        value={width}
        onChange={setWidth}
        options={[
          { value: 'narrow', label: 'Narrow' },
          { value: 'medium', label: 'Medium' },
          { value: 'wide', label: 'Wide' },
        ]}
      />
      <Row<'light' | 'dark' | 'system'>
        label="Theme"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'Auto' },
        ]}
      />
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      title="Reading settings"
      content={content}
    >
      <QButton
        variant="ghost"
        size="sm"
        icon={Settings2}
        aria-label="Reading settings"
        aria-expanded={open}
      />
    </Popover>
  );
}

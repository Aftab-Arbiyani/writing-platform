import { Spin } from 'antd';
import type { ComponentProps, ReactElement } from 'react';

export type QSpinnerProps = ComponentProps<typeof Spin>;

/** Inline/overlay spinner wrapping AntD `Spin`. For full-area loading use `QPageLoader`. */
export function QSpinner(props: QSpinnerProps): ReactElement {
  return <Spin {...props} />;
}

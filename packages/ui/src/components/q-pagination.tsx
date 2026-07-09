import { Pagination } from 'antd';
import type { ComponentProps, ReactElement } from 'react';

export type QPaginationProps = ComponentProps<typeof Pagination>;

/**
 * Offset pagination wrapping AntD `Pagination` — admin tables / analytics only (reader
 * feeds use cursor pagination, docs/05 §5). Token-themed via ConfigProvider.
 */
export function QPagination(props: QPaginationProps): ReactElement {
  return <Pagination {...props} />;
}

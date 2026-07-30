import { cn } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';

/**
 * Consistent max-width + vertical rhythm wrapper for admin page content, inside the shell's content
 * area. Wide by default (admin tables need room); pages compose `PageHeader` + content inside it.
 */
export interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps): ReactElement {
  return (
    <div className={cn('mx-auto flex w-full max-w-[1600px] flex-col gap-6', className)}>
      {children}
    </div>
  );
}

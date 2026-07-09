import { QEmptyState, QPageContainer } from '@qalam/ui';
import { PenLine } from 'lucide-react';
import type { ReactElement } from 'react';

import { usePageTitle } from '@/hooks/use-page-title';

export interface PlaceholderProps {
  title: string;
  description?: string;
}

/** Generic placeholder for shell routes whose feature ships in a later epic (F1 has no business pages). */
export function Placeholder({ title, description }: PlaceholderProps): ReactElement {
  usePageTitle(title);
  return (
    <QPageContainer className="py-16">
      <QEmptyState
        icon={PenLine}
        title={title}
        description={
          description ?? 'This surface arrives in a later epic — the foundation is ready for it.'
        }
      />
    </QPageContainer>
  );
}

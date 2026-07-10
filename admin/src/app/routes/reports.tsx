import type { ReactElement } from 'react';

import { SectionPlaceholder } from '@/app/pages/section-placeholder';

/** Lazy route module (docs/11 §9) — the Reports section (placeholder in A1; code-split). */
export function Component(): ReactElement {
  return <SectionPlaceholder title="Reports" description="The moderation queue." />;
}

import type { ReactElement } from 'react';

import { Placeholder } from '@/app/pages/placeholder';

export function Component(): ReactElement {
  return (
    <Placeholder
      title="Search"
      description="Writer, piece, tag, genre, and language search — arriving in the search epic."
    />
  );
}

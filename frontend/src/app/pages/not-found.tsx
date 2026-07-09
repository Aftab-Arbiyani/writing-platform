import { QButton, QEmptyState, QPageContainer } from '@qalam/ui';
import { Compass } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

/**
 * 404 — full chrome, offers an exit (docs/11 §6). Renders inside RootLayout's <main>, so it
 * gets the app shell. Also the fallback for private/invisible resources (existence not leaked).
 */
export function NotFound(): ReactElement {
  const navigate = useNavigate();
  usePageTitle('Page not found');
  return (
    <QPageContainer className="py-16">
      <QEmptyState
        icon={Compass}
        title="This page has wandered off."
        description="The link may be broken, or the piece may have been unpublished."
        action={
          <QButton
            variant="primary"
            onClick={() => {
              void navigate(ROUTES.feed);
            }}
          >
            Back to the feed
          </QButton>
        }
      />
    </QPageContainer>
  );
}

import { QButton, QPageContainer } from '@qalam/ui';
import { ArrowRight, PenLine } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { Seo } from '@/components/seo';
import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';
import { websiteJsonLd } from '@/lib/seo';

/** Landing (visitor). Renders inside RootLayout chrome. Feature epics flesh out the hero. */
export function Landing(): ReactElement {
  const navigate = useNavigate();
  usePageTitle();
  return (
    <QPageContainer className="flex flex-col items-center gap-4 py-24 text-center">
      <Seo
        description="A premium writing sanctuary for Hindi and Urdu writers first, the world next. Write, publish, and read in a calm, distraction-free space."
        canonicalPath="/"
        jsonLd={websiteJsonLd()}
      />
      <h1 className="font-serif text-4xl font-semibold text-ink sm:text-5xl">Qalam</h1>
      <p className="text-xl text-ink-secondary">A premium writing sanctuary.</p>
      <p className="max-w-[46ch] text-sm text-ink-muted">
        Warm paper and ink for Hindi and Urdu writers first, the world next. The foundation is in
        place; the writing begins soon.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <QButton
          variant="primary"
          size="lg"
          icon={PenLine}
          onClick={() => {
            void navigate(ROUTES.write);
          }}
        >
          Start writing
        </QButton>
        <QButton
          variant="secondary"
          size="lg"
          icon={ArrowRight}
          iconPosition="end"
          onClick={() => {
            void navigate(ROUTES.feed);
          }}
        >
          Explore the feed
        </QButton>
      </div>
    </QPageContainer>
  );
}

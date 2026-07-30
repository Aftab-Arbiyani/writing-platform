import { QButton, QCard, QTag } from '@qalam/ui';
import { PenLine } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { RouterLink } from '@/components/router-link';
import { feedPath, ROUTES } from '@/lib/routes';

import { useTrendingGenres, useTrendingTags } from '../hooks/use-discover';

/**
 * The feed's right rail (docs/06 §3.1) — the optional 320px secondary column, shown only at
 * `lg`+ (the page hides it below that; its content lives in the Discover tab per docs/06 §8).
 * A writing shortcut + data-backed "Trending" highlights whose chips deep-link into the Latest
 * feed with a tag/genre filter applied (functional, in-scope). Writers-to-follow is omitted:
 * it needs follow interaction + profile pages, both out of F3 scope.
 */
export function FeedRail(): ReactElement {
  const navigate = useNavigate();
  const tags = useTrendingTags();
  const genres = useTrendingGenres();

  return (
    <div className="sticky top-20 flex flex-col gap-6">
      <QCard padding="lg" className="flex flex-col gap-3">
        <h2 className="font-serif text-lg font-semibold text-ink">Have something to say?</h2>
        <p className="text-sm text-ink-secondary">Your next piece starts with a single line.</p>
        <QButton
          variant="primary"
          icon={PenLine}
          onClick={() => {
            void navigate(ROUTES.write);
          }}
        >
          Start writing
        </QButton>
      </QCard>

      {genres.data && genres.data.length > 0 ? (
        <section aria-labelledby="rail-genres">
          <h2 id="rail-genres" className="mb-2 text-sm font-semibold text-ink">
            Trending genres
          </h2>
          <div className="flex flex-wrap gap-2">
            {genres.data.map((g) => (
              <QTag
                key={g.slug}
                color="accent"
                href={feedPath({ tab: 'latest', genre: g.slug })}
                linkComponent={RouterLink}
              >
                {g.name}
              </QTag>
            ))}
          </div>
        </section>
      ) : null}

      {tags.data && tags.data.length > 0 ? (
        <section aria-labelledby="rail-tags">
          <h2 id="rail-tags" className="mb-2 text-sm font-semibold text-ink">
            Trending tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {tags.data.map((t) => (
              <QTag
                key={t.slug}
                color="neutral"
                href={feedPath({ tab: 'latest', tag: t.slug })}
                linkComponent={RouterLink}
              >
                #{t.name}
              </QTag>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

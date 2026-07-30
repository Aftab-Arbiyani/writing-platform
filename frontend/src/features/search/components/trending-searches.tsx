import { QAvatar, QSkeleton, QTag } from '@qalam/ui';
import { Flame, TrendingUp } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { RouterLink } from '@/components/router-link';
import { formatCount } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { feedPath, profilePath } from '@/lib/routes';

import { useTrending } from '../hooks/use-trending';
import { SearchChip } from './search-chip';

/**
 * Trending searches (docs/06 §3.6, §8) — popular keywords (re-run a query), tags/genres
 * (deep-link into the filtered Latest feed, the documented `/tag`·`/genre` behavior — reusing
 * F3), and popular writers (link to their profile). Public + cached. Renders a compact
 * "Nothing trending" line when the snapshot is empty, never a blank block.
 */
export function TrendingSearches({ onRun }: { onRun: (query: string) => void }): ReactElement {
  const { data, isLoading, isError } = useTrending();

  if (isLoading) {
    return (
      <section aria-label="Trending" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">Trending now</h2>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <QSkeleton key={i} variant="rect" width={96} height={40} radius="full" />
          ))}
        </div>
      </section>
    );
  }

  const keywords = data?.keywords ?? [];
  const tags = data?.tags ?? [];
  const genres = data?.genres ?? [];
  const writers = data?.writers ?? [];
  const isEmpty =
    keywords.length === 0 && tags.length === 0 && genres.length === 0 && writers.length === 0;

  if (isError || isEmpty) {
    return (
      <section aria-label="Trending" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">Trending now</h2>
        <p className="text-sm text-ink-muted">
          Nothing trending right now — search for a word, a poet, or a theme.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {keywords.length > 0 ? (
        <section aria-labelledby="trending-keywords" className="flex flex-col gap-3">
          <h2
            id="trending-keywords"
            className="flex items-center gap-1.5 text-sm font-semibold text-ink"
          >
            <Flame size={16} strokeWidth={1.75} className="text-accent" aria-hidden />
            Trending now
          </h2>
          <ul className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <li key={k.keyword}>
                <SearchChip
                  icon={TrendingUp}
                  label={k.keyword}
                  onClick={() => {
                    onRun(k.keyword);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {genres.length > 0 ? (
        <section aria-labelledby="trending-genres" className="flex flex-col gap-2">
          <h2 id="trending-genres" className="text-sm font-semibold text-ink">
            Popular genres
          </h2>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
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

      {tags.length > 0 ? (
        <section aria-labelledby="trending-tags" className="flex flex-col gap-2">
          <h2 id="trending-tags" className="text-sm font-semibold text-ink">
            Popular tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
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

      {writers.length > 0 ? (
        <section aria-labelledby="trending-writers" className="flex flex-col gap-3">
          <h2 id="trending-writers" className="text-sm font-semibold text-ink">
            Writers to read
          </h2>
          <ul className="flex flex-col gap-1">
            {writers.map((w) => {
              const displayName = w.penName ?? `@${w.username}`;
              return (
                <li key={w.username}>
                  <Link
                    to={profilePath(w.username)}
                    className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-raised"
                  >
                    <QAvatar size={36} src={mediaUrl(w.avatarKey)} name={displayName} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{displayName}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        @{w.username} · {formatCount(w.followersCount)} followers
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

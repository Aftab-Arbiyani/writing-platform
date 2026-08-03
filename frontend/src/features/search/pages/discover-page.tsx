import { QButton, QEmptyState, QErrorState } from '@qalam/ui';
import {
  BookOpen,
  Compass,
  Flame,
  Hash,
  Languages,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { Seo } from '@/components/seo';
import { usePageTitle } from '@/hooks/use-page-title';
import { feedPath, ROUTES } from '@/lib/routes';

import {
  DiscoverSection,
  PiecesGrid,
  SeeAllLink,
  TaxonomyCloud,
  WritersGrid,
} from '../components/discover-sections';
import { RecommendationShelf } from '../components/recommendation-shelf';
import {
  useDiscoverGenres,
  useDiscoverLanguages,
  useDiscoverPieces,
  useDiscoverTags,
  useDiscoverWriters,
  useTrendingPieces,
} from '../hooks/use-discover';

/**
 * The Discovery screen (docs/06 §8, docs/11 §10) — public editorial surfaces that help readers
 * find writers and writing without a query: featured + trending pieces, featured + popular
 * writers, and the popular genres/tags/languages clouds (each chip deep-links into the filtered
 * Latest feed, reusing F3). Every section is a real backend read (`/discover/*`, `/feed/trending`)
 * — never mock data — and hides itself when its slice is empty, so the page never shows a hollow
 * heading. All content-loaded errors degrade gracefully; a total failure shows one retry panel.
 *
 * **W5 adds two AF4 recommendation shelves above the editorial ones** (docs/45 §4, docs/36). They are
 * additive and self-silencing: `feature.ai.recommendations` ships dark and every AF4 route needs
 * `ai.use`, so a signed-out reader and an un-flagged deployment see exactly the page they saw before.
 *
 * **Only two shelves, where mobile's dedicated AI screen has five.** Mobile shows trending, for-you,
 * continue-reading, authors and genres; on the web, three of those would be duplicates rather than
 * additions — `RecommendationKind.Trending` runs the same `TrendingService` as "Trending now" below,
 * `Authors` the same `DiscoveryService.getWriters` as "Writers to follow", and `Genres` the same
 * `getTrendingGenres` as "Popular genres". The recommender's versions differ only by carrying a
 * reason, so shipping them here would print the same rows twice on one page. The two that add
 * something — a for-you set and a pick-up-next set — are the ones rendered. Recorded as an
 * arrangement difference in [48 §4.1], not a parity gap.
 */
export function DiscoverPage(): ReactElement {
  usePageTitle('Discover');
  const navigate = useNavigate();

  const featuredPieces = useDiscoverPieces('featured');
  const trendingPieces = useTrendingPieces();
  const featuredWriters = useDiscoverWriters('featured');
  const popularWriters = useDiscoverWriters('popular');
  const genres = useDiscoverGenres();
  const tags = useDiscoverTags();
  const languages = useDiscoverLanguages();

  const sections = [
    featuredPieces,
    trendingPieces,
    featuredWriters,
    popularWriters,
    genres,
    tags,
    languages,
  ];
  const anyLoading = sections.some((s) => s.isLoading);
  const allEmpty = sections.every((s) => !s.data || s.data.length === 0);
  const anyError = sections.some((s) => s.isError);

  const has = <T,>(data: T[] | undefined, isLoading: boolean): boolean =>
    isLoading || (data !== undefined && data.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-10 px-4 py-6 sm:px-6">
      <Seo
        title="Discover"
        description="New voices, trending writing, and the themes readers are drawn to right now on Qalam."
        canonicalPath={ROUTES.discover}
      />
      <header className="flex flex-col gap-3">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold text-ink sm:text-3xl">
          <Compass size={26} strokeWidth={1.75} className="text-accent" aria-hidden />
          Discover
        </h1>
        <p className="max-w-[60ch] text-ink-secondary">
          New voices, trending writing, and the themes readers are drawn to right now.
        </p>
        <div>
          <QButton
            variant="secondary"
            icon={Search}
            onClick={() => {
              void navigate(ROUTES.search);
            }}
          >
            Search everything
          </QButton>
        </div>
      </header>

      {!anyLoading && allEmpty ? (
        anyError ? (
          <QErrorState
            title="Couldn't load discovery."
            description="Something went wrong reaching our shelves. Please try again."
            onRetry={() => {
              sections.forEach((s) => void s.refetch());
            }}
          />
        ) : (
          <QEmptyState
            icon={Compass}
            title="Nothing to discover yet."
            description="As writers publish, featured and trending work will surface here."
          />
        )
      ) : (
        <>
          {/*
            Personalised before editorial: when these have anything to say they are more specific to
            this reader than the featured shelves, and when they have nothing they render nothing, so
            the editorial page keeps its existing first impression.
          */}
          <RecommendationShelf kind="feed" title="Recommended for you" icon={Sparkles} />
          <RecommendationShelf kind="continue_reading" title="Pick up next" icon={BookOpen} />

          {has(featuredPieces.data, featuredPieces.isLoading) ? (
            <DiscoverSection title="Featured pieces" icon={Sparkles}>
              <PiecesGrid items={featuredPieces.data ?? []} isLoading={featuredPieces.isLoading} />
            </DiscoverSection>
          ) : null}

          {has(trendingPieces.data, trendingPieces.isLoading) ? (
            <DiscoverSection
              title="Trending now"
              icon={Flame}
              action={<SeeAllLink to={feedPath({ tab: 'trending' })}>See all</SeeAllLink>}
            >
              <PiecesGrid items={trendingPieces.data ?? []} isLoading={trendingPieces.isLoading} />
            </DiscoverSection>
          ) : null}

          {has(featuredWriters.data, featuredWriters.isLoading) ? (
            <DiscoverSection title="Featured writers" icon={Star}>
              <WritersGrid
                items={featuredWriters.data ?? []}
                isLoading={featuredWriters.isLoading}
              />
            </DiscoverSection>
          ) : null}

          {has(popularWriters.data, popularWriters.isLoading) ? (
            <DiscoverSection title="Writers to follow" icon={Users}>
              <WritersGrid items={popularWriters.data ?? []} isLoading={popularWriters.isLoading} />
            </DiscoverSection>
          ) : null}

          {has(genres.data, genres.isLoading) ? (
            <DiscoverSection title="Popular genres" icon={TrendingUp}>
              <TaxonomyCloud
                chips={(genres.data ?? []).map((g) => ({
                  key: g.slug,
                  label: g.name,
                  href: feedPath({ tab: 'latest', genre: g.slug }),
                }))}
              />
            </DiscoverSection>
          ) : null}

          {has(tags.data, tags.isLoading) ? (
            <DiscoverSection title="Popular tags" icon={Hash}>
              <TaxonomyCloud
                chips={(tags.data ?? []).map((t) => ({
                  key: t.slug,
                  label: `#${t.name}`,
                  href: feedPath({ tab: 'latest', tag: t.slug }),
                }))}
              />
            </DiscoverSection>
          ) : null}

          {has(languages.data, languages.isLoading) ? (
            <DiscoverSection title="Browse by language" icon={Languages}>
              <TaxonomyCloud
                chips={(languages.data ?? []).map((l) => ({
                  key: l.code,
                  label: l.nativeName,
                  href: feedPath({ tab: 'latest', lang: l.code }),
                }))}
              />
            </DiscoverSection>
          ) : null}
        </>
      )}
    </div>
  );
}

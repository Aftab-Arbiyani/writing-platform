import type { ReactElement } from 'react';
import { Helmet } from 'react-helmet-async';

import { APP_NAME } from '@/lib/constants';
import { DEFAULT_OG_IMAGE, absoluteUrl, formatTitle } from '@/lib/seo';

/**
 * Per-page SEO meta (Epic F10). This is the *richer meta* layer that complements `usePageTitle`
 * (docs/11 §7): the document title stays owned by `usePageTitle` (native + bulletproof); `<Seo>`
 * emits the description, canonical link, Open Graph + Twitter card, robots directive, and optional
 * JSON-LD via `HelmetProvider` (mounted in app/providers). Render it near the top of a *public*,
 * indexable page (landing, profile, feed, discover, search). Utility/auth/settings pages pass
 * `noindex` so crawlers that execute JS drop them; content behind auth is also covered by
 * `public/robots.txt`. All URLs are absolutised through `lib/seo` against the deployed origin.
 */
export interface SeoProps {
  /** Human title of the page (used for og:title / twitter:title; document.title stays with usePageTitle). */
  title?: string;
  /** Meta description — 1–2 sentences, ≤160 chars. Falls back to the app tagline. */
  description?: string;
  /** Path (`/@ali`) or absolute URL for the canonical + og:url. Defaults to the current location. */
  canonicalPath?: string;
  /** Social image — a storage URL or a /public path. Defaults to the branded card. */
  image?: string;
  /** Open Graph object type. */
  type?: 'website' | 'article' | 'profile';
  /** Keep the page out of search indexes (utility, auth, private surfaces). */
  noindex?: boolean;
  /** Structured data (schema.org). Built via helpers in `lib/seo`. */
  jsonLd?: Record<string, unknown>;
}

const DEFAULT_DESCRIPTION =
  'A premium writing sanctuary for literary writers. Write, publish, and read in a calm, distraction-free space.';

export function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalPath,
  image,
  type = 'website',
  noindex = false,
  jsonLd,
}: SeoProps): ReactElement {
  const canonical =
    absoluteUrl(canonicalPath) ??
    (typeof window !== 'undefined' ? window.location.href : undefined);
  const ogTitle = formatTitle(title);
  const ogImage = absoluteUrl(image ?? DEFAULT_OG_IMAGE);

  return (
    <Helmet>
      <meta name="description" content={description} />
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
      {canonical ? <link rel="canonical" href={canonical} /> : null}

      {/* Open Graph */}
      <meta property="og:site_name" content={APP_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={description} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      {ogImage ? <meta property="og:image" content={ogImage} /> : null}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={ogTitle} />
      <meta name="twitter:description" content={description} />
      {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}

      {jsonLd ? <script type="application/ld+json">{JSON.stringify(jsonLd)}</script> : null}
    </Helmet>
  );
}

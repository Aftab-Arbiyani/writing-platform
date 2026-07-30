import { env } from '@/config/env';
import { APP_NAME } from '@/lib/constants';

/**
 * SEO URL + structured-data helpers (Epic F10). The app is a client-rendered SPA, so canonical
 * and Open Graph URLs are resolved against the deployed public origin: `VITE_SITE_URL` when set,
 * else the runtime `window.location.origin`. Keep this the single place URLs are absolutised for
 * meta — the `<Seo>` component and any JSON-LD builder call through here.
 */

/** The public origin the app is served from. Prefers the configured site URL; falls back to runtime. */
export function siteOrigin(): string {
  if (env.VITE_SITE_URL) return env.VITE_SITE_URL.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

/** Absolutise a path or (already-absolute) URL against the site origin. */
export function absoluteUrl(pathOrUrl?: string): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  const origin = siteOrigin();
  if (!origin) return pathOrUrl;
  return `${origin}/${pathOrUrl.replace(/^\/+/, '')}`;
}

/** The default social-share image (a static branded card in /public). */
export const DEFAULT_OG_IMAGE = '/og-image.svg';

/** Format a page title as `"{title} · Qalam"` (or just the app name). Mirrors use-page-title. */
export function formatTitle(title?: string): string {
  return title ? `${title} · ${APP_NAME}` : APP_NAME;
}

/** Schema.org WebSite node — emitted once on the landing page so search engines learn the brand. */
export function websiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: APP_NAME,
    url: siteOrigin() || undefined,
    description:
      'A premium writing sanctuary for Hindi and Urdu writers first, the world next. Write, publish, and read in a calm, distraction-free space.',
  };
}

/** Schema.org ProfilePage/Person node for a writer profile. */
export function profileJsonLd(input: {
  penName: string;
  username: string;
  bio?: string | null;
  avatarUrl?: string;
  path: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: input.penName,
      alternateName: `@${input.username}`,
      description: input.bio ?? undefined,
      image: input.avatarUrl,
      url: absoluteUrl(input.path),
    },
  };
}

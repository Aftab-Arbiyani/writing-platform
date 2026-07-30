// Sitemap generator (Epic F10 — "sitemap generation support").
//
// Emits public/sitemap.xml for the app's PUBLIC, indexable routes. Run at build/deploy time with
// the deployed origin:
//
//   SITE_URL=https://qalam.app node scripts/generate-sitemap.mjs
//
// This is a static baseline (the routes any visitor can reach without a query). Dynamic entries —
// individual writer profiles (/@handle) and, later, published pieces — should be appended from a
// backend endpoint that enumerates public content; wire that in when the backend exposes it.
// Kept out of the TS program and app lint on purpose (see eslint.config.mjs ignores).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SITE_URL = (process.env.SITE_URL ?? 'https://qalam.app').replace(/\/+$/, '');

// Mirror the public routes from src/lib/routes.ts. Keep in sync with robots.txt Allow rules.
const PUBLIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/feed', changefreq: 'hourly', priority: '0.9' },
  { path: '/discover', changefreq: 'daily', priority: '0.8' },
  { path: '/search', changefreq: 'weekly', priority: '0.5' },
];

const today = new Date().toISOString().slice(0, 10);

const urls = PUBLIC_ROUTES.map(
  (r) =>
    `  <url>\n    <loc>${SITE_URL}${r.path}</loc>\n    <lastmod>${today}</lastmod>\n` +
    `    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`,
).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sitemap.xml');
writeFileSync(outPath, xml, 'utf8');

// eslint-disable-next-line no-console
console.log(`[qalam] wrote ${outPath} for ${SITE_URL} (${PUBLIC_ROUTES.length} routes)`);

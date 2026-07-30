#!/usr/bin/env node
/**
 * Frontend bundle-budget gate (P7.3). After `vite build`, gzips every emitted
 * JS/CSS asset and checks them against `perf/budget.json` — the frontend
 * counterpart to the backend's budget verification, sharing the same budget ids
 * (`frontend.bundle.initial`). Dependency-free (node:zlib). Exit 1 on breach so
 * CI catches a bundle-size regression.
 *
 *   node perf/check-bundle-budget.mjs            # after `pnpm build`
 *   node perf/check-bundle-budget.mjs --json     # machine-readable output
 */
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'dist', 'assets');
const budget = JSON.parse(readFileSync(join(root, 'perf', 'budget.json'), 'utf8'));
const asJson = process.argv.includes('--json');

if (!existsSync(assetsDir)) {
  console.error('dist/assets not found — run `pnpm build` first.');
  process.exit(1);
}

const gzipKb = (buf) => Math.round((gzipSync(buf).length / 1024) * 10) / 10;

const files = readdirSync(assetsDir);
const js = [];
const css = [];
for (const f of files) {
  const kb = gzipKb(readFileSync(join(assetsDir, f)));
  if (f.endsWith('.js')) js.push({ f, kb });
  else if (f.endsWith('.css')) css.push({ f, kb });
}
js.sort((a, b) => b.kb - a.kb);
css.sort((a, b) => b.kb - a.kb);

// The entry chunk (Vite names it `index-*.js`) approximates initial JS.
const entry = js.find((x) => /^index-.*\.js$/.test(x.f));
const largestJs = js[0];
const largestCss = css[0];

const violations = [];
if (entry && entry.kb > budget.initialJsKb) {
  violations.push(`initial JS (${entry.f}) ${entry.kb}kb > ${budget.initialJsKb}kb (frontend.bundle.initial)`);
}
if (largestJs && largestJs.kb > budget.maxChunkKb) {
  violations.push(`largest JS chunk (${largestJs.f}) ${largestJs.kb}kb > ${budget.maxChunkKb}kb`);
}
if (largestCss && largestCss.kb > budget.maxCssKb) {
  violations.push(`largest CSS (${largestCss.f}) ${largestCss.kb}kb > ${budget.maxCssKb}kb`);
}

if (asJson) {
  console.log(JSON.stringify({ js, css, entry, violations }, null, 2));
} else {
  console.log('Frontend bundle (gzip KB):');
  for (const { f, kb } of js.slice(0, 12)) console.log(`  ${String(kb).padStart(7)}  ${f}`);
  console.log(`  entry: ${entry ? `${entry.f} = ${entry.kb}kb` : '(not found)'}`);
}

if (violations.length > 0) {
  console.error(`\n${violations.length} bundle-budget violation(s):`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log('\nbundle within budget.');

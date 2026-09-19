#!/usr/bin/env node
/**
 * Find elements still carrying user-agent chrome, because we skip Tailwind's preflight.
 *
 *   node scripts/ua-chrome/scan.mjs          # or: pnpm ua:scan
 *   node scripts/ua-chrome/scan.mjs --json   # machine-readable
 *   node scripts/ua-chrome/scan.mjs --root frontend/src/features/search
 *
 * WHY THIS EXISTS
 * ---------------
 * `frontend/src/styles/global.css` deliberately does NOT import Tailwind's preflight — AntD 5
 * ships its own reset and the two fight (see the "Conflict rule" comment in that file). Only
 * three preflight rules were ever re-added by hand: `box-sizing`, `body{margin:0}` and
 * `button{background-color:transparent}`. Everything else the UA supplies still applies to any
 * element we style ourselves rather than through AntD or `@umberleaf/ui`:
 *
 *   <button> / <input> / <textarea> / <select>   native border   → a hard box around the control
 *   <ul> / <ol>   list-style, padding-inline-start:40px, margin-block:1em
 *                                                 → markers, a 40px indent, stray vertical space
 *
 * A nested <ul> gets `circle` markers, and an <li> inside a `display:flex` list KEEPS its marker
 * (blockification leaves `list-item` intact) with the marker drawn in the gap BEFORE its item —
 * which is why these read as stray separators between chips and tabs rather than as bullets.
 *
 * THE FIX, per element
 *   control : add `border-0`
 *   list    : add `my-0 list-none ps-0`   (`ps-0`, not `p-0` — `p-0` clobbers intentional padding)
 *
 * SCOPE: `frontend/` only. Admin is deliberately excluded — the owner reviewed the same defect
 * in `admin/src/features/settings/components/settings-nav.tsx` and decided not to change it.
 * Pass `--root` if that ever changes.
 *
 * This is a REPORT, not a gate: it always exits 0. Fixes are applied per component as each
 * surface is reported, which is also an owner decision — do not bulk-apply from this output.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(REPO, 'frontend/package.json'));
const ts = require('typescript');

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes('--json');
const rootArg = argv.indexOf('--root');
const ROOT = resolve(REPO, rootArg === -1 ? 'frontend/src' : argv[rootArg + 1]);

if (!existsSync(ROOT)) {
  console.error(`no such directory: ${ROOT}`);
  process.exit(2);
}

const CONTROLS = new Set(['button', 'input', 'textarea', 'select']);
const LISTS = new Set(['ul', 'ol']);

/**
 * Lists that MUST keep their markers. `.umberleaf-prose ul { list-style: disc }` styles the
 * reader's article content, so `list-none` here would strip the bullets out of every published
 * piece. Matched on file + element rather than by class, because these tags carry no className.
 */
const PROSE_RENDERERS = ['features/reading/components/content-renderer.tsx'];

const files = execFileSync('find', [ROOT, '-name', '*.tsx', '-not', '-name', '*.spec.tsx'], {
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean)
  .sort();

const controls = [];
const lists = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rel = relative(REPO, file);
  const isProse = PROSE_RENDERERS.some((p) => rel.endsWith(p));

  /**
   * Module-level `const FOO = '…'` class strings, so `className={cn(CHIP_BASE, className)}`
   * resolves instead of being reported as unknown. This is what makes `search-chip.tsx` come
   * back clean: its `CHIP_BASE` really does set `border border-line`.
   */
  const consts = new Map();
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (
        ts.isIdentifier(d.name) &&
        d.initializer &&
        (ts.isStringLiteral(d.initializer) || ts.isNoSubstitutionTemplateLiteral(d.initializer))
      ) {
        consts.set(d.name.text, d.initializer.text);
      }
    }
  }

  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf);
      const isControl = CONTROLS.has(tag);
      const isList = LISTS.has(tag);

      if (isControl || isList) {
        const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
        const attrText = (name) =>
          attrs.find((a) => a.name.getText(sf) === name)?.initializer?.getText(sf) ?? null;

        // Collect every string that can end up in the class list.
        const parts = [];
        let unresolved = false;
        const collect = (n) => {
          if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) parts.push(n.text);
          else if (ts.isTemplateExpression(n)) {
            parts.push(n.head.text);
            for (const s of n.templateSpans) {
              collect(s.expression);
              parts.push(s.literal.text);
            }
          } else if (ts.isIdentifier(n)) {
            if (consts.has(n.text)) parts.push(consts.get(n.text));
            else if (!/^(cn|clsx|classNames)$/.test(n.text)) unresolved = true;
          } else n.forEachChild(collect);
        };
        const classAttr = attrs.find((a) => a.name.getText(sf) === 'className');
        if (classAttr?.initializer) collect(classAttr.initializer);
        const classes = parts.join(' ');

        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        const show = classes.replace(/\s+/g, ' ').trim();

        if (isControl) {
          // Not rendered, so no border is drawn: `hidden`, `type="hidden"`, or visually-hidden.
          const invisible =
            attrs.some((a) => a.name.getText(sf) === 'hidden') ||
            /hidden/.test(attrText('type') ?? '') ||
            /\bsr-only\b/.test(classes);
          if (!invisible && !/\bborder(-\S+)?\b/.test(classes)) {
            controls.push({ file: rel, line, tag, unresolved, classes: show });
          }
        } else if (!isProse && !/\blist-(none|disc|decimal)\b/.test(classes)) {
          // `list-disc` / `list-decimal` are deliberate — the author wants markers.
          lists.push({ file: rel, line, tag, unresolved, classes: show });
        }
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);
}

if (JSON_OUT) {
  console.log(JSON.stringify({ root: relative(REPO, ROOT), controls, lists }, null, 2));
  process.exit(0);
}

/** Group by the feature folder, so findings can be worked through one surface at a time. */
const area = (f) => (f.match(/src\/features\/([^/]+)\//) ?? [, 'components (shared)'])[1];
const report = (title, rows, fix) => {
  console.log(`\n${title} — ${String(rows.length)}`);
  if (rows.length === 0) return;
  console.log(`  fix: ${fix}\n`);
  const groups = new Map();
  for (const r of rows) {
    const k = area(r.file);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  for (const k of [...groups.keys()].sort()) {
    console.log(`  ${k}`);
    for (const r of groups.get(k)) {
      console.log(
        `    ${r.file}:${String(r.line)} <${r.tag}>${r.unresolved ? '  [dynamic — check by eye]' : ''}`,
      );
      if (r.classes) console.log(`        ${r.classes.slice(0, 100)}`);
    }
  }
};

console.log(`UA-chrome scan — ${relative(REPO, ROOT)}`);
report('FORM CONTROLS with no border utility', controls, 'add `border-0`');
report('LISTS with no list-none', lists, 'add `my-0 list-none ps-0`');
console.log(
  `\n${String(controls.length + lists.length)} total. Report only — nothing is a gate, and fixes are applied per surface as it is reported.`,
);

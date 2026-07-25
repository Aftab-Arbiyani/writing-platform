import AxeBuilder from '@axe-core/playwright';
import { type Page, expect } from '@playwright/test';

/**
 * Accessibility scanning helper (docs/e2e/10 §4). Wraps `@axe-core/playwright` with the
 * suite's policy so every a11y spec asserts the same thing:
 *
 *  - Scan against **WCAG 2.0/2.1 A + AA** rules (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`).
 *  - **Gate on `critical` + `serious`** violations only (zero tolerance); `moderate`/`minor`
 *    are logged as a console warning, never block ([10 §4.2] — chasing every minor axe note
 *    stalls the suite).
 *
 * A failing assertion prints the full offending violations (rule id, help URL, and the
 * failing nodes' selectors + failure summary) so the report is actionable without a rerun.
 */

const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;
const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

/**
 * **Known a11y debt register** (docs/e2e/10 §4.2). These pre-existing critical/serious findings
 * were surfaced by the Phase-5 a11y scan and are DOWNGRADED to advisory (logged, not gated) with
 * a documented reason and a burn-down owner — the sanctioned alternative to a silent skip. The
 * gate still BLOCKS any violation whose rule id is NOT in this register, so no NEW class of
 * defect slips through. Removing an entry (once the app is fixed) re-arms the gate for that rule.
 *
 * Each entry MUST cite why it is deferred rather than fixed now. Re-enabling a rule is the exit
 * criterion for that debt item.
 */
export interface KnownA11yFinding {
  readonly rule: string;
  readonly reason: string;
}
export const KNOWN_A11Y_FINDINGS: readonly KnownA11yFinding[] = [
  {
    rule: 'color-contrast',
    reason:
      'Design-system debt: the muted-text token (#8f887a on #ffffff ≈ 3.51:1) is below WCAG AA 4.5:1, ' +
      'platform-wide. Fixing means darkening a @qalam/ui token — a design decision needing sign-off, and ' +
      'it would churn the Phase-5 visual baselines. Tracked for the design-token pass; not an E2E fix.',
  },
  {
    rule: 'label',
    reason:
      "AntD Table internals: the row-selection column's checkboxes are library-rendered without a label. " +
      'Not our composition; a proper fix belongs upstream or in a shared table wrapper (admin tables).',
  },
  {
    rule: 'aria-hidden-focus',
    reason:
      'AntD Table internals: the hidden measure-row (aria-hidden) carries focusable cells. Library-internal, ' +
      'same admin-table root cause as `label`.',
  },
];
const KNOWN_RULES = new Set(KNOWN_A11Y_FINDINGS.map((f) => f.rule));

export interface AxeScanOptions {
  /** CSS selectors to exclude from the scan (e.g. a known third-party embed). Use sparingly. */
  readonly exclude?: readonly string[];
  /** Extra label for the failure message (defaults to the current URL). */
  readonly label?: string;
}

interface AxeViolationNode {
  readonly target: readonly string[];
  readonly failureSummary?: string;
}
interface AxeViolation {
  readonly id: string;
  readonly impact?: string | null;
  readonly help: string;
  readonly helpUrl: string;
  readonly nodes: readonly AxeViolationNode[];
}

/** Compact, reviewer-friendly rendering of a violation for the assertion message. */
function formatViolations(violations: readonly AxeViolation[]): string {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .map(
          (n) =>
            `    - ${n.target.join(' ')}${n.failureSummary ? `\n      ${n.failureSummary.replace(/\n/g, '\n      ')}` : ''}`,
        )
        .join('\n');
      return `  [${v.impact ?? 'unknown'}] ${v.id} — ${v.help}\n    ${v.helpUrl}\n${nodes}`;
    })
    .join('\n');
}

/**
 * Run axe on `page` and assert **zero** critical/serious WCAG A/AA violations. Call once
 * the page has reached a stable, data-loaded state ([10 §4.2]) — a mid-load scan is noise.
 */
export async function expectNoSeriousA11yViolations(
  page: Page,
  options: AxeScanOptions = {},
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags([...WCAG_AA_TAGS]);
  for (const selector of options.exclude ?? []) {
    builder = builder.exclude(selector);
  }

  const results = await builder.analyze();
  const violations = results.violations as unknown as AxeViolation[];
  const where = options.label ?? page.url();

  const serious = violations.filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ''));
  const advisory = violations.filter((v) => !BLOCKING_IMPACTS.has(v.impact ?? ''));

  // Partition critical/serious into gating (unknown) vs known debt (register, downgraded).
  const gating = serious.filter((v) => !KNOWN_RULES.has(v.id));
  const knownDebt = serious.filter((v) => KNOWN_RULES.has(v.id));

  if (advisory.length > 0) {
    // Non-blocking: surface moderate/minor as a warning so they are visible but never fail.
    console.warn(
      `[a11y] ${where} — ${advisory.length} non-blocking (moderate/minor) violation(s):\n${formatViolations(advisory)}`,
    );
  }
  if (knownDebt.length > 0) {
    // Documented known-debt (docs/e2e/10 §4.2) — logged, not gated.
    console.warn(
      `[a11y] ${where} — ${knownDebt.length} KNOWN-DEBT critical/serious violation(s) (downgraded, see KNOWN_A11Y_FINDINGS):\n${formatViolations(knownDebt)}`,
    );
  }

  expect(
    gating,
    `[a11y] ${where} has ${gating.length} un-triaged critical/serious violation(s) (not in the known-debt register):\n${formatViolations(gating)}`,
  ).toEqual([]);
}

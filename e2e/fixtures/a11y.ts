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
  // EMPTY BY DESIGN — every entry has been burned down (docs/e2e/10 §8.1):
  //   • `color-contrast`  → --q-text-muted darkened to #726c61 (5.21:1 surface / 4.87:1 canvas /
  //     4.51:1 raised) and AntD's Menu group-title + selected-item colours pinned in
  //     packages/ui/src/theme/antd-theme.ts (their derived defaults were 2.77:1 and 4.22:1).
  //   • `label`           → DataTable now supplies an aria-label per row-selection checkbox.
  //   • `aria-hidden-focus` → the duplicate checkbox AntD renders inside its aria-hidden measure
  //     row is taken out of the tab order in admin/src/styles/global.css.
  // Adding an entry here downgrades a real, user-facing defect: prefer fixing the app. If one is
  // genuinely un-fixable, it needs the same sign-off as any other deferred defect
  // (docs/22 — Browser E2E).
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
 *
 * **After calling this, never wait for an animated overlay to CLOSE on the same page.** The style tag
 * below sets `animation-duration: 0s`, and rc-motion (AntD's Modal/Drawer/Popover) removes an exiting
 * element on its `animationend` — which a zero-duration animation does not fire. A dialog closed after
 * a scan therefore stays in `ant-zoom-leave-active` forever; the W5 AI-search scan lost 30 s to exactly
 * that before it was changed to navigate away instead (docs/48 §3.9). Open overlays are fine to SCAN —
 * that is the point — but dismiss them with a navigation.
 */
export async function expectNoSeriousA11yViolations(
  page: Page,
  options: AxeScanOptions = {},
): Promise<void> {
  // Settle animations before sampling. axe reads *computed* colours, so an element caught
  // mid-fade reports its blended colour, not its real one — a card fading in at 0.93 opacity
  // turned a compliant #726c61 into #7c776c and failed `color-contrast` by 0.08. Reduced motion
  // makes the app's MotionProvider skip its JS-driven transitions; the stylesheet collapses any
  // pure-CSS transition to its end state. Both are deterministic — no sleeps.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`,
  });

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

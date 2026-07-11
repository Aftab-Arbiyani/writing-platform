# Qalam Admin — Accessibility Guide (WCAG 2.1 AA)

Accessibility is centralized in the `@qalam/ui` primitives and enforced by
convention. This guide documents the patterns and the A9 audit result.

## Patterns in place

- **Real interactive elements** — every click target is a `<button>`, a router
  `Link`, or an AntD `Menu`/`Dropdown`/`Tabs` item. No `onClick` on `<div>`s.
- **Focus management is central** — all modals go through `QDialog`→AntD `Modal`
  (focus trap, Escape, focus-return; danger dialogs disable Esc/mask dismissal so
  a destructive action needs an explicit choice); all drawers through
  `QDrawer`→AntD `Drawer`. The admin `modal.tsx`/`drawer.tsx` are thin re-exports —
  no bespoke focus code to get wrong.
- **Skip link** — the shell renders a "Skip to content" link (first focusable
  element) targeting `<main id="main" tabIndex={-1}>` (WCAG 2.4.1).
- **Landmarks & headings** — `<nav aria-label>` on the sidebar and settings nav;
  one `<h1>` per page via `PageHeader`; a `<main>` landmark; a `contentinfo`
  footer. Analytics sections carry an sr-only `<h2>` between the page `<h1>` and
  chart `<h3>`s.
- **ARIA labels** — icon-only buttons all carry `aria-label`; the button icon is
  `aria-hidden`. Table headers use `<th scope>`.
- **Accessible forms** — `QInput`→`FieldShell` wires `<label htmlFor>` to the
  control `id` and sets `aria-invalid` + `aria-describedby`; the login password
  toggle uses `aria-label` + `aria-pressed`.
- **Accessible charts** — every chart is `role="img"` with a required `aria-label`,
  and `ChartContainer` renders an **sr-only `<table>`** (with `<caption>` +
  `<th scope>`) mirroring the chart data, so screen readers get the numbers.
- **Non-color status** — status is always icon/text, never color alone:
  `StatusIndicator` (dot + label), `StatusBadge`, `AlertPanel` (icon + sr-only
  severity prefix), `GrowthBadge` (direction icon + signed %).
- **Live regions** — the save bar (`aria-live="polite"` dirty count), bulk-action
  bar (`role="region"`), login errors (`role="alert"`), loading skeletons
  (`role="status"`), and the maintenance banner (`role="status"`).
- **Theme & contrast** — `--q-*` tokens meet AA contrast in both light and dark;
  `data-theme` drives dark mode (respected by charts too).

## A9 audit result & fixes

The audit rated the app **"unusually well-built for a11y."** Applied fixes:

- Added the **skip-to-content** link (the only P1).
- Added `alt` to the one raw table `<Avatar>` (`user-columns.tsx`).
- Added the sr-only data-table to the registrations **heat map** chart (the one
  chart missing it).
- Added the sr-only **`<h2>`** per analytics section (heading hierarchy).

## Known low-severity items (in `@qalam/ui`, out of admin-only scope)

Three minor items live in the shared `@qalam/ui` primitives (consumed by the
reader app too), so they were **documented, not changed** under the admin-only
A9 scope: `QDialog` could add `aria-describedby` for its description; `QDrawer`
could require a `title`/`aria-label` (every admin usage already passes `title`);
AntD toast notices may not always announce (`toast.error` is used only for
non-critical export/refresh failures). None are barriers in the admin app as used.

## Manual test checklist

- Tab from page load → the skip link appears first and jumps to content.
- Every action reachable and operable by keyboard; focus visible.
- Open a modal/drawer → focus is trapped, Escape closes (except danger dialogs),
  focus returns to the trigger.
- With a screen reader: charts announce their label and expose a data table;
  status text (not color) conveys state; form errors are announced.

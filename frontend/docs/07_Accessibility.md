# Accessibility Guide

Target: **WCAG 2.1 AA**. An F10 audit found **no critical issues** and a strong, a11y-literate
baseline. This guide records the practices, the audit result, and the one known gap.

## Practices in place (verified)

- **Landmarks** — `banner` (top-bar), `main#main` (focusable target), `contentinfo` (footer),
  `nav[aria-label="Primary"]` (mobile tabs), `complementary` aside (feed rail). Popover/dialog
  internals use `<div>` (not `<header>/<footer>`) so they don't leak duplicate landmarks.
- **Skip link** → `#main` as the first focusable element.
- **Keyboard & focus** — global `:focus-visible { outline: 2px solid var(--q-accent) }`; no bare
  `outline-none`. AntD `Modal`/`QDialog`/`QDrawer` trap focus; the one custom full-page dialog
  (`preview-view`) uses `useFocusTrap` (moves focus in, cycles Tab, restores focus on close).
- **Command palette** — ARIA combobox with `aria-activedescendant`; options are `role="option"` and
  `tabIndex={-1}` (driven by the input, not the Tab order).
- **Forms** — `QInput`/`FieldShell`/`useFieldA11y` wire `label htmlFor` + `aria-invalid` +
  `aria-describedby`; form-level errors are `role="alert" aria-live="polite"`; `noValidate` + RHF/Zod.
  The scheduled-publish `datetime-local` field is wired to its error via `aria-invalid`/`aria-describedby`.
- **Tables** — `scope="col"/"row"`, `sr-only <caption>`, labelled action links (analytics pieces-table).
- **Charts** — every ECharts chart renders a visually-hidden data `<table>` (with `<caption>` +
  `th scope`) and `role="img"`/`aria-label`; decorative sparklines are `aria-hidden`.
- **Icons/images** — decorative icons `aria-hidden`; icon-only buttons labelled (theme toggle, bell
  with dynamic unread count, user-menu, password toggle with `aria-pressed`, row actions).
- **Live regions** — toasts, autosave status, editor metrics, offline banner, loading states.
- **Headings** — one `h1` per page (visually-hidden `h1` on feed & search where the tab-strip/search
  field is the visual title); no skipped levels.
- **RTL** — logical CSS properties only; `dir="auto"` on user content; icon mirroring via `rtl:rotate-180`.
- **Colour** — token-based; light/dark both supported.

## Authoring checklist (new components)

1. Semantic element first; ARIA only to fill gaps. One `h1` per page; don't skip heading levels.
2. Icon-only control → `aria-label`. Decorative icon/image → `aria-hidden` / `alt=""`.
3. Interactive custom widget → keyboard operable + visible focus; custom dialog → `useFocusTrap`.
4. Form field → associated `<label>`, `aria-invalid` + `aria-describedby` on error.
5. Async region → `role="status"`/`aria-live`. Chart/table → provide a text/table alternative.
6. Logical CSS properties only; colours from `--q-*`; verify dark mode.

## Known gap (tracked)

- **`--q-text-muted` contrast** — the muted text token is ~3.3:1 (light) / ~4.0:1 (dark), below the
  4.5:1 AA threshold for normal text. It lives in `@qalam/ui` (`packages/ui/styles/tokens.css`), which
  is **outside the F10 frontend scope** and shared with the admin app, so it was not changed here.
  **Recommended fix:** darken the light token / lighten the dark token to ≥4.5:1 (a one-line change that
  resolves every `text-ink-muted` usage), or restrict `text-ink-muted` to large text only. Track as a
  design-system (`@qalam/ui`) follow-up.

## Testing

Chart data-tables, labelled controls, and focus behaviour are covered by Vitest component tests
(`use-focus-trap.spec`, chart specs, page specs). Manual passes: keyboard-only navigation of each
flow, and a screen-reader spot-check of charts/tables/dialogs.

# 07 — Design System

> **Derives from:** `00_ArchitectureDecisions.md` §6–§7. The §7 token table is the
> canonical seed; this document expands it into the full working system. Behavior specs
> live in `06_UIUXSpecification.md`; component contracts in `08_ComponentLibrary.md`.
> Implementation home: `packages/ui` (`@qalam/ui`).

---

## 1. Token Architecture

**One source of record, three consumers.**

```
packages/ui/src/tokens/tokens.ts        ← single typed map, keyed by --q-* names
        │
        ├─▶ tokens.css (generated at build: :root {…} + :root[data-theme="dark"] {…})
        │        │
        │        ├─▶ Tailwind v4  @theme { --color-canvas: var(--q-bg-canvas); … }
        │        └─▶ hand-written CSS in apps (var(--q-*) directly)
        │
        └─▶ antdTheme(mode) — ConfigProvider theme factory (AntD needs concrete hex
             to derive its internal palette; it reads the same map, per mode)
```

- The `--q-*` CSS custom properties are the **canonical names**. `tokens.ts` exists only
  because AntD's theme algorithm requires literal values at theme-build time; it is the
  same data, and `tokens.css` is generated from it — values are written exactly once.
- Theme switching: `data-theme="light|dark"` on `<html>` swaps the CSS variables;
  the app re-renders `ConfigProvider` with `antdTheme(mode)`. Tailwind utilities are
  theme-reactive for free because they resolve to `var(--q-*)`.
- Tailwind preflight is **disabled** (ADR §6); `@qalam/ui` ships a minimal reset that
  doesn't fight AntD.

**Naming convention:** `--q-{category}-{role}[-{variant}][-{state}]`

| Category                                       | Examples                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `bg`                                           | `--q-bg-canvas`, `--q-bg-surface`, `--q-bg-raised`                                 |
| `text`                                         | `--q-text-primary`, `--q-text-secondary`, `--q-text-muted`                         |
| `border`                                       | `--q-border`, `--q-border-strong`                                                  |
| `accent` / semantic                            | `--q-accent-hover`, `--q-danger-bg`, `--q-warning-text`                            |
| `font` / `text-size` / `leading`               | `--q-font-reading-ur`, `--q-text-xl`, `--q-leading-nastaliq`                       |
| `space` / `radius` / `shadow` / `z` / `motion` | `--q-space-4`, `--q-radius-card`, `--q-shadow-2`, `--q-z-modal`, `--q-motion-base` |

Rules: no raw hex/px/ms literals in app or `@qalam/ui` component code — an ESLint rule
flags them; every value routes through a token. New tokens are added via the workflow in
`08` §7.

---

## 2. Color

### 2.1 Neutral & accent ramps

Seed values from ADR §7, expanded into the full working ramp. **Bold = canonical ADR
value; the rest are the system's ramp extensions.**

| Token                 | Light       | Dark        | Role                                                                  |
| --------------------- | ----------- | ----------- | --------------------------------------------------------------------- |
| `--q-bg-canvas`       | **#FAF7F1** | **#131110** | Page background — the paper. Reading view sits directly on it.        |
| `--q-bg-surface`      | **#FFFFFF** | **#1C1917** | Cards, sheets, popovers, inputs-on-canvas.                            |
| `--q-bg-raised`       | **#F3EEE5** | **#26221E** | Hover fills, selected rows, filled inputs, sidebar panels.            |
| `--q-text-primary`    | **#24211B** | **#ECE6DA** | Body and headings — the ink.                                          |
| `--q-text-secondary`  | **#6B655A** | **#A69F90** | Meta, subtitles, small stats — the default for small supporting text. |
| `--q-text-muted`      | **#8F887A** | **#7A7367** | Large-size-only tertiary text, placeholders, disabled labels.         |
| `--q-border`          | **#E7E1D6** | **#2E2A24** | Hairlines, dividers, decorative card borders.                         |
| `--q-border-strong`   | #8F887A     | #7A7367     | Input boundaries, anything that must hit 3:1 non-text contrast.       |
| `--q-accent`          | **#9E4B28** | **#D07349** | Terracotta ink — primary actions, links, active states, focus ring.   |
| `--q-accent-hover`    | **#B45A32** | **#DD8A63** | Hover on accent surfaces/text.                                        |
| `--q-accent-active`   | #833E21     | #C2653C     | Pressed state.                                                        |
| `--q-accent-subtle`   | #F5E7DE     | #3A2A20     | Tinted fills: selected tabs' wash, quote-card tint, accent Tag bg.    |
| `--q-accent-contrast` | #FFFFFF     | #131110     | Text/icon on accent fills (dark uses ink-on-terracotta).              |

### 2.2 Semantic ramp

Base values from ADR (`success/warning/danger/info`); dark values are the warm-shifted
variants the ADR calls for; `-text` and `-bg` extensions complete each family.

| Family  | Token              | Light       | Dark    |
| ------- | ------------------ | ----------- | ------- |
| Success | `--q-success`      | **#3E7C4F** | #6FA97E |
|         | `--q-success-text` | #2F6B40     | #6FA97E |
|         | `--q-success-bg`   | #EAF0E7     | #1E2A20 |
| Warning | `--q-warning`      | **#A97A1F** | #C9974A |
|         | `--q-warning-text` | #7E5B12     | #C9974A |
|         | `--q-warning-bg`   | #F7EEDC     | #2E2718 |
| Danger  | `--q-danger`       | **#B3382E** | #D0655B |
|         | `--q-danger-text`  | #B3382E     | #DA7E74 |
|         | `--q-danger-bg`    | #F8E7E4     | #2F1D1A |
| Info    | `--q-info`         | **#3B6EA8** | #7396C2 |
|         | `--q-info-text`    | #3B6EA8     | #7396C2 |
|         | `--q-info-bg`      | #EBF2F9     | #1D2530 |

_Why split `base` vs `-text`:_ the base hue is tuned for icons and fills; two of the
light bases (warning 3.58:1, success 4.31:1 on its subtle bg) miss AA for small text,
so `-text` carries a darkened, AA-passing variant. Components always use `-text` for
words, base for icons/borders, `-bg` for washes.

### 2.3 Usage rules

1. **Muted is large-only.** `--q-text-muted` is 3.29:1 on canvas — legal only at
   ≥ 19px (24px Nastaliq), for placeholders, or on disabled controls (WCAG-exempt).
   Small meta text (timestamps, counts) uses `--q-text-secondary` (5.40:1).
2. **Warning base is never text.** Use `--q-warning-text` for words, base for the icon.
3. **One accent.** Terracotta is the only brand hue. Charts, badges, and highlights
   derive from the neutral + semantic ramps — no ad-hoc blues or purples.
4. **Borders:** `--q-border` is decorative (1.2:1 — fine for card edges on canvas).
   Any boundary that _identifies a control_ (inputs, checkboxes) uses
   `--q-border-strong` (≥ 3:1, WCAG 1.4.11) or a filled `--q-bg-raised` treatment.
5. Dark mode: elevation by border + lighter surface, never heavier shadow (§4.3).
6. Accent fills in dark mode take `--q-accent-contrast` **#131110** (ink text on
   terracotta, 5.59:1); white-on-accent fails in dark's lighter accent.

### 2.4 Contrast table (computed, WCAG 2.1)

| Pair (fg on bg)                          | Light | Dark  | AA normal (4.5)                   | AA large / non-text (3.0) |
| ---------------------------------------- | ----- | ----- | --------------------------------- | ------------------------- |
| text-primary on canvas                   | 15.01 | 15.15 | Pass                              | Pass                      |
| text-primary on surface                  | 16.05 | 14.07 | Pass                              | Pass                      |
| text-primary on raised                   | —     | 12.71 | Pass                              | Pass                      |
| text-secondary on canvas                 | 5.40  | 7.16  | Pass                              | Pass                      |
| text-secondary on surface                | 5.78  | 6.65  | Pass                              | Pass                      |
| text-muted on canvas                     | 3.29  | 4.01  | **Fail — large-only rule §2.3.1** | Pass                      |
| accent (link) on canvas                  | 5.63  | 5.59  | Pass                              | Pass                      |
| accent on surface                        | 6.02  | 5.19  | Pass                              | Pass                      |
| accent-contrast on accent (buttons)      | 6.02  | 5.59  | Pass                              | Pass                      |
| accent-hover on canvas                   | —     | 7.07  | Pass                              | Pass                      |
| success-text on success-bg               | 5.49  | 5.44  | Pass                              | Pass                      |
| warning-text on warning-bg               | 5.37  | 5.64  | Pass                              | Pass                      |
| danger-text on danger-bg                 | 4.98  | 5.50  | Pass                              | Pass                      |
| info-text on info-bg                     | 4.67  | 5.05  | Pass                              | Pass                      |
| danger-text on canvas                    | 5.58  | 6.47  | Pass                              | Pass                      |
| white on danger (danger button)          | 5.96  | —     | Pass                              | Pass                      |
| border-strong vs surface (non-text)      | 3.52  | 3.73  | —                                 | Pass                      |
| focus ring (accent) vs canvas (non-text) | 5.63  | 5.59  | —                                 | Pass                      |

Ratios computed with the WCAG relative-luminance formula; the token build re-verifies
these in a unit test (`tokens.contrast.spec.ts`) so a palette edit cannot silently
regress accessibility.

---

## 3. Typography

### 3.1 Font stacks (self-hosted via @fontsource — ADR §6, no CDN)

| Token                 | Stack                                                                                      | Used for                                                  |
| --------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `--q-font-ui`         | `Inter, "Noto Sans Devanagari", "Noto Naskh Arabic", ui-sans-serif, system-ui, sans-serif` | All chrome: nav, buttons, forms, meta, admin.             |
| `--q-font-reading`    | `Lora, "Noto Serif Devanagari", Georgia, serif`                                            | Reading body + titles, editor surface (Latin & Hindi).    |
| `--q-font-reading-ur` | `"Noto Nastaliq Urdu", "Noto Naskh Arabic", serif`                                         | Urdu reading body + titles only (never chrome — `06` §7). |
| `--q-font-mono`       | `"JetBrains Mono", ui-monospace, "SF Mono", monospace`                                     | Code, IDs, `requestId` in error details, admin tokens.    |

_Why one UI stack for three scripts:_ the browser falls through per glyph — Latin hits
Inter, Devanagari hits Noto Sans Devanagari, Arabic-script hits Naskh. One token, no
per-locale switching in chrome.

### 3.2 Type scale — 1.25 ratio (ADR §7)

| Token           | px / rem    | Role name | Weight          | LH   | Usage                                                   |
| --------------- | ----------- | --------- | --------------- | ---- | ------------------------------------------------------- |
| `--q-text-xs`   | 12 / 0.75   | caption   | 400             | 1.5  | Timestamps in rails, badge counts, chart axes.          |
| `--q-text-sm`   | 14 / 0.875  | body-sm   | 400/500         | 1.5  | Default UI text, buttons, inputs, meta rows. AntD base. |
| `--q-text-base` | 16 / 1.0    | body      | 400             | 1.5  | Card excerpts, settings copy, dialogs.                  |
| `--q-text-lg`   | 20 / 1.25   | title-sm  | 500             | 1.4  | Section headers, dialog titles, compact-card titles.    |
| `--q-text-xl`   | 25 / 1.5625 | title     | 500             | 1.35 | Feed card titles, profile pen name, page titles.        |
| `--q-text-2xl`  | 31 / 1.9375 | heading   | 600             | 1.3  | Analytics page header, auth headline.                   |
| `--q-text-3xl`  | 39 / 2.4375 | display   | 600 (serif 500) | 1.25 | Piece title (reading serif), editor title.              |
| `--q-text-4xl`  | 49 / 3.0625 | hero      | 600             | 1.15 | Landing page only.                                      |

**Reading sizes** (independent of the UI scale; user-adjustable S/M/L):

| Script                      | S / M / L          | Line-height token        | Value                           |
| --------------------------- | ------------------ | ------------------------ | ------------------------------- |
| Latin (Lora)                | 18 / **20** / 22px | `--q-leading-reading`    | **1.7**                         |
| Devanagari (Noto Serif Dev) | 18 / **20** / 22px | `--q-leading-devanagari` | 1.8 (taller matras/conjuncts)   |
| Nastaliq (Urdu)             | 20 / **22** / 24px | `--q-leading-nastaliq`   | **2.1** (never < 2.0 — `06` §7) |
| UI (all scripts)            | —                  | `--q-leading-ui`         | **1.5**                         |

Reading column: `max-width: 68ch` (within the ADR's 65–72ch band), measured in the
active reading font.

### 3.3 Font loading strategy

| Aspect           | Decision                                                                                                                          | Why                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Hosting          | `@fontsource/*` packages, woff2 only, bundled by Vite                                                                             | Privacy + perf (ADR); versions pinned by pnpm.   |
| Initial payload  | Inter 400/500/600 + Lora 400/500/600-italic, `latin` subset — preloaded in `index.html`                                           | Chrome + Latin reading render instantly.         |
| Script subsets   | Noto Sans/Serif Devanagari and Naskh loaded via `unicode-range` — the browser fetches them only when those glyphs appear          | Zero cost for readers who never see that script. |
| Nastaliq         | **Lazy**: `@fontsource/noto-nastaliq-urdu` imported by the Urdu reading surface on demand (it is the heaviest face in the system) | Don't tax non-Urdu sessions.                     |
| `font-display`   | `swap` for UI; `swap` for reading faces with metric-tuned fallbacks                                                               | Words > silence.                                 |
| Fallback metrics | `@font-face` fallback overrides (`size-adjust`, `ascent-override`) tuned so Georgia→Lora swap shifts < 1 line per screen          | Kill layout shift on swap.                       |
| FOUT policy      | Accepted for reading faces; never block paint on a font                                                                           | Sanctuary means fast.                            |

---

## 4. Spacing, Radii, Elevation, Z-index

### 4.1 Spacing — 4px base (ADR scale: 4/8/12/16/24/32/48/64/96)

| Token         | px  | Typical use                                    |
| ------------- | --- | ---------------------------------------------- |
| `--q-space-1` | 4   | Icon-to-count gap, tag inner gap.              |
| `--q-space-2` | 8   | Inside compact controls, chip gaps.            |
| `--q-space-3` | 12  | Input padding-inline, card meta rows.          |
| `--q-space-4` | 16  | Card padding (compact), mobile page gutter.    |
| `--q-space-5` | 24  | Card padding (default), dialog padding.        |
| `--q-space-6` | 32  | Section gaps (mobile), form group spacing.     |
| `--q-space-7` | 48  | Section gaps (desktop).                        |
| `--q-space-8` | 64  | Page-level breathing room, reading top margin. |
| `--q-space-9` | 96  | Hero/landing rhythm only.                      |

Off-scale values are banned; if a design "needs" 20px, the design is wrong.

### 4.2 Radii (ADR: 6/10/16)

| Token                | px   | Applies to                                       |
| -------------------- | ---- | ------------------------------------------------ |
| `--q-radius-control` | 6    | Buttons, inputs, tags, tabs, tooltips.           |
| `--q-radius-card`    | 10   | Cards, popovers, covers, toasts, skeleton rects. |
| `--q-radius-modal`   | 16   | Dialogs, sheets, drawers (leading edge).         |
| `--q-radius-full`    | 9999 | Avatars, dots, pill badges, ClapButton.          |

### 4.3 Elevation — warm shadows (light) / borders (dark)

Shadow color derives from the ink `#24211B`, never gray-black — this is what keeps
shadows "warm paper" instead of "gray app".

| Token          | Light value                                                    | Dark equivalent                            | Use                                         |
| -------------- | -------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------- |
| `--q-shadow-1` | `0 1px 2px rgba(36,33,27,.06), 0 1px 3px rgba(36,33,27,.08)`   | `none` + 1px `--q-border`                  | Cards at rest, inputs.                      |
| `--q-shadow-2` | `0 2px 4px rgba(36,33,27,.05), 0 4px 12px rgba(36,33,27,.08)`  | 1px `--q-border` + surface `--q-bg-raised` | Hovered cards, popovers, dropdowns, toasts. |
| `--q-shadow-3` | `0 4px 8px rgba(36,33,27,.06), 0 16px 32px rgba(36,33,27,.12)` | 1px `--q-border-strong` + `--q-bg-raised`  | Dialogs, sheets, command palette.           |

In dark mode the shadow tokens resolve to `none`; elevated components add border +
surface-step instead (encoded in the component styles once, driven by the same tokens).

### 4.4 Z-index scale

| Token            | Value | Layer                                         |
| ---------------- | ----- | --------------------------------------------- |
| `--q-z-sticky`   | 100   | Sticky tabs, reading progress bar.            |
| `--q-z-fixed`    | 200   | Top bar, mobile tab bar, editor toolbar.      |
| `--q-z-backdrop` | 1000  | Dialog/sheet scrim (`rgba(19,17,16,.55)`).    |
| `--q-z-modal`    | 1010  | Dialogs, sheets, drawers.                     |
| `--q-z-popover`  | 1030  | Dropdowns, mention popover, footnote popover. |
| `--q-z-toast`    | 1050  | Toasts/undo.                                  |
| `--q-z-tooltip`  | 1070  | Tooltips — always on top.                     |

AntD's `zIndexPopupBase` is set to 1000 so its layers interleave correctly with ours.

---

## 5. Motion

Framer Motion; durations and reduced-motion policy locked by ADR §6.

| Token             | Value | Easing              | Use                                                    |
| ----------------- | ----- | ------------------- | ------------------------------------------------------ |
| `--q-motion-fast` | 150ms | `--q-ease-standard` | Hover/active states, focus ring fade, chrome fade-out. |
| `--q-motion-base` | 250ms | `--q-ease-out`      | Fade-rise, popovers, tab underline slide, toasts in.   |
| `--q-motion-slow` | 400ms | `--q-ease-out`      | Dialogs/sheets, page transitions, clap burst.          |

| Easing token        | Curve                           | Character                                          |
| ------------------- | ------------------------------- | -------------------------------------------------- |
| `--q-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)`    | Default — quick start, soft landing.               |
| `--q-ease-out`      | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances — decelerating, "settling on paper".     |
| `--q-ease-in`       | `cubic-bezier(0.3, 0, 1, 1)`    | Exits only — things leave faster than they arrive. |

**Standard variants** (exported from `@qalam/ui/motion` so every feature animates
identically):

| Variant          | Spec                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `fadeRise`       | opacity 0→1, translateY 8px→0, 250ms `--q-ease-out`. Cards mounting, toasts, "New pieces" pill, save bar. |
| `fade`           | opacity only, 150ms. Chrome show/hide, image reveals.                                                     |
| `scaleIn`        | opacity 0→1, scale 0.98→1, 250ms. Dialogs, popovers (transform-origin at anchor).                         |
| `pageTransition` | Exit fade 150ms `--q-ease-in` → enter fadeRise 250ms. No slides — a book doesn't slide.                   |
| `clapBurst`      | Count chip scale 1→1.12→1, 400ms spring (stiffness 400, damping 22).                                      |

**Reduced motion policy:** under `prefers-reduced-motion: reduce` (or the Appearance
override), all transform-based variants collapse to `fade` at ≤ 150ms; shimmer, clap
burst, and tab-underline slide are disabled; scroll behavior is `auto`. Implemented
once in the shared `MotionProvider`, not per component.

---

## 6. Iconography

- **Canonical set: [lucide-react]** — outline style, **1.5px stroke**, round joins.
  Matches the hairline, literary aesthetic; filled icons are used only for active
  toggle states (liked heart, filled bookmark).
- Sizes: **16** (inline with 12–14px text, tag icons), **20** (default — buttons,
  rail, inputs), **24** (mobile tab bar, empty states at 2× inside a 48px circle).
- Color: inherit `currentColor` — icons never carry their own palette.
- Optical alignment: icons beside text get `margin-inline-end: var(--q-space-2)` and
  are vertically centered by flex, never baseline-hacked.
- **RTL:** directional icons (`arrow-*`, `chevron-*`, `corner-*`, list-indent) flip via
  `[dir="rtl"] & { scale: -1 1 }` utility; **never flip** play/media, clocks,
  checkmarks, undo/redo, or the logo (`06` §6.4).
- **AntD pairing rule:** every AntD component that accepts icon slots (`suffixIcon`,
  `expandIcon`, Modal `closeIcon`…) receives a lucide icon from our wrappers.
  `@ant-design/icons` is never imported in app code; AntD's internal, non-overridable
  glyphs (e.g., input clear-circle) are tolerated in admin, restyled by token in the
  reader app where visible.

---

## 7. Component Specifications

Each spec: anatomy → variants → states → mapping (what wraps AntD vs custom — the
policy rationale lives in `08` §2).

### 7.1 Buttons — `QButton` (wraps AntD `Button`)

Anatomy: `[icon?] label [icon?]` · height by size · radius `--q-radius-control` ·
font `--q-text-sm` (lg: `--q-text-base`), weight 500 · icon 20px.

| Size | Height | Padding-inline | Notes                                                                          |
| ---- | ------ | -------------- | ------------------------------------------------------------------------------ |
| `sm` | 32px   | 12px           | Desktop-dense surfaces (admin, rail follow). Hit area padded to 44px on touch. |
| `md` | 40px   | 16px           | Default.                                                                       |
| `lg` | 48px   | 24px           | Auth forms, publish sheet primary, mobile CTAs.                                |

| Variant     | Rest                                                                                            | Hover                            | Active                    | Why                              |
| ----------- | ----------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------- | -------------------------------- |
| `primary`   | bg `--q-accent`, text `--q-accent-contrast`                                                     | bg `--q-accent-hover`            | bg `--q-accent-active`    | One per view — the ink stamp.    |
| `secondary` | bg transparent, 1px `--q-border-strong`, text `--q-text-primary`                                | bg `--q-bg-raised`               | bg raised + border accent | Default action weight.           |
| `ghost`     | text `--q-text-secondary`, no border                                                            | bg `--q-bg-raised`, text primary | —                         | Toolbars, rails, inline actions. |
| `danger`    | bg `--q-danger`, text #FFFFFF (light) / `--q-danger` outline style in dark until confirmed step | hover deepens                    | —                         | Destructive confirms only.       |

States: `loading` (spinner replaces start icon, width locked, `aria-busy`,
pointer-events off) · `disabled` (50% opacity, no color shift — WCAG-exempt) ·
`:focus-visible` (ring §9). All transitions `--q-motion-fast`.

### 7.2 Inputs — `QInput` / `QTextArea` / `QSelect` / `QSearch` (wrap AntD)

Anatomy: `label (14px, 500) → field → hint | error (12px)` · field: bg
`--q-bg-surface`, 1px `--q-border-strong`, radius 6, padding-inline 12, heights
40 (`md`) / 48 (`lg`) · placeholder `--q-text-muted`.

| State    | Treatment                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hover    | border `--q-text-secondary`.                                                                                                                                  |
| Focus    | border `--q-accent` + ring (§9); label stays static (no floating labels — they misbehave in RTL + Nastaliq).                                                  |
| Error    | border `--q-danger`, error line in `--q-danger-text` with 16px alert icon, `aria-invalid` + `aria-describedby`.                                               |
| Disabled | bg `--q-bg-raised`, text muted.                                                                                                                               |
| RTL      | Slots are logical: `prefix` renders inline-start, clear/`suffix` inline-end; user-content fields default `dir="auto"` so an Urdu title right-aligns as typed. |

`QSearch` = QInput + search icon (start slot), clear button, `role="searchbox"`,
`/`-shortcut focus. `QSelect` wraps AntD Select (its virtual list and keyboard model
are why we wrap rather than build); popover styled by tokens, radius 10, shadow-2.

### 7.3 Cards — `QCard`, `PieceCard`, `QuoteCard` (custom-built)

`QCard` primitive: bg `--q-bg-surface`, 1px `--q-border`, radius `--q-radius-card`,
shadow-1; `interactive` adds hover shadow-2 + border-strong and `:focus-visible` ring
(entire card is a single link — `06` §3.1).

**PieceCard anatomy (feed variant):**

```
┌ QCard ─────────────────────────────────────┐
│ AuthorByline (avatar 32 · pen name · @user · time)
│ Title  --q-text-xl reading serif, 2-line clamp, dir per piece
│ Excerpt --q-text-base secondary, 2-line clamp
│ Footer: [QTag genre] [LanguageBadge] · read-time ─ actions: clap like save
└────────────────────────────────────────────┘
padding --q-space-5 · footer meta 12px secondary · variants: feed | compact | featured
```

`compact`: no excerpt, title at `--q-text-lg`, used in responses/search/profile lists.
`featured`: adds cover image (2:1, radius 10 top) — Discover shelves only.

**QuoteCard** (featured-quote share card): `--q-accent-subtle` bg, oversized opening
quote glyph in reading serif, quote at `--q-text-lg` italic (Latin/Hindi) or regular
(Urdu — no italic, `06` §7), attribution byline. Rendered from `card_templates` for
share images; the web version is this component.

### 7.4 Dialogs & Sheets — `QDialog`, `QSheet` (wrap AntD `Modal` / `Drawer`)

Anatomy: scrim `--q-z-backdrop` → panel radius `--q-radius-modal`, shadow-3, padding
`--q-space-5`; title `--q-text-lg` 600; footer slot, actions end-aligned (logical),
primary last.

| Size | Width | Use                             |
| ---- | ----- | ------------------------------- |
| `sm` | 400px | Confirms, "Save to collection". |
| `md` | 560px | Forms, username confirm.        |
| `lg` | 720px | Rich pickers (admin).           |

Behavior: focus trap, `Esc` + scrim click close (both disabled for `danger` typed
confirms), focus restored to invoker, `scaleIn` motion, mobile < 640px renders as a
bottom sheet (drag handle, full-width, radius 16 top). `QSheet` = side sheet (publish
flow), 480px, slides from inline-end.

### 7.5 Tables (admin only) — wraps AntD `Table`

Reader app never shows data tables except analytics "By piece" (which uses this same
wrapper in compact mode). Header: 12px, 600, uppercase-tracking-.04em,
`--q-text-secondary`, bg `--q-bg-raised`; rows 48px, hairline `--q-border`
separators; hover `--q-bg-raised`; numeric columns end-aligned with `font-variant-numeric:
tabular-nums`; sticky header; offset pagination (ADR §5 — admin needs totals). Row
actions: ghost icon buttons, visible on hover _and_ focus-within (keyboard parity).

### 7.6 Tags & Badges — `QTag`, `QBadge`, `LanguageBadge` (custom-built)

**QTag:** heights 20 (`sm`) / 24 (`md`), radius 6, padding-inline 8, 12px text.
Colors: `neutral` (raised bg / secondary text), `accent` (accent-subtle bg /
accent text), semantic families (`*-bg` + `*-text`). Interactive tags (tag/genre links)
render as `<a>`, get hover border-strong; removable tags (editor) add a 16px ✕ button
with its own 24px hit area and `aria-label="Remove {tag}"`.

**QBadge:** notification dot (8px, `--q-accent`) or count pill (16px height, 10px text,
radius-full, max "9+"), positioned logical top-end of its anchor; always paired with an
`srLabel` ("4 unread notifications") because a dot says nothing to a screen reader.

**LanguageBadge:** QTag `neutral` rendering the language's native name (`اردو`,
`हिन्दी`) inside `<bdi>` in the correct UI font, with `lang` attribute set — it doubles
as the screen-reader language hint on cards.

### 7.7 Empty states — `QEmptyState` (custom-built)

Anatomy: 48px circle (`--q-bg-raised`) with 24px lucide icon in `--q-text-muted`
(large-size context — legal) → title `--q-text-lg` 500 → body `--q-text-base`
secondary, max 40ch → one optional action. Vertically centered in the emptied region,
min-height 320px. Copy: literary voice catalogue in `06` §4.4 — components never
invent their own copy.

### 7.8 Loading & Skeletons — `QSkeleton` (custom-built)

_Why custom:_ AntD's skeleton shimmer is cool-gray and its shapes don't match our
cards; ours must inherit warm tokens and respect RTL shimmer direction.

- Base: `--q-bg-raised`; shimmer: linear-gradient sweep (transparent →
  `--q-bg-surface` @ 60% opacity → transparent), 1.8s linear infinite, sweeping
  **inline-start → inline-end** (mirrors in RTL); static under reduced motion.
- Variants: `text` (14px lines, last line 60% width), `title` (25px), `avatar`
  (circle 32/48/80), `rect` (any, radius-card).
- Composites ship next to their real components: `PieceCardSkeleton`,
  `BylineSkeleton`, `StatTileSkeleton` — skeleton layout must match real min-heights
  (`06` §4.3, no reflow on hydration).
- Buttons/inline actions use the `loading` prop spinner (16px, 0.8s rotation), never a
  skeleton.

### 7.9 Toasts — `useToast()` (wraps AntD `notification` via `App` provider)

Anatomy: surface bg, radius-card, shadow-2, 16px semantic icon, 14px message, optional
action button (the Undo pattern — `06` §4.6), close affordance on hover/focus.

| Variant                     | Icon color                       | Duration                                      |
| --------------------------- | -------------------------------- | --------------------------------------------- |
| `neutral` ("Saved")         | `--q-text-secondary`             | 3s                                            |
| `success`                   | `--q-success`                    | 3s                                            |
| `danger` (rollback notices) | `--q-danger`                     | 5s                                            |
| `undo`                      | — (action button carries weight) | 5s (10s for unpublish), pauses on hover/focus |

Placement: bottom inline-start (desktop), above tab bar (mobile). Max 3 stacked,
oldest collapses. Container is `aria-live="polite"`; `undo` toasts also render a
visually-hidden "press Alt+U to undo" hotkey. Toasts never carry critical-path info —
anything requiring action beyond undo gets inline UI instead.

---

## 8. Responsive Breakpoints

Tailwind defaults (ADR §7) — no custom breakpoints, ever:

| Token | Min-width | Shorthand behavior                                                                  |
| ----- | --------- | ----------------------------------------------------------------------------------- |
| base  | 0         | Mobile: bottom tab bar, single column, 16px gutters, 44px targets.                  |
| `sm`  | 640px     | Gutters 24px; dialogs stop being bottom sheets.                                     |
| `md`  | 768px     | Tab bar → top bar only; reading rail appears.                                       |
| `lg`  | 1024px    | Feed sidebar; settings side-nav; hover affordances allowed (with tap/focus parity). |
| `xl`  | 1280px    | Content max-width reached; whitespace grows, columns don't.                         |
| `2xl` | 1536px    | No layout change — sanctuary, not sprawl.                                           |

Layout details per screen: `06` §8.

---

## 9. Accessibility Rules

| Rule                 | Spec                                                                                                                                                                                                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrast             | WCAG 2.1 AA minimum, enforced by the §2.4 table + token unit test. Muted-text and warning-text restrictions in §2.3 are load-bearing.                                                                                                                                                                                            |
| Focus ring           | `outline: 2px solid var(--q-accent); outline-offset: 2px;` on `:focus-visible` for every interactive element. Inputs may substitute `box-shadow: 0 0 0 2px` ring outside the accent border. Never `outline: none` without replacement.                                                                                           |
| Hit areas            | ≥ 44×44px on touch devices; visually smaller controls expand via pseudo-element (`::after` inset −6px pattern in `@qalam/ui`).                                                                                                                                                                                                   |
| Keyboard             | Everything operable; roving tabindex in the editor toolbar and tab bars; `Esc` closes topmost layer; dialogs trap + restore focus; visible skip-link first.                                                                                                                                                                      |
| ARIA                 | Tabs = `role="tablist"` (AntD Tabs compliant); feed = `role="feed"` + `aria-busy`; progress bar = `role="progressbar"` throttled `aria-valuenow`; toggles (like/bookmark/follow) = `aria-pressed`; toasts/autosave = `aria-live="polite"`; icons decorative by default (`aria-hidden`) with text or `aria-label` on the control. |
| Language & direction | Every content node carries `lang` + `dir` from the piece; user strings wrapped in `<bdi>` (`06` §6).                                                                                                                                                                                                                             |
| Motion               | `prefers-reduced-motion` + user override — policy in §5.                                                                                                                                                                                                                                                                         |
| Testing              | Storybook a11y addon (axe) on every story; CI fails on new violations.                                                                                                                                                                                                                                                           |

---

## 10. AntD Theme Mapping

`antdTheme(mode)` in `@qalam/ui` — the only file allowed to touch AntD theme keys.

| `--q-*` token                                             | AntD theme key                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------- |
| `--q-accent`                                              | `colorPrimary`, `colorLink`                                      |
| `--q-accent-hover`                                        | `colorPrimaryHover`, `colorLinkHover`                            |
| `--q-accent-active`                                       | `colorPrimaryActive`                                             |
| `--q-bg-canvas`                                           | `colorBgLayout`                                                  |
| `--q-bg-surface`                                          | `colorBgContainer`, `colorBgElevated`                            |
| `--q-bg-raised`                                           | `colorFillSecondary`, `controlItemBgHover`                       |
| `--q-text-primary`                                        | `colorText`                                                      |
| `--q-text-secondary`                                      | `colorTextSecondary`                                             |
| `--q-text-muted`                                          | `colorTextTertiary`, `colorTextPlaceholder`, `colorTextDisabled` |
| `--q-border`                                              | `colorSplit`                                                     |
| `--q-border-strong`                                       | `colorBorder`                                                    |
| `--q-success` / `--q-warning` / `--q-danger` / `--q-info` | `colorSuccess` / `colorWarning` / `colorError` / `colorInfo`     |
| `--q-font-ui`                                             | `fontFamily`                                                     |
| `--q-text-sm` (14)                                        | `fontSize`                                                       |
| `--q-radius-control` (6)                                  | `borderRadius`                                                   |
| `--q-radius-card` (10)                                    | `borderRadiusLG`                                                 |
| `--q-radius-modal` (16)                                   | component token `Modal.borderRadiusLG`                           |
| 40 / 32 / 48                                              | `controlHeight` / `controlHeightSM` / `controlHeightLG`          |
| `--q-motion-fast/base/slow`                               | `motionDurationFast/Mid/Slow` (`'0.15s'/'0.25s'/'0.4s'`)         |
| `--q-z-backdrop` (1000)                                   | `zIndexPopupBase`                                                |
| `--q-shadow-2` / `--q-shadow-3`                           | `boxShadowSecondary` / `boxShadow` (dark mode: `'none'`)         |

Dark mode: `algorithm: theme.darkAlgorithm` **plus** the explicit dark token values
above — the algorithm alone produces cool grays that violate the warm palette; our
overrides win.

---

## 11. Tailwind v4 Mapping

`packages/ui/src/tokens/tailwind.css` — imported once per app after `tokens.css`:

```css
@theme {
  /* color — utilities: bg-canvas, text-secondary, border-strong, bg-danger-bg… */
  --color-canvas: var(--q-bg-canvas);
  --color-surface: var(--q-bg-surface);
  --color-raised: var(--q-bg-raised);
  --color-primary: var(--q-text-primary);
  --color-secondary: var(--q-text-secondary);
  --color-muted: var(--q-text-muted);
  --color-border: var(--q-border);
  --color-border-strong: var(--q-border-strong);
  --color-accent: var(--q-accent);
  --color-accent-hover: var(--q-accent-hover);
  --color-accent-subtle: var(--q-accent-subtle);
  --color-success: var(--q-success); /* + -text/-bg per family */
  --color-danger: var(--q-danger);
  /* type — text-xs…text-4xl match §3.2 exactly */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.5625rem;
  --text-2xl: 1.9375rem;
  --text-3xl: 2.4375rem;
  --text-4xl: 3.0625rem;
  --font-ui: var(--q-font-ui);
  --font-reading: var(--q-font-reading);
  --font-reading-ur: var(--q-font-reading-ur);
  --font-mono: var(--q-font-mono);
  /* spacing: Tailwind's default 4px --spacing base already equals our scale;
     off-scale utilities (p-5 = 20px) are banned by the eslint tailwind plugin
     allowlist: 1,2,3,4,6,8,12,16,24. */
  --radius-control: var(--q-radius-control);
  --radius-card: var(--q-radius-card);
  --radius-modal: var(--q-radius-modal);
  --shadow-1: var(--q-shadow-1);
  --shadow-2: var(--q-shadow-2);
  --shadow-3: var(--q-shadow-3);
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

Because every `@theme` value resolves to a `var(--q-*)`, dark mode requires **zero**
`dark:` utilities for token-driven styles — the variable swap does the work. `dark:` is
reserved for the rare structural difference (e.g., swapping shadow for border on
elevated cards). Physical-direction utilities (`ml-*`, `pl-*`, `left-*`, `text-left`)
are banned by lint in favor of logical ones (`ms-*`, `ps-*`, `start-*`, `text-start`) —
ADR §6, RTL day one.

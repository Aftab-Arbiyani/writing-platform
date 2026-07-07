# 08 — Component Library (`@qalam/ui`)

> **Derives from:** `00_ArchitectureDecisions.md` §2 (package responsibilities), §6
> (frontend stack). Visual/behavioral specs live in `07_DesignSystem.md`; screen usage
> in `06_UIUXSpecification.md`. This document is the package charter and the Phase-1
> contract sketches — **interfaces only, no implementations**.

---

## 1. Package Charter

`@qalam/ui` is _how it looks_ (ADR §2): design tokens, the AntD theme factory, the
Tailwind `@theme` layer, motion variants, and shared presentational components consumed
by both `frontend/` and `admin/`.

**Hard boundaries — what `@qalam/ui` may never contain:**

- No data fetching: no TanStack Query, no `api-client`, no hooks that touch the network.
- No routing: no `react-router` imports — navigation is injected (see `linkComponent`
  pattern, §3).
- No app state: no Zustand stores; components are controlled via props.
- No domain logic: limits like `MAX_CLAPS_PER_USER` are _imported_ from `@qalam/shared`
  as defaults, never redefined.

_Why:_ a presentational-only package stays buildable by tsup, testable in isolation,
renderable in Storybook without providers, and reusable by any future consumer
(mobile web shell, marketing site) without dragging the app's data layer along.

### 1.1 Where does a component live? (decision table)

| Question (first "yes" wins)                                                           | Home                                                    | Examples                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------- |
| Is it a token, theme object, motion variant, or global style?                         | `@qalam/ui/tokens`                                      | `tokens.css`, `antdTheme()`, `fadeRise`       |
| Is it a generic primitive any product surface could use?                              | `@qalam/ui` (Q-prefixed)                                | `QButton`, `QDialog`, `QSkeleton`             |
| Is it domain-shaped but purely presentational _and_ used by ≥ 2 apps or ≥ 2 features? | `@qalam/ui` (product components)                        | `PieceCard`, `AuthorByline`, `ClapButton`     |
| Is it an app-wide composite that wires shell/app concerns (router, session)?          | `frontend/src/components/` (or `admin/src/components/`) | `AppShell`, `TopBar`, `NotificationsBell`     |
| Is it used by exactly one feature?                                                    | `features/<name>/components/`                           | `PublishSheet`, `FootnotePopover`, `StatTile` |

Promotion is one-way and deliberate: a feature component that a second feature needs
moves _up_ one level via the §7 workflow — it is never copy-pasted sideways.

---

## 2. Build-vs-Wrap Policy

The rule of thumb (ADR §6): **AntD for complex widget machinery, custom for literary
surfaces.** Wrapping means: AntD component inside, `@qalam/ui` API outside — apps never
import `antd` directly (lint-enforced), so an AntD swap-out later is a package-internal
change.

| Category                                     | Decision                                      | Rationale                                                                                                                                       |
| -------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Tables, pagination (admin)                   | **Wrap AntD** (`Table`)                       | Sorting, sticky headers, virtual scroll, column resize — months of machinery we should not rebuild for an admin panel.                          |
| Dialogs, drawers, sheets                     | **Wrap AntD** (`Modal`/`Drawer`)              | Focus trap, scroll lock, portal stacking are correctness-critical and battle-tested. We restyle via tokens.                                     |
| Pickers (date/time), Select, Upload          | **Wrap AntD**                                 | Keyboard/virtual-list/locale behavior is the hard 90%.                                                                                          |
| Buttons, inputs, form controls               | **Wrap AntD** (thin)                          | Cheap to wrap, and keeps loading/disabled semantics consistent with the rest of AntD-backed forms.                                              |
| Toasts                                       | **Wrap AntD `notification`** via `useToast()` | Stacking/queueing solved; we own placement, tokens, and the undo pattern.                                                                       |
| `PieceCard`, `QuoteCard`, `AuthorByline`     | **Build custom**                              | The literary identity of the product. No kit widget looks like warm paper; fighting AntD Card styling costs more than 60 lines of our own flex. |
| `ClapButton`, `ReadingProgress`              | **Build custom**                              | Genuinely novel interactions (batched 1–50 claps, direction-aware progress) — no upstream equivalent exists.                                    |
| `EditorToolbar`                              | **Build custom** (app-level, TipTap-bound)    | Bound to TipTap's command surface and selection state; a kit toolbar is the wrong abstraction.                                                  |
| `QEmptyState`, `QSkeleton`, `QTag`, `QBadge` | **Build custom**                              | Trivial to build, and AntD's versions carry the wrong voice (cool grays, its empty-state artwork, closable-tag logic we don't want).            |

---

## 3. Phase-1 Component Inventory (contract sketches)

Conventions used below: every component `forwardRef`s to its root element; every
component accepts `className` (Tailwind merge via `clsx` + `tailwind-merge`); domain
types come from `@qalam/api-types`; navigation is injected:

```ts
// The one navigation seam. Apps pass their router's Link; Storybook passes <a>.
export type LinkComponent = React.ComponentType<
  React.PropsWithChildren<{ href: string; className?: string; 'aria-label'?: string }>
>;
```

### 3.1 Primitives

```ts
export interface QButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; // default 'secondary'
  size?: 'sm' | 'md' | 'lg'; // 32 | 40 | 48 (07 §7.1)
  htmlType?: 'button' | 'submit' | 'reset'; // default 'button'
  loading?: boolean; // spinner replaces start icon; locks width; aria-busy
  icon?: LucideIcon; // 20px, stroke 1.5
  iconPosition?: 'start' | 'end'; // logical — follows dir
  block?: boolean; // full inline-size (auth forms, mobile CTAs)
}

export interface QInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'prefix'
> {
  label?: string;
  hint?: string;
  error?: string; // sets aria-invalid + wires aria-describedby
  size?: 'md' | 'lg'; // 40 | 48
  prefix?: React.ReactNode; // inline-start slot (search icon, currency…)
  suffix?: React.ReactNode; // inline-end slot (clear, availability check)
  dir?: 'auto' | 'ltr' | 'rtl'; // default 'auto' on user-content fields (07 §7.2)
}

export interface QTextAreaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'dir'
> {
  label?: string;
  hint?: string;
  error?: string;
  autoGrow?: boolean; // default true; maxRows caps it
  maxRows?: number;
  showCount?: boolean; // "218 / 280" in 12px secondary, inline-end
  dir?: 'auto' | 'ltr' | 'rtl';
}

export interface QCardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'article' | 'section' | 'li'; // default 'div'
  padding?: 'none' | 'md' | 'lg'; // 0 | 16 | 24
  interactive?: boolean; // hover elevation + focus ring; pairs with an inner link
}

export interface QDialogProps {
  open: boolean;
  onClose: () => void; // fires on Esc / scrim / close button
  title: React.ReactNode; // required — a dialog without a name fails ARIA
  description?: React.ReactNode; // wired to aria-describedby
  size?: 'sm' | 'md' | 'lg'; // 400 | 560 | 720 (07 §7.4)
  footer?: React.ReactNode; // slot; omit for content-driven footers; null = none
  danger?: boolean; // danger styling + disables scrim/Esc dismissal
  initialFocusRef?: React.RefObject<HTMLElement>;
  children: React.ReactNode;
}

export interface QTagProps {
  children: React.ReactNode;
  color?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md'; // 20 | 24 height
  href?: string; // renders via linkComponent as <a> (tag/genre pages)
  linkComponent?: LinkComponent;
  onRemove?: () => void; // removable tag (editor); adds ✕ with 24px hit area
  removeLabel?: string; // aria-label for ✕ — required when onRemove is set
}

export interface QBadgeProps {
  children: React.ReactNode; // the anchor (bell icon, tab item)
  count?: number; // pill with number; omit + dot for presence-only
  dot?: boolean;
  max?: number; // default 9 → "9+"
  srLabel: string; // REQUIRED: "4 unread notifications"
}

export interface QEmptyStateProps {
  icon?: LucideIcon; // 24px in a 48px raised circle
  title: string; // literary voice — copy catalogue in 06 §4.4
  description?: string;
  action?: React.ReactNode; // at most one QButton by convention
  minHeight?: number; // default 320
}

export interface QSkeletonProps {
  variant?: 'text' | 'title' | 'avatar' | 'rect'; // default 'text'
  lines?: number; // text variant; last line renders 60% width
  width?: number | string;
  height?: number | string;
  avatarSize?: 32 | 48 | 80;
  radius?: 'control' | 'card' | 'full';
  animated?: boolean; // default true; auto-disabled under reduced motion
}
```

### 3.2 Product components

```ts
import type { PieceSummary, AuthorSummary, LanguageRef } from '@qalam/api-types';

export interface PieceCardProps {
  piece: PieceSummary; // slug, title, subtitle, language{code,dir,nativeName},
  // genre, tags, stats{claps,likes}, readingTimeSeconds, author
  variant?: 'feed' | 'compact' | 'featured'; // 07 §7.3
  showAuthor?: boolean; // default true; false on the author's own profile
  bookmarked?: boolean; // controlled — parent owns the optimistic mutation
  onToggleBookmark?: (next: boolean) => void;
  onClap?: () => void; // quick-clap (+1) from the card footer
  linkComponent: LinkComponent;
}

export interface ClapButtonProps {
  total: number; // piece-wide clap count (formatted by the component)
  mine: number; // this user's claps, 0..max
  max?: number; // default MAX_CLAPS_PER_USER from @qalam/shared (50)
  onClap: (increment: number) => void; // called ONCE per batch, 600ms after last tap
  disabled?: boolean; // own piece / logged out — tooltip explains why
  disabledReason?: string;
  size?: 'md' | 'lg'; // 40 | 48 circle, radius-full
}
// A11y contract: aria-pressed reflects mine > 0; batch total announced via
// aria-live once settled (06 §9); burst animation off under reduced motion.

export interface AuthorBylineProps {
  author: AuthorSummary; // username (permanent, LTR-isolated), penName, avatarUrl
  timestamp?: string; // ISO — rendered relative ("2d"), title = absolute
  readingTimeSeconds?: number;
  size?: 'sm' | 'md'; // avatar 24 | 32
  trailing?: React.ReactNode; // slot: Follow button, overflow menu
  linkComponent: LinkComponent;
}

export interface LanguageBadgeProps {
  language: LanguageRef; // { code: 'ur', nativeName: 'اردو', dir: 'rtl' }
  size?: 'sm' | 'md';
}
// Renders nativeName inside <bdi lang={code}> in the UI stack — doubles as the
// screen-reader language hint (07 §7.6).

export interface ReadingProgressProps {
  targetRef: React.RefObject<HTMLElement>; // the article body element
  dir: 'ltr' | 'rtl'; // fills in the piece's reading direction (06 §6.3)
  label?: string; // aria-label, default "Reading progress"
}
// role="progressbar"; aria-valuenow updated in 10% steps (throttled — 06 §3.2).
```

---

## 4. Every-Component Checklist

No component merges into `@qalam/ui` unless every box is checked. This list is the PR
template for the package.

| #   | Check               | Concretely                                                                                                                                             |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Tokens only**     | Zero raw hex/px/ms; everything via `--q-*` (lint-enforced).                                                                                            |
| 2   | **Dark mode**       | Renders correctly with `data-theme="dark"` — verified in the Storybook matrix story; no `dark:` utility unless structural (shadow→border).             |
| 3   | **RTL**             | Logical properties only; directional icons flip per `07` §6; verified in `dir="rtl"` matrix story; user-content slots use `dir="auto"`/`<bdi>`.        |
| 4   | **Keyboard**        | Reachable, operable, `:focus-visible` ring, `Esc`/arrow-key behavior where the pattern demands it.                                                     |
| 5   | **Reduced motion**  | All animation routed through shared variants (auto-degrading) or gated on the motion context.                                                          |
| 6   | **States**          | Loading, disabled, and error states designed — not just the happy path. Disabled controls carry a reason (tooltip/`disabledReason`) where non-obvious. |
| 7   | **Ref forwarding**  | `forwardRef` to the root DOM node; `className` merged, not clobbered.                                                                                  |
| 8   | **A11y contract**   | Roles/labels per `07` §9; axe passes in Storybook CI; `srLabel`-style required props for non-text UI.                                                  |
| 9   | **No app imports**  | No router, query, store, or `antd` leakage in the public API.                                                                                          |
| 10  | **Stories + types** | Every variant has a story; props documented via TSDoc (Storybook autodocs); exported from the package index.                                           |

---

## 5. Composition & Naming Guidelines

- **Slots over boolean explosions.** When a component grows a third "show/hide/move
  this bit" boolean, replace the booleans with a slot (`trailing`, `footer`, `prefix`)
  or a subcomponent. Bad: `<PieceCard showFollowButton hideStats compactMeta …>`.
  Good: `<AuthorByline trailing={<FollowButton …/>} />`.
- **Compound components** for cohesive groups: `QCard` stays a single element, but
  future anatomy-rich pieces (e.g., a settings row group) export
  `Component.Root/.Header/.Body` rather than a 12-prop monolith.
- **Controlled by default.** Social state (`bookmarked`, `mine` claps) is always
  controlled — optimistic logic belongs to the app's TanStack Query hooks, not the
  component (`06` §4.1). Uncontrolled convenience variants are not offered.
- **Data-shaped props, not prop soup.** Product components accept the
  `@qalam/api-types` summary object (`piece={piece}`) rather than 14 scalar props — the
  wire contract is the design contract.
- **Naming:** primitives are `Q`-prefixed (`QButton`) — they are Qalam's opinion of a
  generic control. Product components carry plain domain names (`PieceCard`,
  `ClapButton`) — there is only one of each concept. Files: `QButton/QButton.tsx` +
  `QButton.stories.tsx` + `index.ts`; exports are named, no default exports.
- **One motion source:** components import variants from `@qalam/ui/motion` — never
  inline `transition={{ duration: … }}` literals.

---

## 6. Storybook Plan (Phase 1)

- **Setup:** Storybook ^8 with the Vite builder, living in `packages/ui`
  (`pnpm --filter @qalam/ui storybook`). Decorators provide: token CSS, AntD
  `ConfigProvider` (theme from the same factory the apps use), `MotionProvider`, and a
  mock `LinkComponent`.
- **Global toolbars:** theme (light/dark → `data-theme`), direction (ltr/rtl → `dir`
  on the preview html), reading script sample (Latin/Devanagari/Nastaliq) for
  typography-bearing components.
- **Required stories per component:** one per variant/size, one interaction story
  (play function) for stateful components (ClapButton batching, QDialog focus trap),
  and one **Matrix** story rendering the component in all four theme×direction
  combinations in a single grid — this is the visual-regression unit.
- **Addons:** `a11y` (axe — CI-blocking), `interactions`, autodocs from TSDoc.
- **Visual regression:** Playwright screenshot tests run against the built Storybook in
  CI (`turbo run test:visual`), snapshotting only the Matrix stories at 1× on Chromium —
  small, deterministic surface. Budget-permitting, Chromatic replaces this with the same
  story set; the story convention is the investment either way.

---

## 7. Contribution Workflow

1. **Proposal** — an issue using the `component-proposal` template: the need, which
   screens/features want it (must satisfy the §1.1 table), the API sketch (props,
   slots), and which AntD component it wraps or why it's custom (§2 policy). The
   frontend lead approves placement before code.
2. **Tokens first** — if the design needs a value that doesn't exist, the token PR to
   `tokens.ts` lands _separately and first_, with contrast-test updates
   (`07` §2.4). Component PRs that introduce raw values are rejected mechanically by
   lint, not by debate.
3. **Build** — component + stories + tests in one PR; checklist (§4) is the PR
   description; CI runs lint, typecheck, unit tests, axe, and visual snapshots.
4. **Review** — one design review (against `06`/`07`) + one code review. Breaking
   API changes to an existing component require a migration note in the PR and a
   same-PR update of all workspace consumers (`workspace:*` means there is no version
   lag to hide behind).
5. **Document** — autodocs cover props; anything behavioral (batching windows, a11y
   contracts) is TSDoc on the prop so it appears in both the IDE and Storybook.

_Why this shape:_ the expensive failure mode of shared libraries is not bad components —
it is wrong-layer components and token drift. Steps 1 and 2 exist to kill exactly those
two failure modes before any JSX is written.
